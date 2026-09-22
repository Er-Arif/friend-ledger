import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings


def test_settings_database_url_normalization() -> None:
    settings = Settings(
        database_url="postgresql://user:pass@127.0.0.1:5432/testdb",
        test_database_url="postgresql://user:pass@127.0.0.1:5432/other_testdb",
        jwt_secret=SecretStr("supersecretkeythatislongerthan32characters!"),
        app_env="development",
    )
    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.test_database_url is not None
    assert settings.test_database_url.startswith("postgresql+psycopg://")

    # Verify postgres:// scheme as used by Railway / cloud providers
    railway_style_settings = Settings(
        database_url="postgres://user:pass@roundhouse.proxy.rlwy.net:12345/railway",
        test_database_url="postgres://user:pass@roundhouse.proxy.rlwy.net:12345/test",
        jwt_secret=SecretStr("supersecretkeythatislongerthan32characters!"),
        app_env="development",
    )
    assert railway_style_settings.database_url.startswith("postgresql+psycopg://")
    assert railway_style_settings.test_database_url is not None
    assert railway_style_settings.test_database_url.startswith("postgresql+psycopg://")


def test_settings_rejects_empty_database_url() -> None:
    with pytest.raises(ValidationError):
        Settings(
            database_url="",
            jwt_secret=SecretStr("supersecretkeythatislongerthan32characters!"),
        )


def test_settings_rejects_identical_database_and_test_database_url() -> None:
    same_url = "postgresql+psycopg://user:pass@127.0.0.1:5432/db"
    with pytest.raises(ValidationError, match="TEST_DATABASE_URL cannot be identical"):
        Settings(
            database_url=same_url,
            test_database_url=same_url,
            jwt_secret=SecretStr("supersecretkeythatislongerthan32characters!"),
            app_env="development",
        )


def test_settings_production_wildcard_cors_prohibited() -> None:
    with pytest.raises(ValidationError, match="Wildcard CORS origins"):
        Settings(
            database_url="postgresql+psycopg://user:pass@127.0.0.1:5432/proddb",
            test_database_url="postgresql+psycopg://user:pass@127.0.0.1:5432/testdb",
            jwt_secret=SecretStr("supersecretkeythatislongerthan32characters!"),
            app_env="production",
            cors_origins=["*"],
        )


def test_settings_production_weak_secret_prohibited() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET must be at least 32 characters"):
        Settings(
            database_url="postgresql+psycopg://user:pass@127.0.0.1:5432/proddb",
            jwt_secret=SecretStr("short"),
            app_env="production",
            cors_origins=["https://friendledger.com"],
        )

    with pytest.raises(ValidationError, match="trivial or placeholder"):
        Settings(
            database_url="postgresql+psycopg://user:pass@127.0.0.1:5432/proddb",
            jwt_secret=SecretStr("CHANGE_ME"),
            app_env="production",
            cors_origins=["https://friendledger.com"],
        )


def test_settings_cors_origins_parsing() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@127.0.0.1:5432/devdb",
        jwt_secret=SecretStr("supersecretkeythatislongerthan32characters!"),
        app_env="development",
        cors_origins="https://app.friendledger.com, https://admin.friendledger.com",
    )
    assert settings.cors_origins == [
        "https://app.friendledger.com",
        "https://admin.friendledger.com",
    ]
