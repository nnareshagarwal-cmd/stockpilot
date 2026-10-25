# StockPilot — Master Architecture Reference

> **Purpose:** This is the single source of truth for technology choices, conventions, and rules that apply across ALL phases. Every phase spec references this document. The builder agent MUST read this before starting any phase.

---

## 1. Product Overview

**StockPilot** is a multi-tenant inventory, stock, and billing management system for small/medium retailers (furniture, hardware, electrical, sanitaryware, building materials).

- **Multi-tenant from day one** — each independent business is a tenant with fully isolated data
- **Target scale** — approximately 10 independent shops sharing one PostgreSQL database
- **Single branch per business initially** — each tenant operates one shop with store and godown inventory locations
- **Responsive web app** — desktop, tablet, mobile browser
- **India-ready** — INR, Indian number/date formats, GST-related fields (compliance deferred)

### Explicitly Deferred

These are out of scope until after go-live:

- Multi-branch management (multiple operating locations per business)
- Inter-branch stock transfers and consolidated branch reports
- Microservices, event-driven architecture, separate databases per tenant
- Kubernetes or container orchestration beyond Docker Compose
- Complex permissions framework beyond admin/staff roles

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Python | 3.11+ |
| **Backend Framework** | FastAPI | latest stable |
| **ASGI Server** | Uvicorn | latest stable |
| **ORM** | SQLAlchemy 2.x | async mode with `asyncpg` |
| **Migrations** | Alembic | latest stable |
| **Database** | PostgreSQL | 16 |
| **Password Hashing** | bcrypt | >=4.1 |
| **Auth Tokens** | PyJWT | >=2.8 |
| **Validation** | Pydantic v2 | (bundled with FastAPI) |
| **Frontend Runtime** | Node.js | 22 LTS |
| **Frontend Framework** | React | 18 |
| **Frontend Language** | TypeScript | 5+ |
| **Build Tool** | Vite | latest stable |
| **UI Library** | Ant Design (antd) | 5.x |
| **HTTP Client (frontend)** | Axios | latest |
| **Server State** | TanStack Query (React Query) | v5 |
| **Routing (frontend)** | React Router | v6 |
| **PDF Generation** | WeasyPrint | latest (Phase 4+) |
| **Testing (backend)** | pytest + pytest-asyncio + httpx | latest |
| **Testing (frontend)** | Vitest + React Testing Library | latest |
| **E2E Testing** | Playwright | latest (Phase 4+) |
| **Linting (backend)** | Ruff | latest |
| **Linting (frontend)** | ESLint + Prettier | latest |
| **Containerization** | Docker + Docker Compose | latest |

#### Dependency Changes from Initial Draft

| Old | New | Reason |
|---|---|---|
| `passlib[bcrypt]` | `bcrypt` | passlib has not been released since 2020 and has compatibility issues with Python 3.12+. The `bcrypt` package is actively maintained. |
| `python-jose[cryptography]` | `PyJWT` | python-jose has not been updated since 2022. PyJWT is actively maintained and widely used. |
| Node.js 18+ | Node.js 22 LTS | Node.js 18 reached end-of-life in April 2025. |

### Package Managers & Reproducibility

- **Backend:** pip with `requirements.txt` (pin exact versions, e.g., `fastapi==0.115.0`). Separate `requirements-dev.txt` for test/lint dependencies. Both committed to git.
- **Frontend:** npm with `package.json`. Commit `package-lock.json` to git for reproducible installs.
- **Docker images:** Pin base image tags (e.g., `python:3.11-slim`, `node:22-alpine`, `postgres:16-alpine`).

---

## 3. Project Structure

