import contextlib
import json
from functools import lru_cache
from typing import Any

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Friend Ledger API"
    app_version: str = "0.1.0"
    app_env: str = "development"
    database_url: str
    test_database_url: str | None = None

    jwt_secret: SecretStr
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    cors_origins: list[str] | None = Field(default=None)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env.strip().lower() == "development"

    @property
    def is_test(self) -> bool:
        return self.app_env.strip().lower() in ("test", "testing")

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, value: str) -> str:
        cleaned = value.strip().lower()
        allowed = {
            "development",
            "dev",
            "test",
            "testing",
            "staging",
            "production",
            "prod",
        }
        if cleaned not in allowed:
            raise ValueError(
                f"Invalid APP_ENV '{value}'. Allowed: {sorted(allowed)}"
            )
        if cleaned in ("dev", "development"):
            return "development"
        if cleaned in ("test", "testing"):
            return "test"
        if cleaned in ("prod", "production"):
            return "production"
        return cleaned

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("DATABASE_URL cannot be empty.")
        if cleaned.startswith("postgresql://"):
            return cleaned.replace(
                "postgresql://", "postgresql+psycopg://", 1
            )
        if not cleaned.startswith("postgresql+psycopg://"):
            raise ValueError(
                "DATABASE_URL must be a PostgreSQL connection URL (e.g. postgresql+psycopg://...)"
            )
        return cleaned

    @field_validator("test_database_url", mode="before")
    @classmethod
    def validate_test_database_url(
        cls, value: str | None
    ) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if cleaned.startswith("postgresql://"):
            return cleaned.replace(
                "postgresql://", "postgresql+psycopg://", 1
            )
        if not cleaned.startswith("postgresql+psycopg://"):
            raise ValueError(
                "TEST_DATABASE_URL must be a PostgreSQL connection URL"
            )
        return cleaned

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str] | None:
        if value is None:
            return None
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("[") and value.endswith("]"):
                with contextlib.suppress(
                    json.JSONDecodeError, TypeError, ValueError
                ):
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return [
                            str(item).strip()
                            for item in parsed
                            if str(item).strip()
                        ]
            return [
                item.strip()
                for item in value.split(",")
                if item.strip()
            ]
        if isinstance(value, (list, tuple, set)):
            return [
                str(item).strip()
                for item in value
                if str(item).strip()
            ]
        return []

    @model_validator(mode="after")
    def validate_invariants(self) -> "Settings":
        # Database URL separation: test database must not overwrite dev/prod database
        if (
            self.test_database_url
            and self.database_url == self.test_database_url
        ):
            raise ValueError(
                "TEST_DATABASE_URL cannot be identical to DATABASE_URL to protect data integrity."
            )

        # Default CORS origins safely
        if self.cors_origins is None:
            if self.is_production:
                self.cors_origins = []
            else:
                self.cors_origins = ["*"]

        # Production specific security checks
        if self.is_production:
            if any(origin == "*" for origin in self.cors_origins):
                raise ValueError(
                    "Wildcard CORS origins ('*') are strictly prohibited in production environment."
                )

            secret = self.jwt_secret.get_secret_value()
            if (
                secret.lower()
                in (
                    "change_me",
                    "secret",
                    "password",
                    "test",
                )
                or "change_me" in secret.lower()
            ):
                raise ValueError(
                    "JWT_SECRET cannot be a trivial or placeholder value in production."
                )
            if len(secret) < 32:
                raise ValueError(
                    "JWT_SECRET must be at least 32 characters in production."
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()