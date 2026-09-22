from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client: TestClient, username: str, display_name: str) -> dict:
    res = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": display_name,
            "username": username,
            "password": "Password123!",
        },
    )
    assert res.status_code == 201
    return res.json()


def test_save_valid_upi_id(client: TestClient) -> None:
    user = register(client, "arif_upi", "Arif Ali")
    token = user["access_token"]

    res = client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "arif@okaxis"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["upi_id"] == "arif@okaxis"

    # Verify GET /me also reflects it
    me_res = client.get("/api/v1/me", headers=auth_headers(token))
    assert me_res.status_code == 200
    assert me_res.json()["upi_id"] == "arif@okaxis"


def test_clear_upi_id(client: TestClient) -> None:
    user = register(client, "clear_upi_user", "Clear User")
    token = user["access_token"]

    # First set it
    client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "user@paytm"},
    )

    # Now clear it with null
    res = client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": None},
    )
    assert res.status_code == 200
    assert res.json()["upi_id"] is None

    # Verify empty string also clears it
    client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "user2@okhdfcbank"},
    )
    res2 = client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "   "},
    )
    assert res2.status_code == 200
    assert res2.json()["upi_id"] is None


def test_reject_malformed_upi_id(client: TestClient) -> None:
    user = register(client, "bad_upi_user", "Bad UPI")
    token = user["access_token"]

    # Contains space
    res = client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "bad user@axis"},
    )
    assert res.status_code == 422

    # Missing @ handle
    res = client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "plainusername"},
    )
    assert res.status_code == 422

    # Multiple @ symbols
    res = client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "first@second@bank"},
    )
    assert res.status_code == 422


def test_unauthenticated_upi_update_rejected(client: TestClient) -> None:
    res = client.patch("/api/v1/me/upi", json={"upi_id": "test@bank"})
    assert res.status_code == 401


def test_upi_audit_event_recorded(client: TestClient, db_session: Session) -> None:
    user = register(client, "audit_upi_user", "Audit User")
    token = user["access_token"]
    user_id = user["user"]["id"]

    client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(token),
        json={"upi_id": "secret_vpa@okhdfcbank"},
    )

    events = db_session.scalars(
        select(AuditEvent).where(
            AuditEvent.actor_user_id == user_id,
            AuditEvent.event_type == "UPI_ID_UPDATED",
        )
    ).all()

    assert len(events) >= 1
    event = events[-1]
    assert event.entity_type == "USER"
    assert str(event.entity_id) == user_id
    assert event.metadata_json.get("configured") is True
    # Ensure sensitive raw UPI ID is NOT stored in audit metadata
    assert "secret_vpa@okhdfcbank" not in str(event.metadata_json)


def test_counterparty_upi_id_in_pairwise_balance(client: TestClient) -> None:
    creditor = register(client, "creditor_user", "Creditor User")
    debtor = register(client, "debtor_user", "Debtor User")

    # Set creditor's UPI ID
    client.patch(
        "/api/v1/me/upi",
        headers=auth_headers(creditor["access_token"]),
        json={"upi_id": "creditor@okaxis"},
    )

    # Creditor creates session
    s_res = client.post(
        "/api/v1/sessions",
        headers=auth_headers(creditor["access_token"]),
        json={"name": "UPI Dinner"},
    )
    assert s_res.status_code == 201
    session_id = s_res.json()["id"]
    join_code = s_res.json()["join_code"]

    # Debtor joins session
    j_res = client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(debtor["access_token"]),
        json={"join_code": join_code},
    )
    assert j_res.status_code == 200

    # Creditor pays 1000 split equally with debtor (debtor owes creditor 500)
    p_res = client.post(
        f"/api/v1/sessions/{session_id}/payments",
        headers={
            **auth_headers(creditor["access_token"]),
            "Idempotency-Key": "pay-upi-test-1",
        },
        json={
            "description": "Dinner",
            "total_amount_minor": 100000,
            "split_type": "EQUAL",
            "participant_user_ids": [creditor["user"]["id"], debtor["user"]["id"]],
        },
    )
    assert p_res.status_code == 201

    # Debtor checks balance with creditor
    bal_res = client.get(
        f"/api/v1/me/balances/{creditor['user']['id']}",
        headers=auth_headers(debtor["access_token"]),
    )
    assert bal_res.status_code == 200
    bal_data = bal_res.json()
    assert bal_data["direction"] == "I_OWE"
    assert bal_data["amount_minor"] == 50000
    assert bal_data["counterparty_upi_id"] == "creditor@okaxis"

    # Debtor checks ledger with creditor
    ledger_res = client.get(
        f"/api/v1/me/balances/{creditor['user']['id']}/ledger",
        headers=auth_headers(debtor["access_token"]),
    )
    assert ledger_res.status_code == 200
    ledger_data = ledger_res.json()
    assert ledger_data["balance"]["counterparty_upi_id"] == "creditor@okaxis"