```
stockpilot/                              ← Repository root (workspace root)
├── docker-compose.yml
├── docker-compose.prod.yml              ← Production overrides (Phase 8)
├── .env.example                         ← Template; NEVER commit real .env
├── .gitignore
├── README.md
├── CHANGELOG.md
├── docs/
│   ├── 00_master_architecture.md        ← This file
│   ├── phase_0_foundation.md
│   ├── phase_1_auth_catalogue.md
│   ├── ERD.md                           ← Updated each phase
│   └── API.md                           ← API conventions
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/                    ← Migration files
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                      ← FastAPI app factory, CORS, routers
│   │   ├── config.py                    ← Settings from environment
│   │   ├── database.py                  ← Async engine, session factory
│   │   ├── dependencies.py             ← Shared FastAPI dependencies
│   │   │
│   │   ├── common/
│   │   │   ├── __init__.py
│   │   │   ├── base_model.py            ← SQLAlchemy declarative base + mixins
│   │   │   ├── pagination.py            ← Paginated response schema + helper
│   │   │   ├── exceptions.py            ← App exception classes + handlers
│   │   │   ├── security.py              ← JWT encode/decode, password hashing
│   │   │   └── storage.py               ← File storage abstraction (Phase 1+)
│   │   │
│   │   ├── modules/
│   │   │   ├── __init__.py
│   │   │   ├── auth/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py            ← User, BusinessUser, Role, etc.
│   │   │   │   ├── schemas.py           ← Pydantic request/response models
│   │   │   │   ├── router.py            ← API routes
│   │   │   │   └── service.py           ← Business logic
│   │   │   │
│   │   │   ├── business/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py
│   │   │   │   ├── schemas.py
│   │   │   │   ├── router.py
│   │   │   │   └── service.py
│   │   │   │
│   │   │   ├── catalogue/               ← Phase 1+
│   │   │   ├── locations/               ← Phase 1+
│   │   │   ├── stock/                   ← Phase 2+
│   │   │   ├── purchasing/              ← Phase 3+
│   │   │   ├── sales/                   ← Phase 4+
│   │   │   ├── reports/                 ← Phase 6+
│   │   │   ├── settings/               ← Phase 1+
│   │   │   └── audit/
│   │   │       ├── __init__.py
│   │   │       ├── models.py
│   │   │       ├── schemas.py
│   │   │       ├── router.py
│   │   │       └── service.py
│   │   │
│   │   └── seeds/
│   │       ├── __init__.py
│   │       └── seed_data.py             ← Demo data loader
│   │
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py                  ← Test DB, async client, fixtures
│       ├── test_health.py
│       └── modules/
│           ├── __init__.py
│           ├── test_auth.py             ← Phase 1+
│           └── ...
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── public/
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   ├── client.ts                ← Axios instance with interceptors
        │   └── types.ts                 ← Shared API types
        ├── auth/
        │   ├── AuthContext.tsx
        │   ├── LoginPage.tsx
        │   └── ProtectedRoute.tsx
        ├── layouts/
        │   ├── MainLayout.tsx           ← Sidebar + header + content
        │   └── AuthLayout.tsx           ← Login/register layout
        ├── components/                  ← Shared components
        ├── modules/
        │   ├── catalogue/               ← Phase 1+
        │   ├── stock/                   ← Phase 2+
        │   ├── purchasing/              ← Phase 3+
        │   ├── sales/                   ← Phase 4+
        │   ├── reports/                 ← Phase 6+
        │   └── settings/               ← Phase 1+
        ├── hooks/                       ← Custom React hooks
        └── utils/
            ├── formatters.ts            ← Currency, date, number formatting
            └── constants.ts
```

### Rules for Project Structure:
1. **Never create files outside this structure** without documenting why.
2. **Each module** has its own `models.py`, `schemas.py`, `router.py`, `service.py`.
3. **No circular imports** — modules depend on `common/` and `database.py`, not on each other's models directly. Use foreign key strings for cross-module relationships.
4. **Tests mirror the source structure** — `tests/modules/test_auth.py` tests `app/modules/auth/`.
5. **Create directories only when needed** — Module directories listed as "Phase N+" above are created when that phase begins, not before.

---

## 4. Database Conventions

### 4.1 Naming Rules

| Element | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `products`, `stock_movements` |
| Column names | `snake_case` | `created_at`, `tenant_id` |
| Primary keys | `id` (UUID v4) | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| Foreign keys | `<referenced_table_singular>_id` | `product_id`, `tenant_id` |
| Indexes | `ix_<table>_<columns>` | `ix_products_tenant_sku` |
| Unique constraints | `uq_<table>_<columns>` | `uq_product_variants_tenant_sku` |
| Check constraints | `ck_<table>_<description>` | `ck_stock_balances_qty_non_negative` |
| Timestamps | `created_at`, `updated_at` (UTC) | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |

### 4.2 Standard Columns (Every Table)

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### 4.3 Tenant-Scoped Tables

Every table that holds business-specific data MUST have:

```sql
tenant_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT
```

**Tables that are NOT tenant-scoped:** `users` (a user can belong to multiple businesses via `business_users`).

**Tables that ARE tenant-scoped:** Everything else — `products`, `product_variants`, `categories`, `brands`, `locations`, `stock_balances`, `stock_movements`, `suppliers`, `customers`, `sales_invoices`, `purchase_orders`, `audit_logs`, etc.

### 4.4 Data Types

