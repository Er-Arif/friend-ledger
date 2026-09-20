from fastapi import APIRouter, Response, status

from app.api.deps import DbSession
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
)
from app.services.auth import (
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    db: DbSession,
) -> AuthResponse:
    user, access_token, refresh_token = register_user(
        db,
        display_name=payload.display_name,
        username=payload.username,
        password=payload.password,
    )

    return AuthResponse(
        user=user,
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    payload: LoginRequest,
    db: DbSession,
) -> AuthResponse:
    user, access_token, refresh_token = login_user(
        db,
        username=payload.username,
        password=payload.password,
    )

    return AuthResponse(
        user=user,
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/refresh",
    response_model=TokenPairResponse,
)
def refresh(
    payload: RefreshRequest,
    db: DbSession,
) -> TokenPairResponse:
    access_token, refresh_token = refresh_tokens(
        db,
        refresh_token=payload.refresh_token,
    )

    return TokenPairResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(
    payload: LogoutRequest,
    db: DbSession,
) -> Response:
    logout_user(
        db,
        refresh_token=payload.refresh_token,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)