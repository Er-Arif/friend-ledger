from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.audit_event import AuditEvent

PASSWORD = "TestPassword123!"


def create_account(
    client: TestClient,
    *,
    name: str,
    username: str,
) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": name,
            "username": username,
            "password": PASSWORD,
        },
    )

    assert response.status_code == 201
    return response.json()


def headers(account: dict) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {account['access_token']}",
        "Idempotency-Key": str(uuid4()),
    }


def create_outing(
    client: TestClient,
    account: dict,
) -> dict:
    response = client.post(
        "/api/v1/sessions",
        headers=headers(account),
        json={"name": "Audit Test"},
    )

    assert response.status_code == 201
    return response.json()


def join_outing(
    client: TestClient,
    account: dict,
    join_code: str,
) -> None:
    response = client.post(
        "/api/v1/sessions/join",
        headers=headers(account),
        json={"join_code": join_code},
    )

    assert response.status_code == 200


def test_payment_creation_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )
    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(client, arif)
    join_outing(client, sameer, outing["join_code"])

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Dinner",
            "total_amount_minor": 10000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
                sameer["user"]["id"],
            ],
        },
    )

    assert response.status_code == 201

    payment_id = response.json()["id"]

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "PAYMENT_CREATED",
            AuditEvent.entity_id == payment_id,
        )
    )

    assert event is not None
    assert str(event.actor_user_id) == arif["user"]["id"]
    assert event.entity_type == "PAYMENT"
    assert str(event.session_id) == outing["id"]
    assert event.metadata_json["total_amount_minor"] == 10000
    assert event.metadata_json["split_type"] == "EQUAL"


def test_payment_void_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )
    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(client, arif)
    join_outing(client, sameer, outing["join_code"])

    payment = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Dinner",
            "total_amount_minor": 10000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
                sameer["user"]["id"],
            ],
        },
    )

    assert payment.status_code == 201

    payment_id = payment.json()["id"]

    response = client.post(
        f"/api/v1/payments/{payment_id}/void",
        headers=headers(arif),
        json={
            "reason": "Wrong amount",
        },
    )

    assert response.status_code == 200

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "PAYMENT_VOIDED",
            AuditEvent.entity_id == payment_id,
        )
    )

    assert event is not None
    assert event.metadata_json["reason"] == "Wrong amount"


def test_settlement_creation_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )
    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(client, arif)
    join_outing(client, sameer, outing["join_code"])

    payment = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Dinner",
            "total_amount_minor": 50000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                sameer["user"]["id"],
            ],
        },
    )

    assert payment.status_code == 201

    response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 20000,
            "method": "UPI",
        },
    )

    assert response.status_code == 201

    settlement_id = response.json()["id"]

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "SETTLEMENT_CREATED",
            AuditEvent.entity_id == settlement_id,
        )
    )

    assert event is not None
    assert str(event.actor_user_id) == sameer["user"]["id"]
    assert event.entity_type == "SETTLEMENT"
    assert event.metadata_json["amount_minor"] == 20000
    assert event.metadata_json["method"] == "UPI"


def test_settlement_void_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )
    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(client, arif)
    join_outing(client, sameer, outing["join_code"])

    payment = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Dinner",
            "total_amount_minor": 50000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                sameer["user"]["id"],
            ],
        },
    )

    assert payment.status_code == 201

    settlement = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 20000,
            "method": "CASH",
        },
    )

    assert settlement.status_code == 201

    settlement_id = settlement.json()["id"]

    response = client.post(
        f"/api/v1/settlements/{settlement_id}/void",
        headers=headers(sameer),
        json={
            "reason": "Wrong settlement",
        },
    )

    assert response.status_code == 200

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "SETTLEMENT_VOIDED",
            AuditEvent.entity_id == settlement_id,
        )
    )

    assert event is not None
    assert event.metadata_json["reason"] == "Wrong settlement"


