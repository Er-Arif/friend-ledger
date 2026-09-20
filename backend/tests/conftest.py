from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

settings = get_settings()

if settings.test_database_url is None:
    raise RuntimeError(
        "TEST_DATABASE_URL must be configured before running tests."
    )

test_engine = create_engine(
    settings.test_database_url,
    pool_pre_ping=True,
)


@pytest.fixture(scope="session", autouse=True)
def prepare_test_database() -> Iterator[None]:
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Iterator[Session]:
    connection = test_engine.connect()
    transaction = connection.begin()

    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()