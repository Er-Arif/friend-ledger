import app.models  # noqa: F401
from app.db.base import Base


def test_core_tables_registered() -> None:
    assert {
        "users",
        "auth_sessions",
        "sessions",
        "session_participations",
    }.issubset(Base.metadata.tables)