import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tenant_a_cannot_see_tenant_b_products(client: AsyncClient):
    # Register Tenant A
    uid_a = uuid.uuid4().hex[:8]
    r_a = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop A {uid_a}", "email": f"a_{uid_a}@test.com", "password": "Password123!", "full_name": "Admin A"},
    )
    token_a = r_a.json()["data"]["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register Tenant B
    uid_b = uuid.uuid4().hex[:8]
    r_b = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop B {uid_b}", "email": f"b_{uid_b}@test.com", "password": "Password123!", "full_name": "Admin B"},
    )
    token_b = r_b.json()["data"]["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Tenant A creates product
    p_a = await client.post(
        "/api/v1/products",
        headers=headers_a,
        json={"name": "Tenant A Secret Product", "variants": [{"sku": f"SKU-A-{uid_a}", "selling_price": 100}]},
    )
    prod_a_id = p_a.json()["data"]["id"]

    # Tenant B lists products -> should NOT see Tenant A's product
    list_b = await client.get("/api/v1/products", headers=headers_b)
    assert list_b.status_code == 200
    b_items = list_b.json()["data"]
    assert not any(item["id"] == prod_a_id for item in b_items)

    # Tenant B tries to get Tenant A's product by guessing UUID -> must return 404 (never 403)
    get_b = await client.get(f"/api/v1/products/{prod_a_id}", headers=headers_b)
    assert get_b.status_code == 404


@pytest.mark.asyncio
async def test_tenant_a_cannot_update_tenant_b_product(client: AsyncClient):
    # Register Tenant A & B
    uid_a = uuid.uuid4().hex[:8]
    r_a = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop A {uid_a}", "email": f"a_{uid_a}@test.com", "password": "Password123!", "full_name": "Admin A"},
    )
    token_a = r_a.json()["data"]["access_token"]

    uid_b = uuid.uuid4().hex[:8]
    r_b = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop B {uid_b}", "email": f"b_{uid_b}@test.com", "password": "Password123!", "full_name": "Admin B"},
    )
    token_b = r_b.json()["data"]["access_token"]

    # Tenant B creates product
    p_b = await client.post(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"name": "Tenant B Product", "variants": [{"sku": f"SKU-B-{uid_b}", "selling_price": 200}]},
    )
    prod_b_id = p_b.json()["data"]["id"]

    # Tenant A tries to update Tenant B's product -> must return 404
    up_res = await client.put(
        f"/api/v1/products/{prod_b_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Hacked Name"},
    )
    assert up_res.status_code == 404


@pytest.mark.asyncio
async def test_tenant_a_cannot_see_tenant_b_categories(client: AsyncClient):
    # Register Tenant A & B
    uid_a = uuid.uuid4().hex[:8]
    r_a = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop A {uid_a}", "email": f"a_{uid_a}@test.com", "password": "Password123!", "full_name": "Admin A"},
    )
    token_a = r_a.json()["data"]["access_token"]

    uid_b = uuid.uuid4().hex[:8]
    r_b = await client.post(
        "/api/v1/auth/register",
        json={"business_name": f"Shop B {uid_b}", "email": f"b_{uid_b}@test.com", "password": "Password123!", "full_name": "Admin B"},
    )
    token_b = r_b.json()["data"]["access_token"]

    # Tenant A creates category
    cat_res = await client.post(
        "/api/v1/categories",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"name": "Tenant A Exclusive Category"},
    )
    cat_a_id = cat_res.json()["data"]["id"]

    # Tenant B tries to get Tenant A's category -> 404
    cat_b = await client.get(
        f"/api/v1/categories/{cat_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert cat_b.status_code == 404
