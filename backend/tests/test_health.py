import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "StockPilot"
    assert "database" in data


@pytest.mark.asyncio
async def test_health_check_returns_environment(client: AsyncClient):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert "environment" in data