| Data | PostgreSQL Type | Notes |
|---|---|---|
| IDs | `UUID` | Generated with `gen_random_uuid()` |
| Money/prices | `NUMERIC(15,2)` | Never use FLOAT/DOUBLE |
| Quantities (fractional) | `NUMERIC(15,3)` | Supports fractional units (meters, kg) |
| Quantities (count) | `INTEGER` | Only when fractional is impossible |
| Percentages | `NUMERIC(5,2)` | Tax rates, discount % |
| Timestamps | `TIMESTAMPTZ` | Always UTC in storage |
| Short text | `VARCHAR(n)` | With appropriate length |
| Long text | `TEXT` | Descriptions, notes |
| Booleans | `BOOLEAN NOT NULL DEFAULT` | Always specify default |
| Enums | `VARCHAR` with CHECK constraint | Not PostgreSQL ENUM (hard to migrate) |
| Flexible metadata | `JSONB` | Only where justified |

### 4.5 Soft Delete

Master records referenced by transactions (products, suppliers, customers) use **soft delete**:

```sql
is_active   BOOLEAN NOT NULL DEFAULT TRUE
```

Never hard-delete a record that has transaction history. Filter inactive records from default queries.

### 4.6 Audit Columns

For entities that need change tracking beyond `updated_at`:

```sql
created_by  UUID REFERENCES users(id),
updated_by  UUID REFERENCES users(id)
```

### 4.7 Cross-Tenant Referential Integrity

Standard foreign keys do not prevent cross-tenant references (e.g., a product in Tenant A pointing to a category in Tenant B). At our scale, this is enforced at the application layer:

- **Every service-layer create or update** that accepts a foreign key (category_id, brand_id, location_id, etc.) MUST verify the referenced record exists within the same `tenant_id` before writing.
- Return `404 Not Found` if the referenced record does not exist within the tenant — never reveal that it exists in another tenant.
- Include this validation in integration tests for every entity with tenant-scoped foreign keys.

---

## 5. API Conventions

### 5.1 URL Format

```
/api/v1/<resource>
```

Examples:
```
GET    /api/v1/products                  ← List (paginated)
POST   /api/v1/products                  ← Create
GET    /api/v1/products/{id}             ← Get one
PUT    /api/v1/products/{id}             ← Update
DELETE /api/v1/products/{id}             ← Archive (soft delete)
POST   /api/v1/products/import           ← Bulk import
GET    /api/v1/products/export           ← Export

GET    /api/v1/stock/balances            ← Stock summary
POST   /api/v1/stock/movements           ← Create movement
GET    /api/v1/stock/movements           ← Movement ledger

POST   /api/v1/auth/register            ← Register business + admin
POST   /api/v1/auth/login               ← Login
POST   /api/v1/auth/select-business     ← Select business (multi-business users)
POST   /api/v1/auth/refresh             ← Refresh token
POST   /api/v1/auth/logout              ← Logout
GET    /api/v1/auth/me                   ← Current user

GET    /api/v1/health                    ← Health check (no auth)
```

### 5.2 Request/Response Format

**All responses** follow this envelope:

```json
// Success (single item)
{
  "data": { ... },
  "message": "Product created successfully"
}

// Success (list with pagination)
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 150,
    "total_pages": 8
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "SKU already exists",
    "details": [ ... ]
  }
}
```

### 5.3 Pagination

All list endpoints accept:
```
?page=1&page_size=20&sort_by=created_at&sort_order=desc
```

Default: `page=1`, `page_size=20`, max `page_size=100`.

### 5.4 Filtering

Use query parameters:
```
GET /api/v1/products?category_id=xxx&brand_id=yyy&is_active=true&search=sofa
```

### 5.5 Authentication

- **Header:** `Authorization: Bearer <access_token>`
- **Access token:** JWT, 30-minute expiry, held in memory
- **Refresh token:** JWT, 7-day expiry, `httpOnly; Secure; SameSite=Lax` cookie
- **Access token payload:**
  ```json
  {
    "sub": "<user_id>",
    "tenant_id": "<business_id>",
    "role": "admin",
    "exp": 1234567890
  }
  ```

### 5.6 Error Codes

| HTTP Status | When |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation error, bad request |
| 401 | Not authenticated |
| 403 | Not authorized (wrong role) |
| 404 | Resource not found (within tenant) |
| 409 | Conflict (duplicate SKU, etc.) |
| 422 | Unprocessable entity (Pydantic validation) |
| 500 | Server error |

---

## 6. Multi-Tenancy Implementation

### 6.1 Strategy: Shared Database + `tenant_id` Column

```
Request → JWT decode → extract tenant_id → inject into request state
                                          → auto-filter all DB queries
                                          → auto-set on all DB inserts
```

### 6.2 Backend Implementation

