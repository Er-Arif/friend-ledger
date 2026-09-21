from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.domain.splitting import (
    SplitError,
    split_equal,
    validate_custom_split,
)
from app.models.payment import Payment
from app.models.payment_share import PaymentShare
from app.models.session import OutingSession
from app.models.session_participation import SessionParticipation
from app.models.user import User


def get_active_participations(
    db: Session,
    *,
    session_id: UUID,
) -> list[SessionParticipation]:
    result = db.scalars(
        select(SessionParticipation)
        .where(
            SessionParticipation.session_id == session_id,
            SessionParticipation.left_at.is_(None),
        )
        .order_by(
            SessionParticipation.joined_at.asc(),
            SessionParticipation.user_id.asc(),
        )
    )

    return list(result)


def ensure_payment_view_access(
    db: Session,
    *,
    session_id: UUID,
    user_id: UUID,
) -> None:
    participation_id = db.scalar(
        select(SessionParticipation.id)
        .where(
            SessionParticipation.session_id == session_id,
            SessionParticipation.user_id == user_id,
        )
        .limit(1)
    )

    if participation_id is None:
        raise AppError(
            code="PAYMENT_NOT_FOUND",
            message="Payment not found.",
            status_code=404,
        )


def create_payment(
    db: Session,
    *,
    session_id: UUID,
    payer: User,
    description: str,
    total_amount_minor: int,
    split_type: str,
    participant_user_ids: list[UUID] | None,
    custom_shares: dict[UUID, int] | None,
) -> Payment:
    outing = db.scalar(
        select(OutingSession)
        .where(OutingSession.id == session_id)
        .with_for_update()
    )

    if outing is None:
        raise AppError(
            code="SESSION_NOT_FOUND",
            message="Outing not found.",
            status_code=404,
        )

    if outing.status != "ACTIVE":
        raise AppError(
            code="SESSION_CLOSED",
            message="This outing has already ended.",
            status_code=409,
        )

    active_participations = get_active_participations(
        db,
        session_id=session_id,
    )

    active_user_ids = {
        participation.user_id
        for participation in active_participations
    }

    if payer.id not in active_user_ids:
        raise AppError(
            code="NOT_ACTIVE_PARTICIPANT",
            message=(
                "You must be an active participant "
                "to add a payment."
            ),
            status_code=409,
        )

    try:
        if split_type == "EQUAL":
            assert participant_user_ids is not None

            requested_user_ids = set(participant_user_ids)

            if not requested_user_ids.issubset(active_user_ids):
                raise AppError(
                    code="PARTICIPANT_NOT_ACTIVE",
                    message=(
                        "Every selected participant must currently "
                        "be active in the outing."
                    ),
                    status_code=409,
                )

            ordered_user_ids = [
                participation.user_id
                for participation in active_participations
                if participation.user_id in requested_user_ids
            ]

            calculated_shares = split_equal(
                total_amount_minor=total_amount_minor,
                ordered_participant_user_ids=ordered_user_ids,
                payer_user_id=payer.id,
            )

        elif split_type == "CUSTOM":
            assert custom_shares is not None

            requested_user_ids = set(custom_shares)

            if not requested_user_ids.issubset(active_user_ids):
                raise AppError(
                    code="PARTICIPANT_NOT_ACTIVE",
                    message=(
                        "Every selected participant must currently "
                        "be active in the outing."
                    ),
                    status_code=409,
                )

            calculated_shares = validate_custom_split(
                total_amount_minor=total_amount_minor,
                shares=custom_shares,
                payer_user_id=payer.id,
            )

        else:
            raise AppError(
                code="INVALID_SPLIT_TYPE",
                message="Unsupported payment split type.",
                status_code=422,
            )

    except SplitError as exc:
        raise AppError(
            code="INVALID_SPLIT",
            message=str(exc),
            status_code=422,
        ) from exc

    payment = Payment(
        session_id=session_id,
        payer_user_id=payer.id,
        description=description.strip(),
        total_amount_minor=total_amount_minor,
        split_type=split_type,
    )

    db.add(payment)
    db.flush()

    for user_id, amount_minor in calculated_shares.items():
        db.add(
            PaymentShare(
                payment_id=payment.id,
                user_id=user_id,
                amount_minor=amount_minor,
            )
        )

    db.flush()
    db.refresh(payment)

    return payment


def get_payment_for_user(
    db: Session,
    *,
    payment_id: UUID,
    user: User,
) -> Payment:
    payment = db.get(Payment, payment_id)

    if payment is None:
        raise AppError(
            code="PAYMENT_NOT_FOUND",
            message="Payment not found.",
            status_code=404,
        )

    ensure_payment_view_access(
        db,
        session_id=payment.session_id,
        user_id=user.id,
    )

    return payment


def list_session_payments(
    db: Session,
    *,
    session_id: UUID,
    user: User,
) -> list[Payment]:
    outing = db.get(OutingSession, session_id)

    if outing is None:
        raise AppError(
            code="SESSION_NOT_FOUND",
            message="Outing not found.",
            status_code=404,
        )

    participation_id = db.scalar(
        select(SessionParticipation.id)
        .where(
            SessionParticipation.session_id == session_id,
            SessionParticipation.user_id == user.id,
        )
        .limit(1)
    )

    if participation_id is None:
        raise AppError(
            code="SESSION_NOT_FOUND",
            message="Outing not found.",
            status_code=404,
        )

    payments = db.scalars(
        select(Payment)
        .where(Payment.session_id == session_id)
        .order_by(Payment.created_at.desc())
    )

    return list(payments)


def void_payment(
    db: Session,
    *,
    payment_id: UUID,
    user: User,
    reason: str | None,
) -> Payment:
    payment = db.scalar(
        select(Payment)
        .where(Payment.id == payment_id)
        .with_for_update()
    )

    if payment is None:
        raise AppError(
            code="PAYMENT_NOT_FOUND",
            message="Payment not found.",
            status_code=404,
        )

    outing = db.scalar(
        select(OutingSession)
        .where(OutingSession.id == payment.session_id)
        .with_for_update()
    )

    if outing is None:
        raise AppError(
            code="PAYMENT_NOT_FOUND",
            message="Payment not found.",
            status_code=404,
        )

    if payment.payer_user_id != user.id:
        raise AppError(
            code="PAYMENT_VOID_FORBIDDEN",
            message="Only the original payer can void this payment.",
            status_code=403,
        )

    if outing.status != "ACTIVE":
        raise AppError(
            code="SESSION_CLOSED",
            message="Payments from a closed outing cannot be changed.",
            status_code=409,
        )

    if payment.status == "VOIDED":
        raise AppError(
            code="PAYMENT_ALREADY_VOIDED",
            message="This payment has already been voided.",
            status_code=409,
        )

    now = datetime.now(UTC)

    payment.status = "VOIDED"
    payment.voided_at = now
    payment.voided_by_user_id = user.id
    payment.void_reason = (
        reason.strip()
        if reason and reason.strip()
        else None
    )

    db.flush()
    db.refresh(payment)

    return payment