# StockPilot — Phase 0: Foundation & Project Setup

> **Prerequisites:** Read `docs/00_master_architecture.md` first. Follow ALL conventions defined there.
>
> **Goal:** Set up the complete project skeleton so that `docker compose up` starts PostgreSQL + FastAPI backend + React frontend, health check works, migrations apply, and tests pass.
>
> **DO NOT BUILD:** No login UI, no product pages, no inventory workflows, no business logic. Only project skeleton and infrastructure.

---

## 1. Scope Summary

| # | Task | Status |
|---|---|---|
| 1 | Git repository with `.gitignore` | ☐ |
| 2 | `.env.example` with all required variables | ☐ |
| 3 | `docker-compose.yml` (PostgreSQL + backend + frontend) | ☐ |
| 4 | Backend: FastAPI skeleton with health check | ☐ |
| 5 | Backend: SQLAlchemy async engine + session factory | ☐ |
| 6 | Backend: Alembic migration setup | ☐ |
| 7 | Backend: Initial migration (foundation tables) | ☐ |
| 8 | Backend: Common modules (base model, pagination, exceptions, security) | ☐ |
| 9 | Backend: Test infrastructure (conftest, test_health) | ☐ |
| 10 | Backend: Ruff linting config | ☐ |
| 11 | Frontend: Vite + React + TypeScript skeleton | ☐ |
| 12 | Frontend: Ant Design setup + basic App shell | ☐ |
| 13 | Frontend: Axios client with interceptor placeholders | ☐ |
| 14 | Frontend: ESLint + Prettier config | ☐ |
| 15 | `README.md` with setup instructions | ☐ |
| 16 | `CHANGELOG.md` | ☐ |
| 17 | `docs/ERD.md` with Phase 0 tables | ☐ |

---

## 2. File-by-File Implementation Guide

### 2.1 Root Files

#### `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.venv/
venv/
*.egg

# Node
node_modules/
dist/

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
pgdata/

# Uploads
uploads/

# Coverage
.coverage
htmlcov/
coverage/

# Alembic
*.pyc
```

#### `.env.example`

```env
# Database
DATABASE_URL=postgresql+asyncpg://stockpilot:stockpilot_dev@db:5432/stockpilot
DATABASE_URL_SYNC=postgresql://stockpilot:stockpilot_dev@db:5432/stockpilot

# Auth
SECRET_KEY=change-this-to-a-random-64-char-string-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# App
ENVIRONMENT=development
APP_NAME=StockPilot
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# File Storage
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE_MB=10
```

#### `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: stockpilot
      POSTGRES_PASSWORD: stockpilot_dev
      POSTGRES_DB: stockpilot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stockpilot"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql+asyncpg://stockpilot:stockpilot_dev@db:5432/stockpilot
      DATABASE_URL_SYNC: postgresql://stockpilot:stockpilot_dev@db:5432/stockpilot
      SECRET_KEY: dev-secret-key-change-in-production
      ENVIRONMENT: development
      CORS_ORIGINS: "http://localhost:5173"
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    command: npm run dev -- --host 0.0.0.0 --port 5173
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      VITE_API_BASE_URL: http://localhost:8000/api/v1
    depends_on:
      - backend

volumes:
  pgdata:
```

#### `README.md`

Create a README with:
- Project name and description
- Tech stack summary
- Prerequisites (Docker, Docker Compose)
- Quick start: `cp .env.example .env && docker compose up --build`
- How to run migrations: `docker compose exec backend alembic upgrade head`
- How to run backend tests: `docker compose exec backend pytest -v`
- How to access: Backend at `http://localhost:8000`, Frontend at `http://localhost:5173`, API docs at `http://localhost:8000/docs`
- Project structure overview

#### `CHANGELOG.md`

```markdown
# Changelog

## Phase 0 — Foundation (YYYY-MM-DD)

### Added
- Project skeleton with Docker Compose (PostgreSQL 16, FastAPI, React+Vite)
- Backend: FastAPI app with health check endpoint
- Backend: SQLAlchemy 2.x async setup with Alembic migrations
- Backend: Initial migration with foundation tables (businesses, users, business_users, roles, permissions, role_permissions, audit_logs)
- Backend: Common modules (base model, pagination, exceptions, security)
- Backend: Test infrastructure with pytest + httpx
- Frontend: React 18 + TypeScript + Vite + Ant Design skeleton
- Frontend: Axios API client with interceptor placeholders
- Documentation: README, ERD, architecture docs
```

