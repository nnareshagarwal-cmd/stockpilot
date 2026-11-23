import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_attribute_with_options(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]
    
    # 1. Create attribute
    res = await client.post(
        "/api/v1/attributes",
        headers=headers,
        json={
            "name": "Primary Material Test",
            "code": "prim_mat_test",
            "data_type": "single_choice",
            "category_id": None,
            "options": [
                {"value": "Teak Wood", "sort_order": 1},
                {"value": "Engineered Wood", "sort_order": 2},
                {"value": "Metal", "sort_order": 3},
            ],
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["name"] == "Primary Material Test"
    assert data["code"] == "prim_mat_test"
    assert len(data["options"]) == 3
    option_values = [o["value"] for o in data["options"]]
    assert "Teak Wood" in option_values
    assert "Engineered Wood" in option_values
    assert "Metal" in option_values


@pytest.mark.asyncio
async def test_update_attribute_reconcile_options(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Create attribute with 3 options
    res = await client.post(
        "/api/v1/attributes",
        headers=headers,
        json={
            "name": "Color Finish Test",
            "code": "color_finish_test",
            "data_type": "single_choice",
            "options": [
                {"value": "Red", "sort_order": 1},
                {"value": "Green", "sort_order": 2},
                {"value": "Blue", "sort_order": 3},
            ],
        },
    )
    assert res.status_code == 201
    created = res.json()["data"]
    attr_id = created["id"]
    blue_opt = next(o for o in created["options"] if o["value"] == "Blue")
    blue_id = blue_opt["id"]

    # 2. Update options: Remove Red & Green, keep Blue, add Yellow
    update_res = await client.put(
        f"/api/v1/attributes/{attr_id}",
        headers=headers,
        json={
            "name": "Color Finish Test",
            "code": "color_finish_test",
            "data_type": "single_choice",
            "category_id": None,
            "options": [
                {"value": "Blue", "sort_order": 1},
                {"value": "Yellow", "sort_order": 2},
            ],
        },
    )
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()["data"]
    assert len(updated["options"]) == 2
    updated_values = [o["value"] for o in updated["options"]]
    assert "Blue" in updated_values
    assert "Yellow" in updated_values
    assert "Red" not in updated_values
    assert "Green" not in updated_values

    # Preserves UUID for retained option
    updated_blue = next(o for o in updated["options"] if o["value"] == "Blue")
    assert updated_blue["id"] == blue_id


@pytest.mark.asyncio
async def test_update_attribute_category_mapping(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Create Category
    cat_res = await client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Office Storage Test", "code": "OFF_STOR_TEST"},
    )
    assert cat_res.status_code == 201
    category_id = cat_res.json()["data"]["id"]

    # 2. Create Attribute assigned to Category
    attr_res = await client.post(
        "/api/v1/attributes",
        headers=headers,
        json={
            "name": "Lock Type Test",
            "code": "lock_type_test",
            "data_type": "text",
            "category_id": category_id,
        },
    )
    assert attr_res.status_code == 201
    attr_id = attr_res.json()["data"]["id"]

    # Verify category mapping exists
    mapping_res = await client.get(f"/api/v1/categories/{category_id}/attributes", headers=headers)
    assert mapping_res.status_code == 200
    mapped_ids = [m["attribute_id"] for m in mapping_res.json()["data"]]
    assert attr_id in mapped_ids

    # 3. Update Attribute to Global (category_id = null)
    put_res = await client.put(
        f"/api/v1/attributes/{attr_id}",
        headers=headers,
        json={
            "name": "Lock Type Test",
            "code": "lock_type_test",
            "category_id": None,
        },
    )
    assert put_res.status_code == 200, put_res.text
    assert put_res.json()["data"]["category_id"] is None

    # Verify category mapping was unlinked
    mapping_res2 = await client.get(f"/api/v1/categories/{category_id}/attributes", headers=headers)
    assert mapping_res2.status_code == 200
    mapped_ids2 = [m["attribute_id"] for m in mapping_res2.json()["data"]]
    assert attr_id not in mapped_ids2


@pytest.mark.asyncio
async def test_create_and_update_attribute_multiple_categories(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Create two categories
    c1 = await client.post("/api/v1/categories", headers=headers, json={"name": "Living Room Multi", "code": "LR_MULTI"})
    assert c1.status_code == 201
    cat1_id = c1.json()["data"]["id"]

    c2 = await client.post("/api/v1/categories", headers=headers, json={"name": "Bedroom Multi", "code": "BR_MULTI"})
    assert c2.status_code == 201
    cat2_id = c2.json()["data"]["id"]

    c3 = await client.post("/api/v1/categories", headers=headers, json={"name": "Dining Multi", "code": "DN_MULTI"})
    assert c3.status_code == 201
    cat3_id = c3.json()["data"]["id"]

    # 2. Create attribute mapped to Cat1 & Cat2
    create_res = await client.post(
        "/api/v1/attributes",
        headers=headers,
        json={
            "name": "Wood Finish Multi",
            "code": "wood_finish_multi",
            "data_type": "text",
            "category_ids": [cat1_id, cat2_id],
        },
    )
    assert create_res.status_code == 201, create_res.text
    attr = create_res.json()["data"]
    attr_id = attr["id"]
    assert set(attr["category_ids"]) == {cat1_id, cat2_id}

    # Verify both categories show the attribute mapped
    map1 = await client.get(f"/api/v1/categories/{cat1_id}/attributes", headers=headers)
    assert attr_id in [m["attribute_id"] for m in map1.json()["data"]]

    map2 = await client.get(f"/api/v1/categories/{cat2_id}/attributes", headers=headers)
    assert attr_id in [m["attribute_id"] for m in map2.json()["data"]]

    # 3. Update attribute categories: remove Cat1, keep Cat2, add Cat3
    update_res = await client.put(
        f"/api/v1/attributes/{attr_id}",
        headers=headers,
        json={
            "name": "Wood Finish Multi",
            "code": "wood_finish_multi",
            "data_type": "text",
            "category_ids": [cat2_id, cat3_id],
        },
    )
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()["data"]
    assert set(updated["category_ids"]) == {cat2_id, cat3_id}

    # Verify Cat1 no longer has the attribute, Cat2 & Cat3 have it
    map1_after = await client.get(f"/api/v1/categories/{cat1_id}/attributes", headers=headers)
    assert attr_id not in [m["attribute_id"] for m in map1_after.json()["data"]]

    map2_after = await client.get(f"/api/v1/categories/{cat2_id}/attributes", headers=headers)
    assert attr_id in [m["attribute_id"] for m in map2_after.json()["data"]]

    map3_after = await client.get(f"/api/v1/categories/{cat3_id}/attributes", headers=headers)
    assert attr_id in [m["attribute_id"] for m in map3_after.json()["data"]]

