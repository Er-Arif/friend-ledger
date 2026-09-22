import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.services.realtime import broadcast_event


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


def test_unauthenticated_ticket_request_rejected(client: TestClient) -> None:
    res = client.post("/api/v1/realtime/ticket")
    assert res.status_code == 401


def test_create_realtime_ticket(client: TestClient) -> None:
    user = register(client, "ws_user1", "WS User 1")
    token = user["access_token"]

    res = client.post("/api/v1/realtime/ticket", headers=auth_headers(token))
    assert res.status_code == 200
    data = res.json()
    assert "ticket" in data
    assert len(data["ticket"]) > 16
    assert data["expires_in"] == 60


def test_websocket_missing_ticket_rejected(client: TestClient) -> None:
    with (
        pytest.raises(WebSocketDisconnect) as exc_info,
        client.websocket_connect("/api/v1/realtime/ws"),
    ):
        pass
    assert exc_info.value.code == 1008


def test_websocket_invalid_ticket_rejected(client: TestClient) -> None:
    with (
        pytest.raises(WebSocketDisconnect) as exc_info,
        client.websocket_connect("/api/v1/realtime/ws?ticket=nonexistent-ticket"),
    ):
        pass
    assert exc_info.value.code == 1008


def test_websocket_valid_ticket_accepted_and_ticket_consumed_once(
    client: TestClient,
) -> None:
    user = register(client, "ws_user2", "WS User 2")
    token = user["access_token"]

    ticket_res = client.post("/api/v1/realtime/ticket", headers=auth_headers(token))
    ticket = ticket_res.json()["ticket"]

    # First connection with valid ticket succeeds and responds to ping
    with client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
        ws.send_text("ping")
        msg = ws.receive_text()
        assert msg == "pong"

    # Second connection using same ticket MUST be rejected (one-time use)
    with (
        pytest.raises(WebSocketDisconnect) as exc_info,
        client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}"),
    ):
        pass
    assert exc_info.value.code == 1008


def test_realtime_event_broadcast_to_target_user(client: TestClient) -> None:
    user_a = register(client, "ws_user_a", "Alice")
    user_b = register(client, "ws_user_b", "Bob")

    ticket_a = client.post(
        "/api/v1/realtime/ticket", headers=auth_headers(user_a["access_token"])
    ).json()["ticket"]

    with client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket_a}") as ws_a:
        # Broadcast event specifically targeting user_a
        from uuid import UUID
        broadcast_event(
            [UUID(user_a["user"]["id"])],
            {
                "type": "PAYMENT_CREATED",
                "session_id": "test-session-123",
            },
        )
        msg = ws_a.receive_json()
        assert msg["type"] == "PAYMENT_CREATED"
        assert msg["session_id"] == "test-session-123"

        # Broadcast event targeting user_b - ws_a should NOT receive it
        broadcast_event(
            [UUID(user_b["user"]["id"])],
            {
                "type": "PAYMENT_CREATED",
                "session_id": "private-to-bob",
            },
        )
        # Send a ping to verify connection is still responsive and only ping was next
        ws_a.send_text("ping")
        assert ws_a.receive_text() == "pong"