---

### 2.2 Backend Files

#### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

# Copy app code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### `backend/requirements.txt`

```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
sqlalchemy[asyncio]>=2.0.23
asyncpg>=0.29.0
psycopg2-binary>=2.9.9
alembic>=1.13.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
PyJWT>=2.8.0
bcrypt>=4.1.0
python-multipart>=0.0.6
```

#### `backend/requirements-dev.txt`

```
pytest>=7.4.0
pytest-asyncio>=0.23.0
httpx>=0.25.0
ruff>=0.1.0
```

#### `backend/app/__init__.py`
Empty file.

#### `backend/app/config.py`

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str = ""
    
    # Auth
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    
    # App
    ENVIRONMENT: str = "development"
    APP_NAME: str = "StockPilot"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

#### `backend/app/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=20,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

#### `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from sqlalchemy import text

def create_app() -> FastAPI:
    if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == "dev-secret-key-change-in-production":
        raise RuntimeError("Cannot start with default SECRET_KEY in production!")

    application = FastAPI(
        title=settings.APP_NAME,
        description="Multi-tenant Inventory, Stock & Billing Management System",
        version="0.1.0",
        docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    )

    # CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @application.get("/api/v1/health", tags=["Health"])
    async def health_check():
        # Verify DB connectivity safely without leaking exception details
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "connected"
            is_healthy = True
        except Exception:
            db_status = "unavailable"
            is_healthy = False

        status_code = 200 if is_healthy else 503
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "healthy" if is_healthy else "unhealthy",
                "app": settings.APP_NAME,
                "environment": settings.ENVIRONMENT,
                "database": db_status,
            },
        )

    return application

app = create_app()
```

#### `backend/app/dependencies.py`

```python
"""
Shared FastAPI dependencies.
Placeholder for Phase 1: get_current_user, get_current_tenant, require_role, etc.
"""
```

#### `backend/app/common/__init__.py`
Empty file.

#### `backend/app/common/base_model.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Boolean, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


class TimestampMixin:
    """Adds created_at and updated_at columns."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    """
    Adds tenant_id column. Every business-scoped table should use this mixin.
    The foreign key to businesses is defined here using a string reference
    to avoid circular imports.
    """
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class SoftDeleteMixin:
    """Adds is_active flag for soft deletion."""
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
```

#### `backend/app/common/pagination.py`

```python
from pydantic import BaseModel, Field
from typing import TypeVar, Generic, List, Optional
import math

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort_by: str = "created_at"
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PaginatedResponse(BaseModel):
    data: List
    pagination: PaginationMeta


def paginate(total_items: int, page: int, page_size: int) -> PaginationMeta:
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=max(1, math.ceil(total_items / page_size)),
    )
```

#### `backend/app/common/exceptions.py`

```python
from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: list = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


class NotFoundException(AppException):
    def __init__(self, resource: str, id: str = None):
        detail = f"{resource} not found" + (f": {id}" if id else "")
        super().__init__(404, "NOT_FOUND", detail)


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(409, "CONFLICT", message)


class ForbiddenException(AppException):
    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(403, "FORBIDDEN", message)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(401, "UNAUTHORIZED", message)


class ValidationException(AppException):
    def __init__(self, message: str, details: list = None):
        super().__init__(400, "VALIDATION_ERROR", message, details)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )
```

**Register the exception handler in `main.py`:**
After creating the FastAPI app, add:
```python
from app.common.exceptions import AppException, app_exception_handler
application.add_exception_handler(AppException, app_exception_handler)
```

#### `backend/app/common/security.py`

```python
"""
JWT and password hashing utilities.
Placeholder implementation — used from Phase 1 onward.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError
import bcrypt
from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises PyJWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
```

#### `backend/app/modules/__init__.py`
Empty file.

#### `backend/app/modules/auth/__init__.py`
Empty file.

#### `backend/app/modules/auth/models.py`

```python
"""
Phase 0: Define foundation tables.
Full auth routes and services are implemented in Phase 1.
"""
import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.base_model import Base, TimestampMixin


