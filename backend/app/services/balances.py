from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.payment import Payment
from app.models.payment_share import PaymentShare
from app.models.settlement import Settlement
from app.models.user import User


@dataclass(frozen=True)
class PairwiseLedgerRow:
    source_type: str
    payment: Payment | None
    settlement: Settlement | None
    direction: str
    amount_minor: int


def calculate_pairwise_net(
    db: Session,
    *,
    user_id: UUID,
    other_user_id: UUID,
) -> int:
    payment_rows = db.execute(
        select(Payment, PaymentShare)
        .join(
            PaymentShare,
            PaymentShare.payment_id == Payment.id,
        )
        .where(
            Payment.status == "ACTIVE",
            (
                (
                    Payment.payer_user_id == user_id
                )
                & (
                    PaymentShare.user_id == other_user_id
                )
            )
            | (
                (
                    Payment.payer_user_id == other_user_id
                )
                & (
                    PaymentShare.user_id == user_id
                )
            ),
        )
    ).all()

    net = 0

    for payment, share in payment_rows:
        if share.user_id == payment.payer_user_id:
            continue

        if payment.payer_user_id == user_id:
            net += share.amount_minor
        else:
            net -= share.amount_minor

    settlements = db.scalars(
        select(Settlement).where(
            Settlement.status == "ACTIVE",
            (
                (
                    Settlement.from_user_id == user_id
                )
                & (
                    Settlement.to_user_id == other_user_id
                )
            )
            | (
                (
                    Settlement.from_user_id == other_user_id
                )
                & (
                    Settlement.to_user_id == user_id
                )
            ),
        )
    )

    for settlement in settlements:
        if settlement.from_user_id == user_id:
            net += settlement.amount_minor
        else:
            net -= settlement.amount_minor

    return net


def get_balance_counterparts(
    db: Session,
    *,
    user_id: UUID,
) -> list[User]:
    share_user_ids = set(
        db.scalars(
            select(PaymentShare.user_id)
            .join(
                Payment,
                Payment.id == PaymentShare.payment_id,
            )
            .where(
                Payment.status == "ACTIVE",
                Payment.payer_user_id == user_id,
                PaymentShare.user_id != user_id,
            )
        ).all()
    )

    payer_ids = set(
        db.scalars(
            select(Payment.payer_user_id)
            .join(
                PaymentShare,
                PaymentShare.payment_id == Payment.id,
            )
            .where(
                Payment.status == "ACTIVE",
                PaymentShare.user_id == user_id,
                Payment.payer_user_id != user_id,
            )
        ).all()
    )

    settlement_to_ids = set(
        db.scalars(
            select(Settlement.to_user_id).where(
                Settlement.status == "ACTIVE",
                Settlement.from_user_id == user_id,
            )
        ).all()
    )

    settlement_from_ids = set(
        db.scalars(
            select(Settlement.from_user_id).where(
                Settlement.status == "ACTIVE",
                Settlement.to_user_id == user_id,
            )
        ).all()
    )

    counterpart_ids = (
        share_user_ids
        | payer_ids
        | settlement_to_ids
        | settlement_from_ids
    )

    if not counterpart_ids:
        return []

    users = db.scalars(
        select(User).where(
            User.id.in_(counterpart_ids),
        )
    )

    return list(users)


def get_pairwise_ledger(
    db: Session,
    *,
    user_id: UUID,
    other_user_id: UUID,
) -> list[PairwiseLedgerRow]:
    payment_rows = db.execute(
        select(Payment, PaymentShare)
        .join(
            PaymentShare,
            PaymentShare.payment_id == Payment.id,
        )
        .where(
            Payment.status == "ACTIVE",
            (
                (
                    Payment.payer_user_id == user_id
                )
                & (
                    PaymentShare.user_id == other_user_id
                )
            )
            | (
                (
                    Payment.payer_user_id == other_user_id
                )
                & (
                    PaymentShare.user_id == user_id
                )
            ),
        )
    ).all()

    rows: list[PairwiseLedgerRow] = []

    for payment, share in payment_rows:
        if share.user_id == payment.payer_user_id:
            continue

        rows.append(
            PairwiseLedgerRow(
                source_type="PAYMENT",
                payment=payment,
                settlement=None,
                direction=(
                    "OWED_TO_ME"
                    if payment.payer_user_id == user_id
                    else "I_OWE"
                ),
                amount_minor=share.amount_minor,
            )
        )

    settlements = db.scalars(
        select(Settlement).where(
            Settlement.status == "ACTIVE",
            (
                (
                    Settlement.from_user_id == user_id
                )
                & (
                    Settlement.to_user_id == other_user_id
                )
            )
            | (
                (
                    Settlement.from_user_id == other_user_id
                )
                & (
                    Settlement.to_user_id == user_id
                )
            ),
        )
    )

    for settlement in settlements:
        rows.append(
            PairwiseLedgerRow(
                source_type="SETTLEMENT",
                payment=None,
                settlement=settlement,
                direction=(
                    "SETTLED_BY_ME"
                    if settlement.from_user_id == user_id
                    else "SETTLED_TO_ME"
                ),
                amount_minor=settlement.amount_minor,
            )
        )

    def created_at(row: PairwiseLedgerRow):
        if row.payment is not None:
            return row.payment.created_at

        assert row.settlement is not None
        return row.settlement.created_at

    rows.sort(
        key=created_at,
        reverse=True,
    )

    return rows


def get_counterpart(
    db: Session,
    *,
    current_user_id: UUID,
    other_user_id: UUID,
) -> User:
    if current_user_id == other_user_id:
        raise AppError(
            code="BALANCE_PERSON_INVALID",
            message="You cannot have a balance with yourself.",
            status_code=422,
        )

    user = db.get(User, other_user_id)

    if user is None:
        raise AppError(
            code="USER_NOT_FOUND",
            message="User not found.",
            status_code=404,
        )

    return user