**SQLAlchemy Base Model with tenant mixin:**

```python
# app/common/base_model.py
from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase
import uuid

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class TenantMixin:
    """Add to every table that holds tenant-specific data."""
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # Foreign key defined in individual models to avoid circular imports
```

**Tenant-scoping dependency:**

```python
# In every route or service that touches tenant data:
async def get_current_tenant(request: Request) -> uuid.UUID:
    return request.state.tenant_id  # Set by auth middleware from JWT
```

**Query scoping:** Every database query on a tenant-scoped table MUST include:
```python
query = select(Product).where(Product.tenant_id == current_tenant_id)
```

Services should enforce this. Never trust tenant_id from request body — always use the JWT-derived value.

### 6.3 Frontend Implementation

- Tenant context is implicit — the JWT carries `tenant_id`
- Frontend never sends `tenant_id` in request bodies
- API client attaches JWT automatically via Axios interceptor

### 6.4 Centralized Tenant Enforcement

All tenant scoping flows through a single dependency chain:

```
JWT → get_current_user() → get_tenant_id() → passed to every service method
```

Rules:
1. **One entry point:** `get_tenant_id()` is the sole source of `tenant_id` for all queries. Services never accept `tenant_id` from request bodies.
2. **Every query filtered:** All `SELECT`, `UPDATE`, and `DELETE` queries on tenant-scoped tables MUST include `.where(Model.tenant_id == tenant_id)`.
3. **Every insert stamped:** All `INSERT` operations on tenant-scoped tables set `tenant_id` from the dependency, not from user input.
4. **Foreign key lookups scoped:** When resolving a foreign key (e.g., `category_id`), the lookup query MUST also filter by `tenant_id` (see §4.7).

### 6.5 Tenant Isolation Testing

Every phase that adds tenant-scoped data MUST include at least one test that:

- Creates the same type of record in two separate tenants
- Verifies Tenant A's API requests cannot list, read, update, or delete Tenant B's records
- Verifies that guessing a valid UUID belonging to Tenant B returns `404` (not `403`)
- For bulk operations (CSV import, export): verifies results contain only the requesting tenant's data

---

## 7. Authentication & Session Management

### 7.1 Roles

Two roles at launch:

| Role | Access |
|---|---|
| **admin** | Full access. Created on business registration. Can manage users, business settings, and all operations. |
| **staff** | Operational access. Can manage products, stock, sales. Cannot manage users or business settings. |

The `roles` and `permissions` tables support adding finer-grained roles (manager, inventory_staff, etc.) post-launch without schema changes.

### 7.2 Login Flow

```
1. User submits email + password to POST /api/v1/auth/login
2. Backend validates credentials against users + business_users tables
3. If user belongs to one active business → issue tokens immediately
4. If user belongs to multiple active businesses → return list of memberships;
   user selects one via POST /api/v1/auth/select-business → issue tokens
5. Backend verifies the business_users membership is active and the business is active
6. Returns { access_token, refresh_token (httpOnly cookie), user, business, role }
```

### 7.3 Token Lifecycle

- **Access token:** JWT, 30-minute expiry, stored in JavaScript memory only (not localStorage)
- **Refresh token:** JWT, 7-day expiry, set as `httpOnly; Secure; SameSite=Lax` cookie
- **On 401:** Axios interceptor calls `POST /api/v1/auth/refresh` → new access token returned, new refresh token set in cookie
- **If refresh fails:** Clear state and redirect to login
- **On role or membership change:** User must re-login to get a new token with updated claims

### 7.4 Logout

`POST /api/v1/auth/logout` clears the refresh token cookie. The access token expires naturally within 30 minutes.

### 7.5 Password Hashing

Use the `bcrypt` package directly:

