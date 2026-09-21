from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "friend-ledger-api",
    }


def test_health_liveness(client: TestClient) -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "friend-ledger-api",
    }


def test_health_readiness_healthy(client: TestClient) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "friend-ledger-api",
        "database": "reachable",
    }


def test_health_readiness_unhealthy() -> None:
    mock_db = MagicMock()
    mock_db.execute.side_effect = OperationalError(
        "connection timeout to postgresql://supersecret:superpass@internal.db:5432",
        params=None,
        orig=Exception("internal error"),
    )

    def failing_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = failing_get_db

    try:
        with TestClient(app) as test_client:
            response = test_client.get("/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data == {
            "status": "unhealthy",
            "service": "friend-ledger-api",
            "database": "unreachable",
        }
        # Ensure no internal details or credentials leaked
        assert "supersecret" not in str(data)
        assert "internal" not in str(data)
        assert "connection" not in str(data)
    finally:
        app.dependency_overrides.clear()