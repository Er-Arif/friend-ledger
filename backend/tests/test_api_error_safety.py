from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.exc import ProgrammingError

from app.db.session import get_db
from app.main import app

PASSWORD = "TestPassword123!"


def register_user(client: TestClient, username: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": username.title(),
            "username": username,
            "password": PASSWORD,
        },
    )
    assert response.status_code == 201
    return response.json()


def auth_headers(account: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {account['access_token']}"}


def test_unhandled_database_error_returns_structured_json_without_leaks(
    client: TestClient,
) -> None:
    def failing_get_db():
        from unittest.mock import MagicMock

        mock_session = MagicMock()
        mock_session.get.side_effect = ProgrammingError(
            "SELECT * FROM secrets WHERE key='sensitive_db_password'",
            params=None,
            orig=Exception("internal error"),
        )
        yield mock_session

    app.dependency_overrides[get_db] = failing_get_db

    from app.core.security import create_access_token

    token = create_access_token(uuid4())

    try:
        with TestClient(app) as test_client:
            response = test_client.get(
                "/api/v1/sessions/00000000-0000-0000-0000-000000000001",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 500
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "INTERNAL_ERROR"
        assert "request_id" in data
        assert "sensitive_db_password" not in str(data)
        assert "SELECT * FROM secrets" not in str(data)
    finally:
        app.dependency_overrides.clear()


def test_nonexistent_route_returns_structured_resource_not_found(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/nonexistent/route")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert "request_id" in data


def test_financial_endpoints_require_idempotency_key(
    client: TestClient,
) -> None:
    user = register_user(client, "idemp_user")
    headers = auth_headers(user)

    # 1. Payment creation requires Idempotency-Key
    fake_session_id = str(uuid4())
    resp = client.post(
        f"/api/v1/sessions/{fake_session_id}/payments",
        headers=headers,
        json={
            "description": "Coffee",
            "total_amount_minor": 5000,
            "split_type": "EQUAL",
            "participant_user_ids": [user["user"]["id"]],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    # Ensure error indicates missing Idempotency-Key
    locs = [
        item["location"] for item in resp.json()["error"]["details"]["fields"]
    ]
    assert any("idempotency-key" in [str(x).lower() for x in loc] for loc in locs)

    # 2. Payment void requires Idempotency-Key
    fake_payment_id = str(uuid4())
    resp = client.post(
        f"/api/v1/payments/{fake_payment_id}/void",
        headers=headers,
        json={"reason": "mistake"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    # 3. Settlement creation requires Idempotency-Key
    resp = client.post(
        "/api/v1/settlements",
        headers=headers,
        json={
            "to_user_id": str(uuid4()),
            "amount_minor": 1000,
            "method": "CASH",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    # 4. Settlement void requires Idempotency-Key
    fake_settlement_id = str(uuid4())
    resp = client.post(
        f"/api/v1/settlements/{fake_settlement_id}/void",
        headers=headers,
        json={"reason": "duplicate"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_get_endpoints_do_not_require_idempotency_key(
    client: TestClient,
) -> None:
    user = register_user(client, "get_user")
    headers = auth_headers(user)

    # All GET endpoints succeed or return valid status without Idempotency-Key
    resp = client.get("/api/v1/sessions", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/v1/me", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/v1/me/balances", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/health")
    assert resp.status_code == 200


def test_cors_headers_handling(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