```python
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

---

## 8. Frontend Conventions

### 8.1 Styling
- Use **Ant Design components** as the primary UI toolkit
- Use Ant Design's **ConfigProvider** for theme customization
- Custom CSS in `*.module.css` files (CSS Modules) for component-specific styles
- Global styles in `src/index.css`
- Use Ant Design's built-in responsive grid (`Row`, `Col`)

### 8.2 State Management
- **Server state:** TanStack Query for all API data (caching, refetching, pagination)
- **Auth state:** React Context (`AuthContext`)
- **UI state:** Local component state (`useState`) or URL params
- **No Redux** unless complexity demands it (unlikely for this app)

### 8.3 Component Patterns
- Pages go in `src/modules/<module>/pages/`
- Shared components go in `src/components/`
- API calls go in `src/modules/<module>/api.ts`
- Types go in `src/modules/<module>/types.ts`
- Custom hooks go in `src/hooks/` or `src/modules/<module>/hooks.ts`

### 8.4 Navigation
- **Desktop:** Left sidebar (collapsible) + top header with user menu and global search
- **Mobile:** Hamburger menu + compact header
- Use Ant Design's `Layout`, `Menu`, `Sider` components

---

## 9. Cross-Phase Engineering Rules

These rules apply to EVERY phase. The builder agent MUST follow them:

1. **Migrations for every DB change** — Never manually edit the database. Always create an Alembic migration.
2. **Tests with every feature** — Unit tests for services, integration tests for API routes. Include tenant isolation tests for every tenant-scoped entity (see §6.5). Do not defer testing.
3. **Server-side validation** — Pydantic schemas validate input. Database constraints enforce integrity. Never rely only on frontend validation.
4. **Server-side authorization** — Check roles in route dependencies, not just by hiding UI buttons.
5. **Database transactions** — Multi-step writes (e.g., create invoice + create stock movements + update balances) must be in one transaction. Use `async with session.begin():`.
6. **Tenant isolation** — Every query on tenant-scoped data MUST filter by `tenant_id`. Never expose data across tenants. (See §6.4–6.5.)
7. **Idempotent posting** — Posting actions (invoice, GRN, adjustments) must be safe to retry. Use document status transitions (`draft → posted`) so resubmission returns the existing result instead of creating duplicates.
8. **Decimal-safe money** — Use `Decimal` in Python, `NUMERIC` in PostgreSQL. Never use `float` for money.
9. **UTC timestamps** — Store in UTC, display in business timezone.
10. **No hard deletes** — Soft delete (`is_active=False`) for master records with transaction history.
11. **Audit logging** — Log important actions: who, what, when, before/after values.
12. **Error handling** — Return useful error messages. Never silently swallow exceptions. Use FastAPI exception handlers.
13. **Loading/empty/error states** — Every frontend page must handle: loading spinner, empty state message, error display.
14. **Pagination** — All list endpoints must be paginated. Never load entire tables into the browser.
15. **Secrets in environment** — Database passwords, JWT secrets, API keys go in `.env`, never in source code. Backend MUST refuse to start if `SECRET_KEY` matches the development default when `ENVIRONMENT=production`.
16. **Demo/seed data** — Maintain seed data that covers furniture, electrical, hardware, and sanitaryware scenarios.
17. **Update documentation** — Update README, CHANGELOG, and ERD after each phase.
18. **Stock ledger integrity** — `stock_movements` is the auditable source of truth for all inventory changes. `stock_balances` is a running total that must be reconcilable against the movement ledger at any time. Concurrent stock-depleting operations (e.g., two simultaneous sales of the same SKU) must use row-level locking (`SELECT ... FOR UPDATE` on the balance row) to prevent overselling.
19. **Database backups** — Document backup/restore commands in README. Development: `pg_dump` via Docker Compose. Production: use managed database automatic backups.
20. **Phase discipline** — Build only the functionality specified in the current phase. Do not create empty module directories, placeholder routes, or stub implementations for future phases.

---

## 10. Docker Compose Configuration

### Development

```yaml
# docker-compose.yml
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
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+asyncpg://stockpilot:stockpilot_dev@db:5432/stockpilot
      SECRET_KEY: dev-secret-key-change-in-production
      ENVIRONMENT: development
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    command: npm run dev -- --host 0.0.0.0
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  pgdata:
```

### Environment Safety

The backend startup MUST validate that `SECRET_KEY` is not the development default (`dev-secret-key-change-in-production`) when `ENVIRONMENT` is set to `production`. Fail immediately with a clear error message.

### Production (Phase 8)

Lightsail deployment with:
- Caddy as reverse proxy (auto-HTTPS)
- Lightsail Managed PostgreSQL (separate service, automatic backups)
- Built frontend served as static files
- Environment-specific `.env` with production `SECRET_KEY`

---

## 11. Git Conventions

- **Branch naming:** `phase-0/foundation`, `phase-1/auth-catalogue`, etc.
- **Commit messages:** `[Phase X] Brief description of change`
- **No secrets in commits** — check `.gitignore` before committing
- **CHANGELOG.md** — Update with every phase completion

---

## 12. Deployment Target (Future Reference)

| Component | Service | Est. Cost |
|---|---|---|
| App Server | AWS Lightsail 4GB | $20/month |
| Database | Lightsail Managed PostgreSQL | $15/month |
| File Storage | S3 (product images) | ~$1-5/month |
| SSL | Caddy (Let's Encrypt, free) | $0 |
| **Total** | | **~$36-40/month** |

---

**End of master architecture document.**
