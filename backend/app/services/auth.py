from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.auth_session import AuthSession
from app.models.user import User

settings = get_settings()


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def create_refresh_session(
    db: Session,
    user: User,
    *,
    device_label: str | None = None,
) -> str:
    refresh_token = generate_refresh_token()

    auth_session = AuthSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        device_label=device_label,
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.refresh_token_expire_days),
    )

    db.add(auth_session)

    return refresh_token


def register_user(
    db: Session,
    *,
    display_name: str,
    username: str,
    password: str,
) -> tuple[User, str, str]:
    normalized_username = normalize_username(username)

    existing_user = db.scalar(
        select(User).where(
            User.username_normalized == normalized_username,
        )
    )

    if existing_user is not None:
        raise AppError(
            code="USERNAME_TAKEN",
            message="This username is already taken.",
            status_code=409,
        )

    user = User(
        display_name=display_name.strip(),
        username=username.strip(),
        username_normalized=normalized_username,
        password_hash=hash_password(password),
    )

    db.add(user)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()

        raise AppError(
            code="USERNAME_TAKEN",
            message="This username is already taken.",
            status_code=409,
        ) from exc

    refresh_token = create_refresh_session(db, user)
    access_token = create_access_token(user.id)

    db.commit()
    db.refresh(user)

    return user, access_token, refresh_token


def login_user(
    db: Session,
    *,
    username: str,
    password: str,
) -> tuple[User, str, str]:
    normalized_username = normalize_username(username)

    user = db.scalar(
        select(User).where(
            User.username_normalized == normalized_username,
        )
    )

    if user is None or not verify_password(
        password,
        user.password_hash,
    ):
        raise AppError(
            code="INVALID_CREDENTIALS",
            message="Username or password is incorrect.",
            status_code=401,
        )

    if user.status != "ACTIVE":
        raise AppError(
            code="ACCOUNT_DISABLED",
            message="This account is disabled.",
            status_code=403,
        )

    refresh_token = create_refresh_session(db, user)
    access_token = create_access_token(user.id)

    db.commit()

    return user, access_token, refresh_token


def refresh_tokens(
    db: Session,
    *,
    refresh_token: str,
) -> tuple[str, str]:
    token_hash = hash_refresh_token(refresh_token)
    now = datetime.now(UTC)

    auth_session = db.scalar(
        select(AuthSession)
        .where(AuthSession.refresh_token_hash == token_hash)
        .with_for_update()
    )

    if auth_session is None or auth_session.revoked_at is not None:
        raise AppError(
            code="TOKEN_INVALID",
            message="Refresh token is invalid.",
            status_code=401,
        )

    if auth_session.expires_at <= now:
        raise AppError(
            code="TOKEN_EXPIRED",
            message="Refresh token has expired.",
            status_code=401,
        )

    user = db.get(User, auth_session.user_id)

    if user is None:
        raise AppError(
            code="TOKEN_INVALID",
            message="Refresh token is invalid.",
            status_code=401,
        )

    if user.status != "ACTIVE":
        raise AppError(
            code="ACCOUNT_DISABLED",
            message="This account is disabled.",
            status_code=403,
        )

    new_refresh_token = generate_refresh_token()

    auth_session.refresh_token_hash = hash_refresh_token(
        new_refresh_token
    )
    auth_session.last_used_at = now
    auth_session.expires_at = now + timedelta(
        days=settings.refresh_token_expire_days
    )

    access_token = create_access_token(user.id)

    db.commit()

    return access_token, new_refresh_token


def logout_user(
    db: Session,
    *,
    refresh_token: str,
) -> None:
    token_hash = hash_refresh_token(refresh_token)

    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == token_hash
        )
    )

    if auth_session is None:
        return

    if auth_session.revoked_at is None:
        auth_session.revoked_at = datetime.now(UTC)
        db.commit()