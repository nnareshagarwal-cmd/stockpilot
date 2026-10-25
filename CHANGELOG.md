# Changelog

All notable changes to the StockPilot project will be documented in this file.

## [Phase 2: Opening Stock, Stock Balances, Movements & Ageing] — 2026-10-24

### Added
- **Alembic Migration 003 (`003_phase2_stock_tables.py`):**
  - `stock_balances`: Running totals of on-hand, reserved, and available quantities by `(variant_id, location_id, condition_id)` with positive stock check constraints.
  - `stock_movements`: Immutable double-entry ledger logging all inventory movements (`OPENING_STOCK`, `TRANSFER_OUT`, `TRANSFER_IN`, `CONDITION_CHANGE`, `ADJUSTMENT`, `SALE`).
  - `stock_layers`: FIFO receipt layer table capturing receipt date, initial and remaining quantities, and unit cost for ageing calculations.
  - `stock_transfers` & `stock_transfer_items`: Inter-location transfer workflow with `DRAFT`, `DISPATCHED`, `RECEIVED`, and `CANCELLED` statuses.
  - `stock_adjustments`: Audited manual inventory adjustment log with mandatory reason codes (`DAMAGED_IN_STORE`, `PHYSICAL_COUNT_DISCREPANCY`, `CLERICAL_ERROR`, etc.).
- **Backend Stock Module (`backend/app/modules/stock/`):**
  - `StockService`: Row-level locked (`with_for_update`) atomic balance modifications preventing race conditions and blocking overselling.
  - `POST /api/v1/stock/opening`: Batch opening stock entry with automatic FIFO receipt layers.
  - `GET /api/v1/stock/balances`: Real-time queryable balances with multi-token search, location, and condition filters.
  - `GET /api/v1/stock/movements`: Historical audit ledger of all stock transitions.
  - `POST /api/v1/stock/transfers`: Dispatch inter-location transfers.
  - `PUT /api/v1/stock/transfers/{id}/receive`: Receive transfer items into destination store/godown.
  - `POST /api/v1/stock/condition-change`: Move items between conditions (e.g. Good to Damaged/Display) with zero net change to physical count.
  - `POST /api/v1/stock/adjustments`: Post audited count discrepancies.
  - `GET /api/v1/stock/ageing`: FIFO duration calculation with ageing bands (`0-30`, `31-60`, `61-90`, `91-180`, `180+` days) and valuation at cost.
  - `GET /api/v1/stock/reconciliation`: Automated reconciliation tool comparing ledger sums against balance running totals.
  - `GET /api/v1/stock/low-stock`: Reorder point threshold alerts.
- **Frontend Inventory & Stock Module:**
  - `StockBalancesPage`: Live balances matrix with metric strip, search, location and condition filters, and quick transfer/condition/adjustment modals.
  - `StockTransfersPage`: Transfer order register with dispatch, in-transit, and receiving modal workflows.
  - `StockMovementsPage`: Historical double-entry movement ledger with colored type tags and user references.
  - `StockAgeingPage`: Ageing duration dashboard with inventory valuation and 1-click ledger reconciliation verification.
  - `ProductDetailPage`: New "Stock by Location" tab displaying real-time stock balances and condition tags for every product.
  - `LandingPage`: Direct "Live Inventory" navigation pill in the compact metric strip.
- **Testing & Verification:**
  - Automated test suite `backend/tests/modules/test_stock.py` (4/4 passing; 32/32 total tests passing across Phase 0, 1, and 2).
  - Populated realistic opening stock data (61 movements) for primary user tenant `HomeDecor`.

## [Phase 1: Authentication, Business Setup & Product Catalogue] — 2026-10-24

### Added
- **Multi-Tenant Authentication:**
  - Business registration flow creating business, administrator user, and default tenant seeds
  - JWT token generation (short-lived access token + httpOnly refresh cookie)
  - Role-based server-side authorization dependency (`admin`, `staff`)
  - User management module allowing administrators to add staff and update roles
  - Own-profile view and password change endpoints
- **Master Data & Settings:**
  - Nested Categories with self-referential parent-child hierarchy and tree endpoints
  - Brands CRUD with logo and website metadata
  - Units of Measure CRUD supporting discrete and fractional decimals
  - Hierarchical Locations (store, showroom, warehouse, godown, floor, section, rack, shelf, bin)
  - Stock Conditions with sellable vs. hold flags
  - Tax Rates & GST Slabs with HSN/SAC classifications
  - Dynamic typed Attribute Definitions (`text`, `number`, `decimal`, `boolean`, `date`, `single_choice`, `multiple_choice`)
- **Product Catalogue:**
  - Product creation and editing with atomic multi-variant SKU generation and attribute value assignment
  - Full cross-tenant foreign key enforcement returning 404 for any out-of-tenant references
  - Full-text search and trigram indexing with attribute-matching search capability (e.g., matching "18W" or "Sheesham")
  - Price history tracking table logging changes to purchase price, selling price, and MRP
  - Product image upload, primary selection, ordering, and deletion
  - CSV bulk preview and validation with row-by-row error reporting
  - CSV import commit and export download
- **Frontend Application:**
  - Responsive layout with collapsible sidebar and global search bar
  - Landing / Discovery page featuring hero search bar, live result cards, quick metrics, and recently viewed products
  - Complete Product List table with filters, search, and bulk export
  - Product creation and editing form with inline variants table and category-driven dynamic attribute fields
  - Product detail view with overview specs, technical specs table, and photo gallery
  - CSV bulk import tool with drag-and-drop preview
  - Dedicated master data management pages for Categories, Brands, Units, Locations, Stock Conditions, Tax Rates, Business Profile, and Users
- **Testing & Verification:**
  - Comprehensive test suite covering authentication, category hierarchy, products, cross-tenant isolation, and price history

## [Phase 0: Foundation & Project Setup] — 2026-10-24

### Added
- Docker Compose configuration for PostgreSQL 16 (on host port 5433 to avoid port 5432 conflicts), FastAPI backend, and React frontend
- Python 3.11+ FastAPI backend skeleton with async SQLAlchemy 2.x and asyncpg
- Alembic database migration environment and initial foundation tables migration (`001_phase0_foundation_tables`)
- Common modules: Base declarative model with `TimestampMixin` and `TenantMixin`, pagination schemas, custom exception handling, and security utilities
- Health check API endpoint (`/api/v1/health`)
- Vite React 18 TypeScript frontend skeleton with Ant Design 5 and TanStack React Query
