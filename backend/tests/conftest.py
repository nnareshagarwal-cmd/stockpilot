import os
import asyncio
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

from sqlalchemy.pool import NullPool

from app.main import app
from app.database import get_db
from app.common.base_model import Base
from app.config import settings

# Test database URL defaults to DATABASE_URL or TEST_DATABASE_URL
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", settings.DATABASE_URL)


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_auth(client: AsyncClient):
    """Register a fresh business and return (tokens, headers, user_data, business_data)."""
    unique_id = uuid.uuid4().hex[:8]
    reg_data = {
        "business_name": f"Test Business {unique_id}",
        "email": f"admin_{unique_id}@test.com",
        "password": "Password123!",
        "full_name": f"Admin {unique_id}",
        "phone": "9876543210",
    }
    resp = await client.post("/api/v1/auth/register", json=reg_data)
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "user": data["user"],
        "business": data["business"],
        "refresh_token": data["refresh_token"],
    }
