import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_creates_business_and_admin_user(client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    payload = {
        "business_name": f"Sharma Furniture {uid}",
        "email": f"sharma_{uid}@example.com",
        "password": "SecurePassword123!",
        "full_name": "Rajesh Sharma",
        "phone": "9876543210",
    }
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == payload["email"]
    assert data["user"]["role"] == "admin"
    assert data["business"]["name"] == payload["business_name"]


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    payload = {
        "business_name": f"Store {uid}",
        "email": f"duplicate_{uid}@example.com",
        "password": "Password123!",
        "full_name": "Owner",
    }
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409
    assert "already registered" in r2.json()["error"]["message"]


@pytest.mark.asyncio
async def test_register_missing_fields_returns_422(client: AsyncClient):
    payload = {"business_name": "Incomplete Store"}
    res = await client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_login_valid_credentials_returns_tokens(client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_{uid}@example.com"
    pwd = "ValidPassword123!"

    reg = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop {uid}", "email": email, "password": pwd, "full_name": "User"},
    )
    assert reg.status_code == 201

    login = await client.post("/api/v1/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200
    data = login.json()["data"]
    assert "access_token" in data
    assert data["user"]["email"] == email


@pytest.mark.asyncio
async def test_login_invalid_password_returns_401(client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_{uid}@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop {uid}", "email": email, "password": "CorrectPassword123!", "full_name": "User"},
    )
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword"})
    assert login.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_email_returns_401(client: AsyncClient):
    login = await client.post(
        "/api/v1/auth/login", json={"email": "nonexistent_email@random.com", "password": "any"}
    )
    assert login.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user_and_business(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    res = await client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["user"]["email"] == admin_auth["user"]["email"]
    assert data["business"]["id"] == admin_auth["business"]["id"]
    assert data["role"]["name"] == "admin"


@pytest.mark.asyncio
async def test_me_without_token_returns_401(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 403 or res.status_code == 401


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    email = admin_auth["user"]["email"]
    old_pwd = "Password123!"
    new_pwd = "NewPassword456!"

    res = await client.put(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": old_pwd, "new_password": new_pwd},
    )
    assert res.status_code == 200

    # Verify can login with new password
    login_new = await client.post("/api/v1/auth/login", json={"email": email, "password": new_pwd})
    assert login_new.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current_password(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    res = await client.put(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "WrongOldPassword", "new_password": "NewPassword456!"},
    )
    assert res.status_code == 400
