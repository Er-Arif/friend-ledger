from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.user import UserRead

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