def test_idempotent_replay_does_not_create_duplicate_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )
    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(client, arif)
    join_outing(client, sameer, outing["join_code"])

    request_headers = {
        **headers(arif),
        "Idempotency-Key": "audit-payment-replay-001",
    }

    payload = {
        "description": "Dinner",
        "total_amount_minor": 10000,
        "split_type": "EQUAL",
        "participant_user_ids": [
            arif["user"]["id"],
            sameer["user"]["id"],
        ],
    }

    first = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=request_headers,
        json=payload,
    )

    second = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=request_headers,
        json=payload,
    )

    assert first.status_code == 201
    assert second.status_code == 201

    payment_id = first.json()["id"]

    events = list(
        db_session.scalars(
            select(AuditEvent).where(
                AuditEvent.event_type == "PAYMENT_CREATED",
                AuditEvent.entity_id == payment_id,
            )
        )
    )

    assert len(events) == 1
def test_session_creation_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    outing = create_outing(
        client,
        arif,
    )

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "SESSION_CREATED",
        )
    )

    assert event is not None
    assert str(event.actor_user_id) == arif["user"]["id"]
    assert str(event.entity_id) == outing["id"]
    assert str(event.session_id) == outing["id"]
    assert event.entity_type == "SESSION"


def test_session_join_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(
        client,
        arif,
    )

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "SESSION_JOINED",
        )
    )

    assert event is not None
    assert str(event.actor_user_id) == sameer["user"]["id"]
    assert str(event.session_id) == outing["id"]
    assert event.metadata_json["participation_id"]


def test_session_leave_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = create_outing(
        client,
        arif,
    )

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/leave",
        headers=headers(sameer),
    )

    assert response.status_code == 200

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "SESSION_LEFT",
            AuditEvent.actor_user_id
            == sameer["user"]["id"],
        )
    )

    assert event is not None
    assert str(event.session_id) == outing["id"]
    assert event.metadata_json["session_status"] == "ACTIVE"
    assert event.metadata_json["auto_closed"] is False


def test_session_finish_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    outing = create_outing(
        client,
        arif,
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/finish",
        headers=headers(arif),
    )

    assert response.status_code == 200

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "SESSION_FINISHED",
        )
    )

    assert event is not None
    assert str(event.actor_user_id) == arif["user"]["id"]
    assert str(event.session_id) == outing["id"]
    assert event.metadata_json["closed_at"] is not None
    
def test_registration_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "USER_REGISTERED",
            AuditEvent.entity_id
            == arif["user"]["id"],
        )
    )

    assert event is not None
    assert str(event.actor_user_id) == arif["user"]["id"]
    assert event.entity_type == "USER"
    assert event.metadata_json["username"] == "arif"


def test_login_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    account = create_account(
        client,
        name="Arif",
        username="arif",
    )

    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "arif",
            "password": PASSWORD,
        },
    )

    assert response.status_code == 200

    events = list(
        db_session.scalars(
            select(AuditEvent).where(
                AuditEvent.event_type
                == "LOGIN_SUCCEEDED",
                AuditEvent.entity_id
                == account["user"]["id"],
            )
        )
    )

    assert len(events) == 1


def test_refresh_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    account = create_account(
        client,
        name="Arif",
        username="arif",
    )

    response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": (
                account["refresh_token"]
            ),
        },
    )

    assert response.status_code == 200

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type
            == "TOKEN_REFRESHED",
            AuditEvent.entity_id
            == account["user"]["id"],
        )
    )

    assert event is not None


def test_logout_records_audit_event(
    client: TestClient,
    db_session,
) -> None:
    account = create_account(
        client,
        name="Arif",
        username="arif",
    )

    response = client.post(
        "/api/v1/auth/logout",
        json={
            "refresh_token": (
                account["refresh_token"]
            ),
        },
    )

    assert response.status_code == 204

    event = db_session.scalar(
        select(AuditEvent).where(
            AuditEvent.event_type == "LOGOUT",
            AuditEvent.entity_id
            == account["user"]["id"],
        )
    )

    assert event is not None