from fastapi.testclient import TestClient


def register_user(
    client: TestClient,
    *,
    display_name: str = "Arif Ali",
    username: str = "arif",
    password: str = "TestPassword123!",
):
    return client.post(
        "/api/v1/auth/register",
        json={
            "display_name": display_name,
            "username": username,
            "password": password,
        },
    )


def test_register_user(client: TestClient) -> None:
    response = register_user(client)

    assert response.status_code == 201

    data = response.json()

    assert data["user"]["display_name"] == "Arif Ali"
    assert data["user"]["username"] == "arif"

    assert data["access_token"]
    assert data["refresh_token"]
    assert data["token_type"] == "bearer"

    assert "password_hash" not in data["user"]
    assert "username_normalized" not in data["user"]


def test_username_uniqueness_is_case_insensitive(
    client: TestClient,
) -> None:
    first = register_user(
        client,
        username="Arif",
    )

    assert first.status_code == 201

    second = register_user(
        client,
        username="arif",
    )

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "USERNAME_TAKEN"


def test_login_and_me(client: TestClient) -> None:
    register_response = register_user(client)

    assert register_response.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "ARIF",
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    login_data = login_response.json()

    access_token = login_data["access_token"]

    me_response = client.get(
        "/api/v1/me",
        headers={
            "Authorization": f"Bearer {access_token}",
        },
    )

    assert me_response.status_code == 200

    me = me_response.json()

    assert me["display_name"] == "Arif Ali"
    assert me["username"] == "arif"


def test_invalid_password_is_rejected(
    client: TestClient,
) -> None:
    register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "arif",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


def test_refresh_rotates_refresh_token(
    client: TestClient,
) -> None:
    register_response = register_user(client)

    old_refresh_token = register_response.json()["refresh_token"]

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": old_refresh_token,
        },
    )

    assert refresh_response.status_code == 200

    data = refresh_response.json()

    assert data["access_token"]
    assert data["refresh_token"]
    assert data["refresh_token"] != old_refresh_token

    old_token_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": old_refresh_token,
        },
    )

    assert old_token_response.status_code == 401
    assert old_token_response.json()["error"]["code"] == "TOKEN_INVALID"


def test_logout_revokes_refresh_token(
    client: TestClient,
) -> None:
    register_response = register_user(client)

    refresh_token = register_response.json()["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert logout_response.status_code == 204

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={
            "refresh_token": refresh_token,
        },
    )

    assert refresh_response.status_code == 401
    assert refresh_response.json()["error"]["code"] == "TOKEN_INVALID"