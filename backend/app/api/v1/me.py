from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.user import UserRead, UserUpiUpdateRequest
from app.services.audit import record_audit_event
from app.services.realtime import broadcast_event

router = APIRouter(
    tags=["Account"],
)


@router.get(
    "/me",
    response_model=UserRead,
)
def get_me(
    current_user: CurrentUser,
) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch(
    "/me/upi",
    response_model=UserRead,
)
def update_my_upi(
    payload: UserUpiUpdateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> UserRead:
    current_user.upi_id = payload.upi_id
    db.add(current_user)

    record_audit_event(
        db,
        actor_user_id=current_user.id,
        event_type="UPI_ID_UPDATED",
        entity_type="USER",
        entity_id=current_user.id,
        metadata={
            "configured": current_user.upi_id is not None,
        },
    )

    db.commit()
    db.refresh(current_user)

    # Invalidate user profile in realtime
    broadcast_event(
        [current_user.id],
        {
            "type": "UPI_PROFILE_UPDATED",
            "user_id": str(current_user.id),
        },
    )

    return UserRead.model_validate(current_user)