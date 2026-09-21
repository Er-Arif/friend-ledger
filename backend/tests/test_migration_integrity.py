from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from alembic import command
from app.core.config import get_settings


def test_migration_chain_from_zero() -> None:
    settings = get_settings()
    assert settings.test_database_url is not None

    schema_name = "migration_zero_test"
    engine = create_engine(settings.test_database_url)

    # Clean previous schema if exists, then create fresh test schema
    with engine.begin() as conn:
        conn.execute(
            text(
                f"DROP SCHEMA IF EXISTS {schema_name} CASCADE; "
                f"CREATE SCHEMA {schema_name};"
            )
        )

    try:
        cfg = Config("alembic.ini")
        # Direct Alembic to use the clean isolated schema
        schema_url = (
            f"{settings.test_database_url}?options=-csearch_path%3D{schema_name}"
        ).replace("%", "%%")
        cfg.set_main_option("sqlalchemy.url", schema_url)

        # 1. Upgrade from base to head
        command.upgrade(cfg, "head")

        # Verify all expected tables exist in the schema
        with engine.begin() as conn:
            result = conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    f"WHERE table_schema = '{schema_name}' ORDER BY table_name;"
                )
            )
            created_tables = {row[0] for row in result.fetchall()}

        expected_tables = {
            "alembic_version",
            "users",
            "sessions",
            "session_participations",
            "auth_sessions",
            "payments",
            "payment_shares",
            "settlements",
            "idempotency_records",
            "audit_events",
        }
        assert expected_tables.issubset(created_tables), (
            f"Missing tables: {expected_tables - created_tables}"
        )

        # Verify current revision matches head in script directory
        script_dir = ScriptDirectory.from_config(cfg)
        head_rev = script_dir.get_current_head()

        with engine.begin() as conn:
            current_rev = conn.execute(
                text(f"SELECT version_num FROM {schema_name}.alembic_version;")
            ).scalar_one()

        assert current_rev == head_rev

        # 2. Test downgrade of the latest revision
        command.downgrade(cfg, "686f8285d015")

        with engine.begin() as conn:
            downgraded_rev = conn.execute(
                text(f"SELECT version_num FROM {schema_name}.alembic_version;")
            ).scalar_one()
            table_check = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    f"WHERE table_schema = '{schema_name}' AND table_name = 'audit_events';"
                )
            ).scalar_one()

        assert downgraded_rev == "686f8285d015"
        assert table_check == 0  # audit_events should be dropped

        # 3. Upgrade back to head
        command.upgrade(cfg, "head")

        with engine.begin() as conn:
            upgraded_rev = conn.execute(
                text(f"SELECT version_num FROM {schema_name}.alembic_version;")
            ).scalar_one()
            table_check_restored = conn.execute(
                text(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    f"WHERE table_schema = '{schema_name}' AND table_name = 'audit_events';"
                )
            ).scalar_one()

        assert upgraded_rev == head_rev
        assert table_check_restored == 1

    finally:
        with engine.begin() as conn:
            conn.execute(
                text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;")
            )
