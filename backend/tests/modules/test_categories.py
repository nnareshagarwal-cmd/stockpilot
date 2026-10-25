import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_category_success(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    res = await client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Furniture", "code": "FURN", "sort_order": 1},
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["name"] == "Furniture"
    assert data["code"] == "FURN"


@pytest.mark.asyncio
async def test_create_subcategory_with_parent(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    r_parent = await client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Lighting"},
    )
    parent_id = r_parent.json()["data"]["id"]

    r_child = await client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "LED Lights", "parent_id": parent_id},
    )
    assert r_child.status_code == 201
    assert r_child.json()["data"]["parent_id"] == parent_id


@pytest.mark.asyncio
async def test_create_duplicate_category_returns_409(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    await client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Tables"},
    )
    dup = await client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Tables"},
    )
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_list_categories_tree_format(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    rp = await client.post("/api/v1/categories", headers=headers, json={"name": "Living Room"})
    pid = rp.json()["data"]["id"]
    await client.post("/api/v1/categories", headers=headers, json={"name": "Sofas", "parent_id": pid})

    tree_res = await client.get("/api/v1/categories?format=tree", headers=headers)
    assert tree_res.status_code == 200
    tree = tree_res.json()["data"]
    lr = next((item for item in tree if item["name"] == "Living Room"), None)
    assert lr is not None
    assert any(child["name"] == "Sofas" for child in lr["children"])


@pytest.mark.asyncio
async def test_update_category(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    r = await client.post("/api/v1/categories", headers=headers, json={"name": "Old Category"})
    cid = r.json()["data"]["id"]

    up = await client.put(
        f"/api/v1/categories/{cid}",
        headers=headers,
        json={"name": "Updated Category"},
    )
    assert up.status_code == 200
    assert up.json()["data"]["name"] == "Updated Category"


@pytest.mark.asyncio
async def test_archive_category(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    r = await client.post("/api/v1/categories", headers=headers, json={"name": "To Archive"})
    cid = r.json()["data"]["id"]

    del_res = await client.delete(f"/api/v1/categories/{cid}", headers=headers)
    assert del_res.status_code == 200

    # Verify inactive
    get_res = await client.get(f"/api/v1/categories/{cid}", headers=headers)
    assert get_res.json()["data"]["is_active"] is False


@pytest.mark.asyncio
async def test_create_category_rejects_parent_from_another_tenant(client: AsyncClient):
    # Register Tenant A
    uid_a = uuid.uuid4().hex[:8]
    r_a = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop A {uid_a}", "email": f"a_{uid_a}@test.com", "password": "Password123!", "full_name": "Admin A"},
    )
    token_a = r_a.json()["data"]["access_token"]
    cat_a = await client.post(
        "/api/v1/categories",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Category A"},
    )
    cat_a_id = cat_a.json()["data"]["id"]

    # Register Tenant B
    uid_b = uuid.uuid4().hex[:8]
    r_b = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop B {uid_b}", "email": f"b_{uid_b}@test.com", "password": "Password123!", "full_name": "Admin B"},
    )
    token_b = r_b.json()["data"]["access_token"]

    # Tenant B tries to use Tenant A's category as parent -> must return 404
    cross_res = await client.post(
        "/api/v1/categories",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"name": "Category B Child", "parent_id": cat_a_id},
    )
    assert cross_res.status_code == 404


@pytest.mark.asyncio
async def test_staff_cannot_create_category(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    uid = uuid.uuid4().hex[:8]
    # Admin adds staff user
    staff_email = f"staff_{uid}@test.com"
    pwd = "StaffPassword123!"
    add_user = await client.post(
        "/api/v1/users",
        headers=headers,
        json={"email": staff_email, "password": pwd, "full_name": "Staff Worker", "role_name": "staff"},
    )
    assert add_user.status_code == 201

    # Staff logs in
    login_staff = await client.post("/api/v1/auth/login", json={"email": staff_email, "password": pwd})
    staff_token = login_staff.json()["data"]["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Staff attempts to create category -> must return 403 Forbidden
    forbidden_res = await client.post(
        "/api/v1/categories",
        headers=staff_headers,
        json={"name": "Unauthorized Category"},
    )
    assert forbidden_res.status_code == 403
