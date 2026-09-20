from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.user import UserRead

USERNAME_PATTERN = r"^[A-Za-z0-9._-]+$"


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str = Field(min_length=1, max_length=80)
    username: str = Field(
        min_length=3,
        max_length=40,
        pattern=USERNAME_PATTERN,
    )
    password: str = Field(min_length=8, max_length=128)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Display name cannot be blank")
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class AuthResponse(BaseModel):
    user: UserRead
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"