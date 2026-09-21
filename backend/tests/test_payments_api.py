from uuid import uuid4

from fastapi.testclient import TestClient

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
        json={
            "name": "Mall Trip",
        },
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
        json={
            "join_code": join_code,
        },
    )

    assert response.status_code == 200


def test_create_equal_payment(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

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

    data = response.json()

    assert data["payer"]["username"] == "arif"
    assert data["description"] == "Dinner"
    assert data["total_amount_minor"] == 10000
    assert data["status"] == "ACTIVE"

    amounts = {
        share["username"]: share["amount_minor"]
        for share in data["shares"]
    }

    assert amounts == {
        "arif": 5000,
        "sameer": 5000,
    }


def test_payer_can_be_excluded_from_equal_split(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Sameer's Ticket",
            "total_amount_minor": 50000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                sameer["user"]["id"],
            ],
        },
    )

    assert response.status_code == 201

    shares = response.json()["shares"]

    assert len(shares) == 1
    assert shares[0]["username"] == "sameer"
    assert shares[0]["amount_minor"] == 50000


def test_personal_only_payment_is_rejected(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    outing = create_outing(client, arif)

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Personal Coffee",
            "total_amount_minor": 15000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_SPLIT"


def test_custom_split(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Shopping",
            "total_amount_minor": 100000,
            "split_type": "CUSTOM",
            "custom_shares": [
                {
                    "user_id": arif["user"]["id"],
                    "amount_minor": 25000,
                },
                {
                    "user_id": sameer["user"]["id"],
                    "amount_minor": 75000,
                },
            ],
        },
    )

    assert response.status_code == 201

    amounts = {
        share["username"]: share["amount_minor"]
        for share in response.json()["shares"]
    }

    assert amounts == {
        "arif": 25000,
        "sameer": 75000,
    }


def test_custom_split_wrong_total_is_rejected(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Dinner",
            "total_amount_minor": 10000,
            "split_type": "CUSTOM",
            "custom_shares": [
                {
                    "user_id": arif["user"]["id"],
                    "amount_minor": 1000,
                },
                {
                    "user_id": sameer["user"]["id"],
                    "amount_minor": 5000,
                },
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_SPLIT"


def test_left_participant_cannot_be_added_to_payment(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    leave = client.post(
        f"/api/v1/sessions/{outing['id']}/leave",
        headers=headers(sameer),
    )

    assert leave.status_code == 200

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Dinner after Sameer left",
            "total_amount_minor": 10000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
                sameer["user"]["id"],
            ],
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PARTICIPANT_NOT_ACTIVE"


def test_non_payer_cannot_void_payment(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    payment_response = client.post(
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

    assert payment_response.status_code == 201

    payment_id = payment_response.json()["id"]

    response = client.post(
        f"/api/v1/payments/{payment_id}/void",
        headers=headers(sameer),
        json={
            "reason": "Not my payment",
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PAYMENT_VOID_FORBIDDEN"


def test_payer_can_void_payment(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    payment_response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Wrong Dinner",
            "total_amount_minor": 10000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
                sameer["user"]["id"],
            ],
        },
    )

    assert payment_response.status_code == 201

    payment_id = payment_response.json()["id"]

    response = client.post(
        f"/api/v1/payments/{payment_id}/void",
        headers=headers(arif),
        json={
            "reason": "Entered wrong amount",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "VOIDED"
    assert response.json()["void_reason"] == "Entered wrong amount"


def test_closed_outing_rejects_new_payment(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif",
        username="arif",
    )

    outing = create_outing(client, arif)

    close_response = client.post(
        f"/api/v1/sessions/{outing['id']}/finish",
        headers=headers(arif),
    )

    assert close_response.status_code == 200

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
        json={
            "description": "Late Payment",
            "total_amount_minor": 10000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
            ],
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SESSION_CLOSED"


def test_session_payment_history(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    create_response = client.post(
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

    assert create_response.status_code == 201

    response = client.get(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
    )

    assert response.status_code == 200

    items = response.json()["items"]

    assert len(items) == 1
    assert items[0]["description"] == "Dinner"

def test_payment_idempotency_replays_same_result(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    request_headers = {
        **headers(arif),
        "Idempotency-Key": "payment-test-key-001",
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

    assert first.json()["id"] == second.json()["id"]

    history = client.get(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(arif),
    )

    assert history.status_code == 200
    assert len(history.json()["items"]) == 1


def test_payment_idempotency_key_cannot_be_reused_for_different_request(
    client: TestClient,
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

    join_outing(
        client,
        sameer,
        outing["join_code"],
    )

    request_headers = {
        **headers(arif),
        "Idempotency-Key": "payment-test-key-002",
    }

    first = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=request_headers,
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

    assert first.status_code == 201

    second = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=request_headers,
        json={
            "description": "Different Dinner",
            "total_amount_minor": 20000,
            "split_type": "EQUAL",
            "participant_user_ids": [
                arif["user"]["id"],
                sameer["user"]["id"],
            ],
        },
    )

    assert second.status_code == 409
    assert (
        second.json()["error"]["code"]
        == "IDEMPOTENCY_KEY_REUSED"
    )