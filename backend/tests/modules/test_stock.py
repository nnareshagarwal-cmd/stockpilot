import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_opening_stock_and_balances(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Create category, unit, location, condition, and product with variant
    cat_res = await client.post("/api/v1/categories", headers=headers, json={"name": "Bedroom Furniture"})
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    loc_res = await client.post("/api/v1/locations", headers=headers, json={"name": "Godown Alpha", "code": "GD-ALPHA", "location_type": "godown"})
    assert loc_res.status_code == 201
    loc_id = loc_res.json()["data"]["id"]

    cond_res = await client.get("/api/v1/stock-conditions", headers=headers)
    assert cond_res.status_code == 200
    conditions = cond_res.json()["data"]
    good_cond = next((c for c in conditions if c["code"] == "good"), conditions[0])
    cond_id = good_cond["id"]

    prod_res = await client.post("/api/v1/products", headers=headers, json={
        "name": "King Solid Wood Bed",
        "category_id": cat_id,
        "variants": [{
            "sku": "BED-KING-001",
            "variant_name": "Teak Wood King",
            "purchase_price": 22000.0,
            "selling_price": 35000.0,
            "reorder_point": 5.0,
        }],
    })
    assert prod_res.status_code == 201
    variant_id = prod_res.json()["data"]["variants"][0]["id"]

    # 2. Record opening stock: 10 units at ₹22,000 in Godown Alpha
    open_res = await client.post("/api/v1/stock/opening", headers=headers, json={
        "items": [{
            "variant_id": variant_id,
            "location_id": loc_id,
            "condition_id": cond_id,
            "quantity": 10.0,
            "unit_cost": 22000.0,
            "notes": "Initial inventory batch",
        }],
        "batch_reference": "OPN-2026-TEST",
    })
    assert open_res.status_code == 201

    # 3. Verify stock balances
    bal_res = await client.get(f"/api/v1/stock/balances?variant_id={variant_id}", headers=headers)
    assert bal_res.status_code == 200
    balances = bal_res.json()["data"]
    assert len(balances) == 1
    assert Decimal(str(balances[0]["quantity"])) == Decimal("10.000")
    assert Decimal(str(balances[0]["available_quantity"])) == Decimal("10.000")
    assert balances[0]["sku"] == "BED-KING-001"
    assert balances[0]["location_name"] == "Godown Alpha"

    # 4. Verify movement ledger
    mov_res = await client.get(f"/api/v1/stock/movements?variant_id={variant_id}", headers=headers)
    assert mov_res.status_code == 200
    movements = mov_res.json()["data"]
    assert len(movements) == 1
    assert movements[0]["movement_type"] == "OPENING_STOCK"
    assert Decimal(str(movements[0]["quantity"])) == Decimal("10.000")
    assert Decimal(str(movements[0]["balance_after"])) == Decimal("10.000")


@pytest.mark.asyncio
async def test_stock_transfers_dispatch_and_receive(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # Setup source and destination locations
    src_res = await client.post("/api/v1/locations", headers=headers, json={"name": "Central Warehouse", "code": "CW-01", "location_type": "warehouse"})
    src_loc = src_res.json()["data"]["id"]

    dst_res = await client.post("/api/v1/locations", headers=headers, json={"name": "Retail Showroom", "code": "SH-01", "location_type": "showroom"})
    dst_loc = dst_res.json()["data"]["id"]

    cond_res = await client.get("/api/v1/stock-conditions", headers=headers)
    cond_id = cond_res.json()["data"][0]["id"]

    prod_res = await client.post("/api/v1/products", headers=headers, json={
        "name": "Luxury Sofa 3-Seater",
        "variants": [{"sku": "SOFA-3S-001", "selling_price": 45000.0}],
    })
    variant_id = prod_res.json()["data"]["variants"][0]["id"]

    # Add 8 units in Central Warehouse
    await client.post("/api/v1/stock/opening", headers=headers, json={
        "items": [{
            "variant_id": variant_id,
            "location_id": src_loc,
            "condition_id": cond_id,
            "quantity": 8.0,
            "unit_cost": 28000.0,
        }]
    })

    # Create & Dispatch transfer of 3 units from Warehouse to Showroom
    trf_res = await client.post("/api/v1/stock/transfers", headers=headers, json={
        "source_location_id": src_loc,
        "destination_location_id": dst_loc,
        "notes": "Floor replenishment",
        "items": [{"variant_id": variant_id, "condition_id": cond_id, "quantity": 3.0}],
    })
    assert trf_res.status_code == 201
    transfer = trf_res.json()["data"]
    assert transfer["status"] == "DISPATCHED"
    transfer_id = transfer["id"]

    # Verify source stock decreased to 5
    src_bal = await client.get(f"/api/v1/stock/balances?variant_id={variant_id}&location_id={src_loc}", headers=headers)
    assert Decimal(str(src_bal.json()["data"][0]["quantity"])) == Decimal("5.000")

    # Complete receipt at destination
    rcv_res = await client.put(f"/api/v1/stock/transfers/{transfer_id}/receive", headers=headers, json={
        "notes": "All 3 received in mint condition"
    })
    assert rcv_res.status_code == 200
    assert rcv_res.json()["data"]["status"] == "RECEIVED"

    # Verify destination stock increased to 3
    dst_bal = await client.get(f"/api/v1/stock/balances?variant_id={variant_id}&location_id={dst_loc}", headers=headers)
    assert Decimal(str(dst_bal.json()["data"][0]["quantity"])) == Decimal("3.000")


@pytest.mark.asyncio
async def test_zero_negative_stock_enforcement(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    loc_res = await client.post("/api/v1/locations", headers=headers, json={"name": "Godown Test Neg", "code": "GD-NEG", "location_type": "godown"})
    loc_id = loc_res.json()["data"]["id"]

    dst_res = await client.post("/api/v1/locations", headers=headers, json={"name": "Showroom Test Neg", "code": "SH-NEG", "location_type": "showroom"})
    dst_loc = dst_res.json()["data"]["id"]

    cond_res = await client.get("/api/v1/stock-conditions", headers=headers)
    cond_id = cond_res.json()["data"][0]["id"]

    prod_res = await client.post("/api/v1/products", headers=headers, json={
        "name": "Dining Table 6 Seater",
        "variants": [{"sku": "TABLE-6S-001", "selling_price": 25000.0}],
    })
    variant_id = prod_res.json()["data"]["variants"][0]["id"]

    # Add 2 units
    await client.post("/api/v1/stock/opening", headers=headers, json={
        "items": [{"variant_id": variant_id, "location_id": loc_id, "condition_id": cond_id, "quantity": 2.0}]
    })

    # Attempt to transfer 5 units (when only 2 exist) -> Must be rejected with 400
    neg_res = await client.post("/api/v1/stock/transfers", headers=headers, json={
        "source_location_id": loc_id,
        "destination_location_id": dst_loc,
        "items": [{"variant_id": variant_id, "condition_id": cond_id, "quantity": 5.0}],
    })
    assert neg_res.status_code == 400
    assert "Insufficient stock" in neg_res.text


@pytest.mark.asyncio
async def test_condition_change_and_reconciliation(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    loc_res = await client.post("/api/v1/locations", headers=headers, json={"name": "Floor Display Area", "code": "DISP-01", "location_type": "floor"})
    loc_id = loc_res.json()["data"]["id"]

    conds_res = await client.get("/api/v1/stock-conditions", headers=headers)
    conds = conds_res.json()["data"]
    good_cond = next((c for c in conds if c["code"] == "good"), conds[0])
    damaged_cond = next((c for c in conds if c["code"] == "damaged"), conds[1])

    prod_res = await client.post("/api/v1/products", headers=headers, json={
        "name": "Office Ergonomic Chair",
        "variants": [{"sku": "CHAIR-ERGO-01", "selling_price": 9500.0, "reorder_point": 5.0}],
    })
    variant_id = prod_res.json()["data"]["variants"][0]["id"]

    # Add 10 units in Good condition
    await client.post("/api/v1/stock/opening", headers=headers, json={
        "items": [{"variant_id": variant_id, "location_id": loc_id, "condition_id": good_cond["id"], "quantity": 10.0, "unit_cost": 5000.0}]
    })

    # Change 2 units from Good -> Damaged (e.g. scratch during transport)
    cc_res = await client.post("/api/v1/stock/condition-change", headers=headers, json={
        "variant_id": variant_id,
        "location_id": loc_id,
        "from_condition_id": good_cond["id"],
        "to_condition_id": damaged_cond["id"],
        "quantity": 2.0,
        "notes": "Scratched armrest",
    })
    assert cc_res.status_code == 200

    # Verify: Good = 8, Damaged = 2. Physical total at location = 10
    bals = (await client.get(f"/api/v1/stock/balances?variant_id={variant_id}", headers=headers)).json()["data"]
    good_bal = next(b for b in bals if b["condition_id"] == good_cond["id"])
    damaged_bal = next(b for b in bals if b["condition_id"] == damaged_cond["id"])
    assert Decimal(str(good_bal["quantity"])) == Decimal("8.000")
    assert Decimal(str(damaged_bal["quantity"])) == Decimal("2.000")

    # Run Reconciliation Checker
    recon_res = await client.get("/api/v1/stock/reconciliation", headers=headers)
    assert recon_res.status_code == 200
    recon = recon_res.json()
    assert recon["is_balanced"] is True
    assert len(recon["mismatches"]) == 0

    # Test Ageing Report
    age_res = await client.get("/api/v1/stock/ageing", headers=headers)
    assert age_res.status_code == 200
    ageing = age_res.json()
    assert Decimal(str(ageing["total_quantity"])) >= Decimal("10.000")
