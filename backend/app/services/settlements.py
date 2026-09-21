from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.settlement import Settlement
from app.models.user import User
from app.services.balances import calculate_pairwise_net


def create_settlement(
    db: Session,
    *,
    from_user: User,
    to_user_id: UUID,
    amount_minor: int,
    method: str,
    note: str | None,
) -> Settlement:
    if from_user.id == to_user_id:
        raise AppError(
            code="SETTLEMENT_SELF_NOT_ALLOWED",
            message="You cannot settle a balance with yourself.",
            status_code=422,
        )

    pair_ids = sorted(
        [from_user.id, to_user_id],
        key=str,
    )

    locked_users = list(
        db.scalars(
            select(User)
            .where(User.id.in_(pair_ids))
            .order_by(User.id)
            .with_for_update()
        )
    )

    if len(locked_users) != 2:
        raise AppError(
            code="USER_NOT_FOUND",
            message="Settlement recipient not found.",
            status_code=404,
        )

    net = calculate_pairwise_net(
        db,
        user_id=from_user.id,
        other_user_id=to_user_id,
    )

    if net >= 0:
        raise AppError(
            code="NO_OUTSTANDING_DEBT",
            message="You do not currently owe this user.",
            status_code=409,
        )

    outstanding_minor = abs(net)

    if amount_minor > outstanding_minor:
        raise AppError(
            code="SETTLEMENT_EXCEEDS_DEBT",
            message=(
                "Settlement amount cannot exceed "
                "the outstanding debt."
            ),
            status_code=409,
            details={
                "outstanding_amount_minor": outstanding_minor,
            },
        )

    settlement = Settlement(
        from_user_id=from_user.id,
        to_user_id=to_user_id,
        amount_minor=amount_minor,
        method=method,
        note=(
            note.strip()
            if note and note.strip()
            else None
        ),
    )

    db.add(settlement)
    db.commit()
    db.refresh(settlement)

    return settlement


def void_settlement(
    db: Session,
    *,
    settlement_id: UUID,
    user: User,
    reason: str | None,
) -> Settlement:
    settlement = db.scalar(
        select(Settlement)
        .where(Settlement.id == settlement_id)
        .with_for_update()
    )

    if settlement is None:
        raise AppError(
            code="SETTLEMENT_NOT_FOUND",
            message="Settlement not found.",
            status_code=404,
        )

    if settlement.from_user_id != user.id:
        raise AppError(
            code="SETTLEMENT_VOID_FORBIDDEN",
            message=(
                "Only the user who recorded the settlement "
                "can void it."
            ),
            status_code=403,
        )

    if settlement.status == "VOIDED":
        raise AppError(
            code="SETTLEMENT_ALREADY_VOIDED",
            message="This settlement has already been voided.",
            status_code=409,
        )

    settlement.status = "VOIDED"
    settlement.voided_at = datetime.now(UTC)
    settlement.voided_by_user_id = user.id
    settlement.void_reason = (
        reason.strip()
        if reason and reason.strip()
        else None
    )

    db.commit()
    db.refresh(settlement)

    return settlement