class Business(Base, TimestampMixin):
    __tablename__ = "businesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    legal_name = Column(String(255), nullable=True)
    gstin = Column(String(15), nullable=True)
    pan = Column(String(10), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    country = Column(String(100), default="India")
    logo_url = Column(String(500), nullable=True)
    currency = Column(String(3), default="INR", nullable=False)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    date_format = Column(String(20), default="DD/MM/YYYY", nullable=False)
    financial_year_start_month = Column(String(2), default="04", nullable=False)  # April
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSONB, default=dict)  # Flexible business settings

    # Relationships
    users = relationship("BusinessUser", back_populates="business")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superadmin = Column(Boolean, default=False, nullable=False)  # Platform-level admin
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    business_memberships = relationship("BusinessUser", back_populates="user")


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)  # admin, manager, inventory_staff, sales_staff, readonly
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)  # System roles cannot be deleted

    # Relationships
    permissions = relationship("RolePermission", back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False)  # e.g., "products.create", "invoices.post"
    display_name = Column(String(150), nullable=False)
    module = Column(String(50), nullable=False)  # e.g., "products", "invoices", "stock"
    description = Column(Text, nullable=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    # Relationships
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission")


class BusinessUser(Base, TimestampMixin):
    __tablename__ = "business_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    business = relationship("Business", back_populates="users")
    user = relationship("User", back_populates="business_memberships")
    role = relationship("Role")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
    entity_type = Column(String(100), nullable=False)  # "product", "invoice", "stock_movement"
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(Text, nullable=True)
    before_data = Column(JSONB, nullable=True)
    after_data = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
```

#### `backend/app/modules/audit/__init__.py`
Empty file.

#### `backend/app/modules/audit/service.py`

```python
"""
Simple audit logging service. Used across all modules.
"""
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.auth.models import AuditLog


async def log_audit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    description: Optional[str] = None,
    before_data: Optional[dict] = None,
    after_data: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    audit = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        before_data=before_data,
        after_data=after_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    # Don't commit here — let the caller's transaction handle it
```

#### `backend/app/seeds/__init__.py`
Empty file.

#### `backend/app/seeds/seed_data.py`

```python
"""
Seed data for development. Phase 0: Create default roles and permissions.
Extended in each subsequent phase.
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.modules.auth.models import Role, Permission, RolePermission


DEFAULT_ROLES = [
    {"name": "admin", "display_name": "Administrator", "description": "Full access to shop settings, products, users, and operations", "is_system": True},
    {"name": "staff", "display_name": "Staff", "description": "Operational access to products, stock, and sales", "is_system": True},
]

DEFAULT_PERMISSIONS = [
    # Products
    {"code": "products.view", "display_name": "View Products", "module": "products"},
    {"code": "products.create", "display_name": "Create Products", "module": "products"},
    {"code": "products.edit", "display_name": "Edit Products", "module": "products"},
    {"code": "products.delete", "display_name": "Archive Products", "module": "products"},
    {"code": "products.import", "display_name": "Import Products", "module": "products"},
    # Stock
    {"code": "stock.view", "display_name": "View Stock", "module": "stock"},
    {"code": "stock.adjust", "display_name": "Adjust Stock", "module": "stock"},
    {"code": "stock.transfer", "display_name": "Transfer Stock", "module": "stock"},
    {"code": "stock.count", "display_name": "Stock Count", "module": "stock"},
    # Purchasing
    {"code": "purchasing.view", "display_name": "View Purchases", "module": "purchasing"},
    {"code": "purchasing.create", "display_name": "Create Purchase Orders", "module": "purchasing"},
    {"code": "purchasing.receive", "display_name": "Receive Goods", "module": "purchasing"},
    {"code": "purchasing.approve", "display_name": "Approve Purchase Orders", "module": "purchasing"},
    # Sales
    {"code": "sales.view", "display_name": "View Sales", "module": "sales"},
    {"code": "sales.create_invoice", "display_name": "Create Invoices", "module": "sales"},
    {"code": "sales.post_invoice", "display_name": "Post Invoices", "module": "sales"},
    {"code": "sales.discount", "display_name": "Apply Discounts", "module": "sales"},
    {"code": "sales.price_override", "display_name": "Override Prices", "module": "sales"},
    {"code": "sales.refund", "display_name": "Process Refunds", "module": "sales"},
    # Reports
    {"code": "reports.view", "display_name": "View Reports", "module": "reports"},
    {"code": "reports.export", "display_name": "Export Reports", "module": "reports"},
    # Settings
    {"code": "settings.view", "display_name": "View Settings", "module": "settings"},
    {"code": "settings.edit", "display_name": "Edit Settings", "module": "settings"},
    {"code": "settings.users", "display_name": "Manage Users", "module": "settings"},
]


async def seed_roles_and_permissions(db: AsyncSession):
    """Insert default roles and permissions if they don't exist."""
    from sqlalchemy import select

    # Check if roles already exist
    result = await db.execute(select(Role).limit(1))
    if result.scalar():
        print("Seed data already exists, skipping.")
        return

    # Create roles
    roles = {}
    for role_data in DEFAULT_ROLES:
        role = Role(**role_data)
        db.add(role)
        roles[role_data["name"]] = role

    # Create permissions
    permissions = []
    for perm_data in DEFAULT_PERMISSIONS:
        perm = Permission(**perm_data)
        db.add(perm)
        permissions.append(perm)

    await db.flush()  # Get IDs assigned

    # Assign all permissions to admin
    for perm in permissions:
        db.add(RolePermission(role_id=roles["admin"].id, permission_id=perm.id))

    # Assign view + relevant permissions to other roles
    # (Detailed role-permission mapping can be refined in Phase 1)
    
    await db.commit()
    print(f"Seeded {len(roles)} roles and {len(permissions)} permissions.")


async def run_seeds():
    async with AsyncSessionLocal() as session:
        await seed_roles_and_permissions(session)


if __name__ == "__main__":
    asyncio.run(run_seeds())
```

---

### 2.3 Alembic Setup

#### `backend/alembic.ini`

```ini
[alembic]
script_location = alembic
sqlalchemy.url = driver://user:pass@localhost/dbname
# The actual URL is set in env.py from environment

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

#### `backend/alembic/env.py`

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Import all models so Alembic detects them
from app.common.base_model import Base
from app.modules.auth.models import Business, User, Role, Permission, RolePermission, BusinessUser, AuditLog

from app.config import settings

config = context.config

# Override sqlalchemy.url with the async URL
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

#### `backend/alembic/script.py.mako`

Use the default Alembic template. No changes needed.

#### Initial Migration

Run `alembic revision --autogenerate -m "phase0_foundation_tables"` after all models are in place. This should create tables:
- `businesses`
- `users`
- `business_users`
- `roles`
- `permissions`
- `role_permissions`
- `audit_logs`

**Important:** Verify the autogenerated migration includes:
- All foreign keys
- All indexes (especially `tenant_id`, `email`, `created_at`)
- All unique constraints (`users.email`, `roles.name`, `permissions.code`)
- All default values

---

### 2.4 Backend Tests

#### `backend/tests/__init__.py`
Empty file.

#### `backend/tests/conftest.py`

```python
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.database import get_db
from app.common.base_model import Base
from app.config import settings

# Use a test database
TEST_DATABASE_URL = settings.DATABASE_URL.replace("/stockpilot", "/stockpilot_test")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
```

#### `backend/tests/test_health.py`

```python
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
```

#### `backend/tests/modules/__init__.py`
Empty file.

---

### 2.5 Ruff Configuration

Add to `backend/pyproject.toml` (create this file):

```toml
[tool.ruff]
target-version = "py311"
line-length = 120

[tool.ruff.lint]
select = ["E", "W", "F", "I"]
ignore = ["E501"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

### 2.6 Frontend Files

#### Create the frontend project

Run from workspace root:
```bash
npx -y create-vite@latest frontend --template react-ts
cd frontend
npm install antd @ant-design/icons axios @tanstack/react-query react-router-dom
npm install -D @types/react-router-dom
```

#### `frontend/Dockerfile`

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

#### `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

#### `frontend/src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme } from 'antd'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              colorPrimary: '#1677ff',
              borderRadius: 6,
            },
          }}
        >
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
```

#### `frontend/src/App.tsx`

```tsx
import { Routes, Route } from 'react-router-dom'
import { Layout, Typography, Result } from 'antd'
import { RocketOutlined } from '@ant-design/icons'

