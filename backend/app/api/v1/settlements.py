from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.models.settlement import Settlement
from app.models.user import User
from app.schemas.settlement import (
    SettlementCreateRequest,
    SettlementRead,
    SettlementUserRead,
    SettlementVoidRequest,
)
from app.services.settlements import (
    create_settlement,
    void_settlement,
)

router = APIRouter(
    prefix="/settlements",
    tags=["Settlements"],
)


def build_user(user: User) -> SettlementUserRead:
    return SettlementUserRead(
        user_id=user.id,
        display_name=user.display_name,
        username=user.username,
    )


def build_settlement_response(
    db: DbSession,
    settlement: Settlement,
) -> SettlementRead:
    from_user = db.get(
        User,
        settlement.from_user_id,
    )

    to_user = db.get(
        User,
        settlement.to_user_id,
    )

    assert from_user is not None
    assert to_user is not None

    return SettlementRead(
        id=settlement.id,
        from_user=build_user(from_user),
        to_user=build_user(to_user),
        amount_minor=settlement.amount_minor,
        method=settlement.method,
        note=settlement.note,
        status=settlement.status,
        created_at=settlement.created_at,
        voided_at=settlement.voided_at,
        void_reason=settlement.void_reason,
    )


@router.post(
    "",
    response_model=SettlementRead,
    status_code=status.HTTP_201_CREATED,
)
def record_settlement(
    payload: SettlementCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> SettlementRead:
    settlement = create_settlement(
        db,
        from_user=current_user,
        to_user_id=payload.to_user_id,
        amount_minor=payload.amount_minor,
        method=payload.method,
        note=payload.note,
    )

    return build_settlement_response(
        db,
        settlement,
    )


@router.post(
    "/{settlement_id}/void",
    response_model=SettlementRead,
)
def void_existing_settlement(
    settlement_id: UUID,
    payload: SettlementVoidRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> SettlementRead:
    settlement = void_settlement(
        db,
        settlement_id=settlement_id,
        user=current_user,
        reason=payload.reason,
    )

    return build_settlement_response(
        db,
        settlement,
    )