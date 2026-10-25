import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_product_with_variant_and_attributes(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Create Category, Brand, Unit, Attribute
    cat = await client.post("/api/v1/categories", headers=headers, json={"name": "Furniture"})
    cat_id = cat.json()["data"]["id"]

    brand = await client.post("/api/v1/brands", headers=headers, json={"name": "HomeCraft"})
    brand_id = brand.json()["data"]["id"]

    units_res = await client.get("/api/v1/units", headers=headers)
    unit_id = units_res.json()["data"][0]["id"]

    attr = await client.post(
        "/api/v1/attributes",
        headers=headers,
        json={"name": "Width", "code": "width", "data_type": "decimal", "unit_label": "cm", "is_searchable": True},
    )
    attr_id = attr.json()["data"]["id"]

    # 2. Create Product
    product_payload = {
        "name": "Three-Seater Sofa",
        "category_id": cat_id,
        "brand_id": brand_id,
        "model": "Comfort Plus 210",
        "variants": [
            {
                "sku": "SOFA-3S-GRY-001",
                "variant_name": "Grey Fabric",
                "unit_id": unit_id,
                "purchase_price": 15000.00,
                "selling_price": 28000.00,
                "mrp": 32000.00,
            }
        ],
        "attributes": [
            {"attribute_id": attr_id, "decimal_value": 210.0}
        ],
    }

    res = await client.post("/api/v1/products", headers=headers, json=product_payload)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["name"] == "Three-Seater Sofa"
    assert len(data["variants"]) == 1
    assert data["variants"][0]["sku"] == "SOFA-3S-GRY-001"
    assert len(data["attributes"]) == 1
    assert "210" in data["attributes"][0]["formatted_value"]


@pytest.mark.asyncio
async def test_create_product_duplicate_sku_returns_409(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    sku = f"DUP-SKU-{uuid.uuid4().hex[:6]}"
    p1 = {
        "name": "Product 1",
        "variants": [{"sku": sku, "purchase_price": 100, "selling_price": 150}],
    }
    r1 = await client.post("/api/v1/products", headers=headers, json=p1)
    assert r1.status_code == 201

    p2 = {
        "name": "Product 2",
        "variants": [{"sku": sku, "purchase_price": 200, "selling_price": 250}],
    }
    r2 = await client.post("/api/v1/products", headers=headers, json=p2)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_create_product_rejects_foreign_key_from_another_tenant(client: AsyncClient):
    # Tenant A
    r_a = await client.post(
        "/api/v1/auth/register",
        json={"business_name": "Shop A", "email": f"a_{uuid.uuid4().hex[:6]}@t.com", "password": "Password123!", "full_name": "Admin A"},
    )
    token_a = r_a.json()["data"]["access_token"]
    cat_a = await client.post("/api/v1/categories", headers={"Authorization": f"Bearer {token_a}"}, json={"name": "A Cat"})
    cat_a_id = cat_a.json()["data"]["id"]

    # Tenant B
    r_b = await client.post(
        "/api/v1/auth/register",
        json={"business_name": "Shop B", "email": f"b_{uuid.uuid4().hex[:6]}@t.com", "password": "Password123!", "full_name": "Admin B"},
    )
    token_b = r_b.json()["data"]["access_token"]

    # Tenant B creates product referencing Tenant A's category -> must return 404
    prod_res = await client.post(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "name": "Tenant B Product",
            "category_id": cat_a_id,
            "variants": [{"sku": "B-SKU-001", "selling_price": 50}],
        },
    )
    assert prod_res.status_code == 404


@pytest.mark.asyncio
async def test_search_products_by_attribute_spec(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    # Create electrical wattage attribute
    attr = await client.post(
        "/api/v1/attributes",
        headers=headers,
        json={"name": "Wattage", "code": "wattage", "data_type": "decimal", "unit_label": "W", "is_searchable": True},
    )
    attr_id = attr.json()["data"]["id"]

    # Create LED Panel Light 18W
    await client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "name": "LED Panel Light",
            "variants": [{"sku": "LED-PNL-18W-001", "selling_price": 550}],
            "attributes": [{"attribute_id": attr_id, "numeric_value": 18.0}],
        },
    )

    # Search for "18W"
    search_res = await client.get("/api/v1/products/search?q=18W", headers=headers)
    assert search_res.status_code == 200
    items = search_res.json()["data"]
    assert len(items) >= 1
    assert any("LED Panel Light" in item["name"] for item in items)


@pytest.mark.asyncio
async def test_price_history_created_on_price_change(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    sku = f"HIST-SKU-{uuid.uuid4().hex[:6]}"
    p_res = await client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "name": "Priced Product",
            "variants": [{"sku": sku, "purchase_price": 100, "selling_price": 200, "mrp": 250}],
        },
    )
    prod = p_res.json()["data"]
    prod_id = prod["id"]
    variant_id = prod["variants"][0]["id"]

    # Update price
    up_res = await client.put(
        f"/api/v1/products/{prod_id}",
        headers=headers,
        json={
            "variants": [
                {"id": variant_id, "sku": sku, "purchase_price": 120, "selling_price": 220, "mrp": 280}
            ]
        },
    )
    assert up_res.status_code == 200
    updated = up_res.json()["data"]
    assert float(updated["variants"][0]["selling_price"]) == 220.0