const { Content } = Layout
const { Title, Paragraph } = Typography

function HomePage() {
  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Content style={{ textAlign: 'center', padding: '48px' }}>
        <Result
          icon={<RocketOutlined style={{ color: '#1677ff' }} />}
          title="StockPilot"
          subTitle="Multi-tenant Inventory, Stock & Billing Management System"
          extra={
            <Paragraph type="secondary">
              Phase 0 — Foundation complete. Login and catalogue coming in Phase 1.
            </Paragraph>
          }
        />
      </Content>
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}

export default App
```

#### `frontend/src/api/client.ts`

```typescript
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach auth token (Phase 1)
apiClient.interceptors.request.use(
  (config) => {
    // TODO Phase 1: Get token from auth context and attach
    // const token = getAccessToken()
    // if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401 refresh (Phase 1)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TODO Phase 1: Handle 401 → refresh token → retry
    return Promise.reject(error)
  }
)

export default apiClient
```

#### `frontend/src/api/types.ts`

```typescript
// Shared API response types

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginationMeta {
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: string[]
  }
}
```

#### `frontend/src/index.css`

```css
/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
}
```

---

## 3. Database ERD (Phase 0)

Create `docs/ERD.md` with this content:

```markdown
# StockPilot — Entity Relationship Diagram

