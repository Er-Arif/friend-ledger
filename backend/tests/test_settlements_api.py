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
    }


def create_debt(
    client: TestClient,
    *,
    creditor: dict,
    debtor: dict,
    amount_minor: int,
) -> None:
    outing_response = client.post(
        "/api/v1/sessions",
        headers=headers(creditor),
        json={"name": "Settlement Test"},
    )

    assert outing_response.status_code == 201
    outing = outing_response.json()

    join_response = client.post(
        "/api/v1/sessions/join",
        headers=headers(debtor),
        json={"join_code": outing["join_code"]},
    )

    assert join_response.status_code == 200

    payment_response = client.post(
        f"/api/v1/sessions/{outing['id']}/payments",
        headers=headers(creditor),
        json={
            "description": "Dinner",
            "total_amount_minor": amount_minor,
            "split_type": "EQUAL",
            "participant_user_ids": [
                debtor["user"]["id"],
            ],
        },
    )

    assert payment_response.status_code == 201


def test_partial_settlement_reduces_balance(
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

    create_debt(
        client,
        creditor=arif,
        debtor=sameer,
        amount_minor=50000,
    )

    settlement_response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 30000,
            "method": "UPI",
            "note": "Partial repayment",
        },
    )

    assert settlement_response.status_code == 201

    response = client.get(
        f"/api/v1/me/balances/{arif['user']['id']}",
        headers=headers(sameer),
    )

    assert response.status_code == 200
    assert response.json()["direction"] == "I_OWE"
    assert response.json()["amount_minor"] == 20000


def test_full_settlement_clears_balance(
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

    create_debt(
        client,
        creditor=arif,
        debtor=sameer,
        amount_minor=50000,
    )

    response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 50000,
            "method": "CASH",
        },
    )

    assert response.status_code == 201

    balance = client.get(
        f"/api/v1/me/balances/{arif['user']['id']}",
        headers=headers(sameer),
    )

    assert balance.status_code == 200
    assert balance.json()["direction"] == "SETTLED"
    assert balance.json()["amount_minor"] == 0


def test_settlement_cannot_exceed_debt(
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

    create_debt(
        client,
        creditor=arif,
        debtor=sameer,
        amount_minor=50000,
    )

    response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 50001,
            "method": "UPI",
        },
    )

    assert response.status_code == 409
    assert (
        response.json()["error"]["code"]
        == "SETTLEMENT_EXCEEDS_DEBT"
    )


def test_cannot_settle_when_no_debt_exists(
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

    response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 1000,
            "method": "CASH",
        },
    )

    assert response.status_code == 409
    assert (
        response.json()["error"]["code"]
        == "NO_OUTSTANDING_DEBT"
    )


def test_non_creator_cannot_void_settlement(
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

    create_debt(
        client,
        creditor=arif,
        debtor=sameer,
        amount_minor=50000,
    )

    create_response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 20000,
            "method": "UPI",
        },
    )

    assert create_response.status_code == 201

    settlement_id = create_response.json()["id"]

    response = client.post(
        f"/api/v1/settlements/{settlement_id}/void",
        headers=headers(arif),
        json={"reason": "Trying to void"},
    )

    assert response.status_code == 403
    assert (
        response.json()["error"]["code"]
        == "SETTLEMENT_VOID_FORBIDDEN"
    )


def test_voiding_settlement_restores_debt(
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

    create_debt(
        client,
        creditor=arif,
        debtor=sameer,
        amount_minor=50000,
    )

    create_response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 30000,
            "method": "UPI",
        },
    )

    assert create_response.status_code == 201

    settlement_id = create_response.json()["id"]

    void_response = client.post(
        f"/api/v1/settlements/{settlement_id}/void",
        headers=headers(sameer),
        json={"reason": "Entered by mistake"},
    )

    assert void_response.status_code == 200
    assert void_response.json()["status"] == "VOIDED"

    balance = client.get(
        f"/api/v1/me/balances/{arif['user']['id']}",
        headers=headers(sameer),
    )

    assert balance.status_code == 200
    assert balance.json()["direction"] == "I_OWE"
    assert balance.json()["amount_minor"] == 50000


def test_settlement_appears_in_pairwise_ledger(
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

    create_debt(
        client,
        creditor=arif,
        debtor=sameer,
        amount_minor=50000,
    )

    settlement_response = client.post(
        "/api/v1/settlements",
        headers=headers(sameer),
        json={
            "to_user_id": arif["user"]["id"],
            "amount_minor": 15000,
            "method": "UPI",
            "note": "Paid via UPI",
        },
    )

    assert settlement_response.status_code == 201

    response = client.get(
        (
            "/api/v1/me/balances/"
            f"{arif['user']['id']}/ledger"
        ),
        headers=headers(sameer),
    )

    assert response.status_code == 200

    entries = response.json()["entries"]

    settlement_entries = [
        entry
        for entry in entries
        if entry["source_type"] == "SETTLEMENT"
    ]

    assert len(settlement_entries) == 1

    entry = settlement_entries[0]

    assert entry["settlement_id"] is not None
    assert entry["payment_id"] is None
    assert entry["session_id"] is None
    assert entry["direction"] == "SETTLED_BY_ME"
    assert entry["amount_minor"] == 15000
    assert entry["method"] == "UPI"
    assert entry["description"] == "Paid via UPI"