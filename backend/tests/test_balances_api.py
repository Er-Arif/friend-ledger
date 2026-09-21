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
    *,
    name: str = "Outing",
) -> dict:
    response = client.post(
        "/api/v1/sessions",
        headers=headers(account),
        json={"name": name},
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


def create_equal_payment(
    client: TestClient,
    *,
    payer: dict,
    outing_id: str,
    participant_ids: list[str],
    amount_minor: int,
    description: str,
) -> dict:
    response = client.post(
        f"/api/v1/sessions/{outing_id}/payments",
        headers=headers(payer),
        json={
            "description": description,
            "total_amount_minor": amount_minor,
            "split_type": "EQUAL",
            "participant_user_ids": participant_ids,
        },
    )

    assert response.status_code == 201
    return response.json()


def test_balance_shows_amount_owed_to_me(
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
    join_outing(client, sameer, outing["join_code"])

    create_equal_payment(
        client,
        payer=arif,
        outing_id=outing["id"],
        participant_ids=[
            arif["user"]["id"],
            sameer["user"]["id"],
        ],
        amount_minor=10000,
        description="Dinner",
    )

    response = client.get(
        "/api/v1/me/balances",
        headers=headers(arif),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_i_owe_minor"] == 0
    assert data["total_owed_to_me_minor"] == 5000
    assert len(data["items"]) == 1

    item = data["items"][0]

    assert item["person"]["username"] == "sameer"
    assert item["direction"] == "OWED_TO_ME"
    assert item["amount_minor"] == 5000


def test_balance_from_debtors_view_is_i_owe(
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
    join_outing(client, sameer, outing["join_code"])

    create_equal_payment(
        client,
        payer=arif,
        outing_id=outing["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=8000,
        description="Ticket",
    )

    response = client.get(
        f"/api/v1/me/balances/{arif['user']['id']}",
        headers=headers(sameer),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["person"]["username"] == "arif"
    assert data["direction"] == "I_OWE"
    assert data["amount_minor"] == 8000


def test_opposite_debts_are_netted_pairwise(
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
    join_outing(client, sameer, outing["join_code"])

    create_equal_payment(
        client,
        payer=arif,
        outing_id=outing["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=10000,
        description="Dinner",
    )

    create_equal_payment(
        client,
        payer=sameer,
        outing_id=outing["id"],
        participant_ids=[arif["user"]["id"]],
        amount_minor=3000,
        description="Coffee",
    )

    response = client.get(
        f"/api/v1/me/balances/{sameer['user']['id']}",
        headers=headers(arif),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["direction"] == "OWED_TO_ME"
    assert data["amount_minor"] == 7000


def test_balances_aggregate_across_outings(
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

    first = create_outing(
        client,
        arif,
        name="Dinner",
    )
    join_outing(client, sameer, first["join_code"])

    create_equal_payment(
        client,
        payer=arif,
        outing_id=first["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=4000,
        description="Dinner",
    )

    second = create_outing(
        client,
        sameer,
        name="Movie",
    )
    join_outing(client, arif, second["join_code"])

    create_equal_payment(
        client,
        payer=arif,
        outing_id=second["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=6000,
        description="Movie",
    )

    response = client.get(
        f"/api/v1/me/balances/{sameer['user']['id']}",
        headers=headers(arif),
    )

    assert response.status_code == 200
    assert response.json()["amount_minor"] == 10000
    assert response.json()["direction"] == "OWED_TO_ME"


def test_voided_payment_is_excluded_from_balance(
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
    join_outing(client, sameer, outing["join_code"])

    payment = create_equal_payment(
        client,
        payer=arif,
        outing_id=outing["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=5000,
        description="Wrong Payment",
    )

    void_response = client.post(
        f"/api/v1/payments/{payment['id']}/void",
        headers=headers(arif),
        json={"reason": "Wrong entry"},
    )

    assert void_response.status_code == 200

    response = client.get(
        f"/api/v1/me/balances/{sameer['user']['id']}",
        headers=headers(arif),
    )

    assert response.status_code == 200
    assert response.json()["direction"] == "SETTLED"
    assert response.json()["amount_minor"] == 0


def test_pairwise_ledger_explains_balance(
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
    join_outing(client, sameer, outing["join_code"])

    create_equal_payment(
        client,
        payer=arif,
        outing_id=outing["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=10000,
        description="Dinner",
    )

    create_equal_payment(
        client,
        payer=sameer,
        outing_id=outing["id"],
        participant_ids=[arif["user"]["id"]],
        amount_minor=2500,
        description="Taxi",
    )

    response = client.get(
        (
            "/api/v1/me/balances/"
            f"{sameer['user']['id']}/ledger"
        ),
        headers=headers(arif),
    )

    assert response.status_code == 200

    data = response.json()

    assert data["balance"]["direction"] == "OWED_TO_ME"
    assert data["balance"]["amount_minor"] == 7500

    entries = {
        entry["description"]: entry
        for entry in data["entries"]
    }

    assert entries["Dinner"]["direction"] == "OWED_TO_ME"
    assert entries["Dinner"]["amount_minor"] == 10000

    assert entries["Taxi"]["direction"] == "I_OWE"
    assert entries["Taxi"]["amount_minor"] == 2500


def test_debts_are_not_transitively_simplified(
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
    imran = create_account(
        client,
        name="Imran",
        username="imran",
    )

    outing = create_outing(client, sameer)

    join_outing(client, arif, outing["join_code"])
    join_outing(client, imran, outing["join_code"])

    create_equal_payment(
        client,
        payer=sameer,
        outing_id=outing["id"],
        participant_ids=[arif["user"]["id"]],
        amount_minor=5000,
        description="Arif Expense",
    )

    create_equal_payment(
        client,
        payer=imran,
        outing_id=outing["id"],
        participant_ids=[sameer["user"]["id"]],
        amount_minor=5000,
        description="Sameer Expense",
    )

    response = client.get(
        "/api/v1/me/balances",
        headers=headers(arif),
    )

    assert response.status_code == 200

    items = response.json()["items"]

    assert len(items) == 1
    assert items[0]["person"]["username"] == "sameer"
    assert items[0]["direction"] == "I_OWE"
    assert items[0]["amount_minor"] == 5000