## Phase 0: Foundation Tables

    ```mermaid
    erDiagram
        businesses {
            uuid id PK
            varchar name
            varchar legal_name
            varchar gstin
            varchar currency
            varchar timezone
            boolean is_active
            jsonb settings
            timestamptz created_at
            timestamptz updated_at
        }

        users {
            uuid id PK
            varchar email UK
            varchar password_hash
            varchar full_name
            varchar phone
            boolean is_active
            boolean is_superadmin
            timestamptz last_login_at
            timestamptz created_at
            timestamptz updated_at
        }

        roles {
            uuid id PK
            varchar name UK
            varchar display_name
            text description
            boolean is_system
            timestamptz created_at
            timestamptz updated_at
        }

        permissions {
            uuid id PK
            varchar code UK
            varchar display_name
            varchar module
            text description
        }

        role_permissions {
            uuid id PK
            uuid role_id FK
            uuid permission_id FK
        }

        business_users {
            uuid id PK
            uuid business_id FK
            uuid user_id FK
            uuid role_id FK
            boolean is_active
            timestamptz created_at
            timestamptz updated_at
        }

        audit_logs {
            uuid id PK
            uuid tenant_id FK
            uuid user_id FK
            varchar action
            varchar entity_type
            uuid entity_id
            text description
            jsonb before_data
            jsonb after_data
            varchar ip_address
            timestamptz created_at
        }

        businesses ||--o{ business_users : "has members"
        users ||--o{ business_users : "belongs to"
        business_users }o--|| roles : "has role"
        roles ||--o{ role_permissions : "grants"
        permissions ||--o{ role_permissions : "granted by"
        businesses ||--o{ audit_logs : "tracked in"
        users ||--o{ audit_logs : "performed by"
    ```
```

---

## 4. Acceptance Checklist

After completing all the above, verify:

- [ ] `docker compose up --build` starts all three services without errors
- [ ] `http://localhost:8000/api/v1/health` returns `{"status": "healthy", "database": "connected", ...}`
- [ ] `http://localhost:8000/docs` shows FastAPI Swagger UI
- [ ] `http://localhost:5173` shows the StockPilot placeholder page
- [ ] `docker compose exec backend alembic upgrade head` applies migrations successfully
- [ ] `docker compose exec backend alembic downgrade base` rolls back cleanly (dev database only, never in staging/production)
- [ ] `docker compose exec backend alembic upgrade head` re-applies cleanly
- [ ] `docker compose exec backend python -m app.seeds.seed_data` creates default roles and permissions
- [ ] `docker compose exec backend pytest -v` passes all tests (test_health_check, test_health_check_returns_environment)
- [ ] `docker compose exec backend ruff check app/` passes with no errors
- [ ] Backend refuses to start when `SECRET_KEY` is the dev default and `ENVIRONMENT=production`
- [ ] `.env` is NOT committed to git (check `.gitignore`)
- [ ] No hardcoded passwords or secrets in source files
- [ ] `requirements.txt` has pinned versions; `package-lock.json` is committed
- [ ] README has accurate setup instructions including backup/restore commands
- [ ] CHANGELOG is updated for Phase 0
- [ ] ERD.md documents all Phase 0 tables
- [ ] No Phase 1+ code present (no auth routes, no product models, no catalogue modules, no frontend pages beyond placeholder)

---

## 5. What NOT To Build in Phase 0

- ❌ Login/registration UI or API (Phase 1)
- ❌ Product CRUD (Phase 1)
- ❌ Any business logic or domain workflows
- ❌ Image upload functionality (Phase 1)
- ❌ CSV import/export (Phase 1)
- ❌ Any frontend pages beyond the placeholder
- ❌ CI/CD pipeline (nice to have, not blocking)
- ❌ Production deployment config (Phase 8)

---

## 6. Handoff to Phase 1

Once Phase 0 passes all acceptance checks, proceed to `phase_1_auth_catalogue.md`.

**End of Phase 0 specification.**
