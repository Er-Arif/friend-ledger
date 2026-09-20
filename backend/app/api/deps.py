from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

DbSession = Annotated[Session, Depends(get_db)]

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> User:
    if credentials is None:
        raise AppError(
            code="AUTH_REQUIRED",
            message="Authentication is required.",
            status_code=401,
        )

    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise AppError(
            code="TOKEN_INVALID",
            message="Access token is invalid or expired.",
            status_code=401,
        ) from exc

    user = db.get(User, user_id)

    if user is None:
        raise AppError(
            code="TOKEN_INVALID",
            message="Access token is invalid.",
            status_code=401,
        )

    if user.status != "ACTIVE":
        raise AppError(
            code="ACCOUNT_DISABLED",
            message="This account is disabled.",
            status_code=403,
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]