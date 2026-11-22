import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_summary_kpi_and_sections(client: AsyncClient, admin_auth):
    headers = admin_auth["headers"]

    # 1. Fetch dashboard summary on fresh/existing tenant
    res = await client.get("/api/v1/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # 2. Verify top-level structure
    assert "inventory" in data
    assert "stock_health" in data
    assert "ageing" in data
    assert "action_required" in data
    assert "recent_activity" in data
    assert "business_id" in data

    # 3. Verify Inventory KPI types
    inv = data["inventory"]
    assert isinstance(inv["total_products"], int)
    assert inv["total_products"] >= 0
    assert Decimal(str(inv["total_stock"])) >= Decimal("0.000")
    assert Decimal(str(inv["available_stock"])) >= Decimal("0.000")
    assert inv["valuation_basis"] == "FIFO Cost Basis"
    assert inv["can_view_valuation"] is True

    # 4. Verify Stock Health types
    health = data["stock_health"]
    assert isinstance(health["low_stock_products"], int)
    assert isinstance(health["out_of_stock_products"], int)
    assert Decimal(str(health["damaged_stock"])) >= Decimal("0.000")
    assert isinstance(health["products_with_stock"], int)

    # 5. Verify Ageing
    ageing = data["ageing"]
    assert ageing is not None
    assert Decimal(str(ageing["total_valuation"])) >= Decimal("0.00")
    assert len(ageing["bands"]) == 5
    categories = [b["category"] for b in ageing["bands"]]
    assert categories == ["Fresh", "Moderate", "Ageing", "Old", "Very Old"]

    # Ageing band valuation sum reconciles with total valuation
    band_val_sum = sum(Decimal(str(b["valuation"])) for b in ageing["bands"])
    assert band_val_sum == Decimal(str(ageing["total_valuation"]))

    # 6. Verify Action Required
    act = data["action_required"]
    assert isinstance(act["replenishment_products"], int)
    assert isinstance(act["out_of_stock_products"], int)
    assert isinstance(act["pending_transfers"], int)
    assert isinstance(act["reconciliation_balanced"], bool)
    assert isinstance(act["reconciliation_discrepancies"], int)

    # 7. Verify Recent Activity
    act_list = data["recent_activity"]
    assert isinstance(act_list, list)
    assert len(act_list) <= 10
    if act_list:
        first = act_list[0]
        assert "id" in first
        assert "created_at" in first
        assert "product_name" in first
        assert "sku" in first
        assert "activity" in first
        assert "quantity" in first
        assert "location_name" in first


@pytest.mark.asyncio
async def test_dashboard_multi_tenant_isolation(client: AsyncClient, admin_auth):
    headers_a = admin_auth["headers"]

    # Register Tenant B
    uid_b = uuid.uuid4().hex[:8]
    r_b = await client.post(
        "/api/v1/auth/register",
        json={
            "business_name": f"Shop B {uid_b}",
            "email": f"b_{uid_b}@test.com",
            "password": "Password123!",
            "full_name": "Admin B",
        },
    )
    token_b = r_b.json()["data"]["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Tenant A summary
    res_a = await client.get("/api/v1/dashboard/summary", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()

    # Tenant B summary
    res_b = await client.get("/api/v1/dashboard/summary", headers=headers_b)
    assert res_b.status_code == 200
    data_b = res_b.json()

    # Verify business IDs and counts are completely isolated
    assert data_a["business_id"] != data_b["business_id"]
    assert data_b["inventory"]["total_products"] == 0
    assert Decimal(str(data_b["inventory"]["total_stock"])) == Decimal("0.000")
