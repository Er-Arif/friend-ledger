from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.payment import Payment
from app.models.payment_share import PaymentShare
from app.models.user import User


@dataclass(frozen=True)
class PairwiseLedgerRow:
    payment: Payment
    direction: str
    amount_minor: int


def calculate_pairwise_net(
    db: Session,
    *,
    user_id: UUID,
    other_user_id: UUID,
) -> int:
    rows = db.execute(
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

    for payment, share in rows:
        if share.user_id == payment.payer_user_id:
            continue

        if payment.payer_user_id == user_id:
            net += share.amount_minor
        else:
            net -= share.amount_minor

    return net


def get_balance_counterparts(
    db: Session,
    *,
    user_id: UUID,
) -> list[User]:
    user_ids = set(
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

    counterpart_ids = user_ids | payer_ids

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
    rows = db.execute(
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
        .order_by(
            Payment.created_at.desc(),
            Payment.id.desc(),
        )
    ).all()

    ledger: list[PairwiseLedgerRow] = []

    for payment, share in rows:
        if share.user_id == payment.payer_user_id:
            continue

        direction = (
            "OWED_TO_ME"
            if payment.payer_user_id == user_id
            else "I_OWE"
        )

        ledger.append(
            PairwiseLedgerRow(
                payment=payment,
                direction=direction,
                amount_minor=share.amount_minor,
            )
        )

    return ledger


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