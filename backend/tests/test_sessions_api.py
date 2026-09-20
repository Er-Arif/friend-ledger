from fastapi.testclient import TestClient


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
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 201

    return response.json()


def auth_headers(account: dict) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {account['access_token']}",
    }


def start_outing(
    client: TestClient,
    account: dict,
    *,
    name: str = "Sunday Mall",
) -> dict:
    response = client.post(
        "/api/v1/sessions",
        headers=auth_headers(account),
        json={
            "name": name,
        },
    )

    assert response.status_code == 201

    return response.json()


def test_create_outing_automatically_joins_creator(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    outing = start_outing(
        client,
        arif,
    )

    assert outing["name"] == "Sunday Mall"
    assert outing["status"] == "ACTIVE"
    assert len(outing["join_code"]) == 6
    assert outing["current_user"]["is_active"] is True

    detail = client.get(
        f"/api/v1/sessions/{outing['id']}",
        headers=auth_headers(arif),
    )

    assert detail.status_code == 200

    data = detail.json()

    assert len(data["active_participants"]) == 1
    assert data["active_participants"][0]["username"] == "arif"


def test_second_user_can_join_by_code(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = start_outing(
        client,
        arif,
    )

    response = client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(sameer),
        json={
            "join_code": outing["join_code"].lower(),
        },
    )

    assert response.status_code == 200
    assert response.json()["session"]["id"] == outing["id"]

    detail = client.get(
        f"/api/v1/sessions/{outing['id']}",
        headers=auth_headers(arif),
    )

    assert detail.status_code == 200

    usernames = {
        participant["username"]
        for participant in detail.json()["active_participants"]
    }

    assert usernames == {
        "arif",
        "sameer",
    }


def test_duplicate_active_join_is_rejected(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    outing = start_outing(
        client,
        arif,
    )

    response = client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(arif),
        json={
            "join_code": outing["join_code"],
        },
    )

    assert response.status_code == 409
    assert (
        response.json()["error"]["code"]
        == "ALREADY_ACTIVE_PARTICIPANT"
    )


def test_user_can_leave_and_rejoin(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = start_outing(
        client,
        arif,
    )

    join_response = client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(sameer),
        json={
            "join_code": outing["join_code"],
        },
    )

    assert join_response.status_code == 200

    leave_response = client.post(
        f"/api/v1/sessions/{outing['id']}/leave",
        headers=auth_headers(sameer),
    )

    assert leave_response.status_code == 200
    assert leave_response.json()["session_status"] == "ACTIVE"

    rejoin_response = client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(sameer),
        json={
            "join_code": outing["join_code"],
        },
    )

    assert rejoin_response.status_code == 200


def test_last_participant_leave_closes_outing(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    outing = start_outing(
        client,
        arif,
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/leave",
        headers=auth_headers(arif),
    )

    assert response.status_code == 200
    assert response.json()["session_status"] == "CLOSED"

    detail = client.get(
        f"/api/v1/sessions/{outing['id']}",
        headers=auth_headers(arif),
    )

    assert detail.status_code == 200
    assert detail.json()["status"] == "CLOSED"
    assert detail.json()["join_code"] is None


def test_cannot_join_closed_outing(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = start_outing(
        client,
        arif,
    )

    client.post(
        f"/api/v1/sessions/{outing['id']}/leave",
        headers=auth_headers(arif),
    )

    response = client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(sameer),
        json={
            "join_code": outing["join_code"],
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SESSION_CLOSED"


def test_cannot_finish_while_other_people_are_active(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = start_outing(
        client,
        arif,
    )

    client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(sameer),
        json={
            "join_code": outing["join_code"],
        },
    )

    response = client.post(
        f"/api/v1/sessions/{outing['id']}/finish",
        headers=auth_headers(arif),
    )

    assert response.status_code == 409
    assert (
        response.json()["error"]["code"]
        == "SESSION_FINISH_NOT_ALLOWED"
    )


def test_final_active_participant_can_finish(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    sameer = create_account(
        client,
        name="Sameer",
        username="sameer",
    )

    outing = start_outing(
        client,
        arif,
    )

    client.post(
        "/api/v1/sessions/join",
        headers=auth_headers(sameer),
        json={
            "join_code": outing["join_code"],
        },
    )

    leave_response = client.post(
        f"/api/v1/sessions/{outing['id']}/leave",
        headers=auth_headers(sameer),
    )

    assert leave_response.status_code == 200

    finish_response = client.post(
        f"/api/v1/sessions/{outing['id']}/finish",
        headers=auth_headers(arif),
    )

    assert finish_response.status_code == 200
    assert finish_response.json()["status"] == "CLOSED"


def test_outsider_cannot_view_outing(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    outsider = create_account(
        client,
        name="Rahul",
        username="rahul",
    )

    outing = start_outing(
        client,
        arif,
    )

    response = client.get(
        f"/api/v1/sessions/{outing['id']}",
        headers=auth_headers(outsider),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_sessions_list_contains_user_outings(
    client: TestClient,
) -> None:
    arif = create_account(
        client,
        name="Arif Ali",
        username="arif",
    )

    start_outing(
        client,
        arif,
        name="Sunday Mall",
    )

    start_outing(
        client,
        arif,
        name="Movie Night",
    )

    response = client.get(
        "/api/v1/sessions",
        headers=auth_headers(arif),
    )

    assert response.status_code == 200

    names = {
        item["name"]
        for item in response.json()["items"]
    }

    assert names == {
        "Sunday Mall",
        "Movie Night",
    }