# StockPilot — Multi-Tenant Retail Inventory & Billing System

StockPilot is a multi-tenant inventory, stock, and billing management system built for small and medium retailers (furniture, hardware, electrical, sanitaryware, and building materials).

---

## 🛠️ Tech Stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, SQLAlchemy 2.x (async with `asyncpg`), Alembic, Pydantic v2, PyJWT, bcrypt
- **Database:** PostgreSQL 16 (PostgreSQL full-text search & trigram `pg_trgm` extension)
- **Frontend:** React 18, TypeScript 5, Vite, Ant Design (antd 5.x), TanStack Query (React Query v5), Axios, React Router v6
- **Containerization:** Docker & Docker Compose

---

## 🚀 Quick Start (Docker Compose)

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

> **Note on Database Port:** The PostgreSQL host port is mapped to **`5433:5432`** in `docker-compose.yml` so it will not collide with any pre-existing containers or local database instances running on host port `5432`. Inside the Docker network, the backend connects to `db:5432`.

### 2. Start Services
Build and start all containers:
```bash
docker compose up --build -d
```

### 3. Run Database Migrations
Apply Phase 0 and Phase 1 database migrations:
```bash
docker compose exec backend alembic upgrade head
```

### 4. Seed Demo Data
Populate the database with sample business "Demo Retailer", admin user, master categories, brands, units, locations, stock conditions, tax rates, typed attributes, and 4 sample products (Sofa, LED Panel 18W, SS Screw, Wash Basin):
```bash
docker compose exec backend python -m app.seeds.seed_data
```

### 5. Access Applications
- **Web App:** [http://localhost:5173](http://localhost:5173)
- **Backend API & Health:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Interactive Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

**Default Demo Credentials:**
- Email: `demo@stockpilot.com`
- Password: `DemoPass123`

---

## 🧪 Running Tests

Run the test suite inside the backend container:
```bash
docker compose exec backend pytest -v
```

Run code formatting & linting with Ruff:
```bash
docker compose exec backend ruff check app/
```

---

## 💾 Database Backup & Restore

### Backup
```bash
docker compose exec db pg_dump -U stockpilot stockpilot > backup.sql
```

### Restore
```bash
docker compose exec -T db psql -U stockpilot stockpilot < backup.sql
```

---

## 📁 Project Structure

```
stockpilot/
├── docker-compose.yml       # PostgreSQL (5433:5432) + Backend (8000) + Frontend (5173)
├── .env.example             # Configuration template
├── .gitignore               # Ignored files
├── README.md                # Project documentation
├── CHANGELOG.md             # Version changelog
├── docs/
│   ├── 00_master_architecture.md
│   ├── phase_0_foundation.md
│   ├── phase_1_auth_catalogue.md
│   ├── phases_2_to_7_roadmap_and_spec.md
│   └── ERD.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── common/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── business/
│   │   │   ├── users/
│   │   │   ├── settings/
│   │   │   ├── catalogue/
│   │   │   ├── stock/
│   │   │   └── audit/
│   │   └── seeds/
│   └── tests/
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── api/
        ├── auth/
        ├── layouts/
        └── modules/
            ├── home/
            ├── catalogue/
            ├── stock/
            └── settings/
```
