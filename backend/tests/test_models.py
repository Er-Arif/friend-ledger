from sqlalchemy.orm import configure_mappers

import app.models  # noqa: F401
from app.db.base import Base


def test_core_tables_registered() -> None:
    assert {
        "users",
        "auth_sessions",
        "idempotency_records",
        "sessions",
        "session_participations",
        "payments",
        "payment_shares",
        "audit_events",
    }.issubset(Base.metadata.tables)


def test_orm_mappers_configure_successfully() -> None:
    configure_mappers()