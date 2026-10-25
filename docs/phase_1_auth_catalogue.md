# StockPilot — Phase 1: Authentication, Business Setup & Product Catalogue

> **Prerequisites:**
> - Phase 0 is complete and passing all acceptance checks
> - Read `docs/00_master_architecture.md` for all conventions
> - The project skeleton, Docker Compose, database, and migration infrastructure are working
>
> **Goal:** Users can register a business, log in, manage the product catalogue (categories, brands, units, attributes, products, SKUs, images), and search across products from a global landing page.
>
> **DO NOT BUILD:** Stock movements, purchasing, invoicing, payments, reports, or dashboards. Those belong to later phases.

---

## 1. Scope Summary

| # | Feature | Status |
|---|---|---|
| 1 | User registration (creates first business + admin user) | ☐ |
| 2 | Login / logout with JWT (access + refresh tokens) | ☐ |
| 3 | Get current user / current business info | ☐ |
| 4 | Server-side auth middleware and role-based authorization | ☐ |
| 5 | Business profile view and edit | ☐ |
| 6 | Categories CRUD (nested/hierarchical) | ☐ |
| 7 | Brands CRUD | ☐ |
| 8 | Units of Measure CRUD | ☐ |
| 9 | Locations CRUD (hierarchical: store, godown, rack, shelf, bin) | ☐ |
| 10 | Stock Conditions (configurable list) | ☐ |
| 11 | Tax Rates / GST Slabs (configurable list) | ☐ |
| 12 | Attribute Definitions CRUD (typed, category-specific) | ☐ |
| 13 | Products CRUD (create, view, edit, archive) | ☐ |
| 14 | Product Variants / SKUs CRUD | ☐ |
| 15 | Product Attribute Values (assign attributes to products/SKUs) | ☐ |
| 16 | Product Images (upload, primary, caption, sort) | ☐ |
| 17 | Product Search (global, paginated, filtered) | ☐ |
| 18 | Product Detail Page (overview, specs, images tabs) | ☐ |
| 19 | CSV Import for products (preview, validate, commit) | ☐ |
| 20 | CSV Export for products | ☐ |
| 21 | Seed/demo data (furniture, electrical, hardware, sanitaryware) | ☐ |
| 22 | User management (admin can add/edit users for their business) | ☐ |
| 23 | Frontend: Login page | ☐ |
| 24 | Frontend: Main layout with sidebar navigation | ☐ |
| 25 | Frontend: Landing page with global search | ☐ |
| 26 | Frontend: All catalogue management pages | ☐ |
| 27 | Frontend: Product detail page with tabs | ☐ |
| 28 | Frontend: Settings pages | ☐ |

### Delivery Checkpoints (Optional Simplification)
To enable earlier testing and validation, Phase 1 can be delivered in two milestones:
- **Checkpoint A (Core Auth, Catalogue & Search):** Registration, login, business setup, category/brand/location master data, product + variant + attribute creation, image upload, and landing page global search with attribute matching.
- **Checkpoint B (Bulk Tools & User Management):** CSV import/export with preview/validation, multi-user management, and remaining catalogue settings.

---

## 2. Database Schema — New Tables

### 2.1 Tables to ADD in Phase 1

Add these via a new Alembic migration: `alembic revision --autogenerate -m "phase1_catalogue_tables"`

Import ALL new models in `alembic/env.py` so autogenerate detects them.

#### `categories`

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT uq_categories_tenant_name_parent UNIQUE (tenant_id, name, parent_id)
);
CREATE INDEX ix_categories_tenant ON categories(tenant_id);
CREATE INDEX ix_categories_parent ON categories(parent_id);
```

#### `brands`

```sql
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_brands_tenant_name UNIQUE (tenant_id, name)
);
CREATE INDEX ix_brands_tenant ON brands(tenant_id);
```

#### `units_of_measure`

```sql
CREATE TABLE units_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    decimal_places INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_uom_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX ix_uom_tenant ON units_of_measure(tenant_id);
```

#### `locations`

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    location_type VARCHAR(50) NOT NULL DEFAULT 'other',
    -- location_type CHECK: 'store', 'showroom', 'warehouse', 'godown', 'floor', 'section', 'rack', 'shelf', 'bin', 'other'
    description TEXT,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ck_locations_type CHECK (location_type IN ('store', 'showroom', 'warehouse', 'godown', 'floor', 'section', 'rack', 'shelf', 'bin', 'other')),
    CONSTRAINT uq_locations_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX ix_locations_tenant ON locations(tenant_id);
CREATE INDEX ix_locations_parent ON locations(parent_id);
CREATE INDEX ix_locations_type ON locations(tenant_id, location_type);
```

#### `stock_conditions`

```sql
CREATE TABLE stock_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_sellable BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_stock_conditions_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX ix_stock_conditions_tenant ON stock_conditions(tenant_id);
```

Default seed values: `new_sellable` (sellable=true), `good_sellable` (sellable=true), `open_box_display` (sellable=true), `damaged` (sellable=false), `under_inspection` (sellable=false), `returned_pending` (sellable=false), `written_off` (sellable=false).

#### `tax_rates`

```sql
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    hsn_code VARCHAR(20),
    sac_code VARCHAR(20),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_tax_rates_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT ck_tax_rates_rate CHECK (rate >= 0 AND rate <= 100)
);
CREATE INDEX ix_tax_rates_tenant ON tax_rates(tenant_id);
```

Default seed values: `GST 0%` (0.00), `GST 5%` (5.00), `GST 12%` (12.00), `GST 18%` (18.00), `GST 28%` (28.00), `Exempt` (0.00).

#### `attribute_definitions`

```sql
CREATE TABLE attribute_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    -- data_type: 'text', 'number', 'decimal', 'boolean', 'date', 'single_choice', 'multiple_choice'
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    -- NULL means applicable to all categories
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_searchable BOOLEAN NOT NULL DEFAULT FALSE,
    is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
    unit_label VARCHAR(50),  -- e.g., "cm", "kg", "watts"
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ck_attr_def_data_type CHECK (data_type IN ('text', 'number', 'decimal', 'boolean', 'date', 'single_choice', 'multiple_choice')),
    CONSTRAINT uq_attr_def_tenant_code UNIQUE (tenant_id, code)
);
CREATE INDEX ix_attr_def_tenant ON attribute_definitions(tenant_id);
CREATE INDEX ix_attr_def_category ON attribute_definitions(category_id);
```

#### `attribute_options`

```sql
CREATE TABLE attribute_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    CONSTRAINT uq_attr_options_attr_value UNIQUE (attribute_id, value)
);
CREATE INDEX ix_attr_options_attr ON attribute_options(attribute_id);
```

#### `products`

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    model VARCHAR(255),
    tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
CREATE INDEX ix_products_tenant ON products(tenant_id);
CREATE INDEX ix_products_category ON products(tenant_id, category_id);
CREATE INDEX ix_products_brand ON products(tenant_id, brand_id);
CREATE INDEX ix_products_name ON products(tenant_id, name);
CREATE INDEX ix_products_active ON products(tenant_id, is_active);
```

#### `product_variants` (SKUs)

```sql
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    variant_name VARCHAR(255),
    barcode VARCHAR(100),
    barcode_type VARCHAR(20),  -- 'EAN13', 'CODE128', 'QR', etc. (placeholder for Phase 7)
    unit_id UUID REFERENCES units_of_measure(id) ON DELETE SET NULL,
    purchase_price NUMERIC(15,2) DEFAULT 0,
    selling_price NUMERIC(15,2) DEFAULT 0,
    mrp NUMERIC(15,2),
    reorder_point NUMERIC(15,3) DEFAULT 0,
    reorder_quantity NUMERIC(15,3) DEFAULT 0,
    weight_kg NUMERIC(10,3),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT uq_product_variants_tenant_sku UNIQUE (tenant_id, sku),
    CONSTRAINT ck_variant_purchase_price CHECK (purchase_price >= 0),
    CONSTRAINT ck_variant_selling_price CHECK (selling_price >= 0),
    CONSTRAINT ck_variant_mrp CHECK (mrp IS NULL OR mrp >= 0)
);
CREATE INDEX ix_variants_tenant ON product_variants(tenant_id);
CREATE INDEX ix_variants_product ON product_variants(product_id);
CREATE INDEX ix_variants_sku ON product_variants(tenant_id, sku);
CREATE INDEX ix_variants_barcode ON product_variants(tenant_id, barcode);
CREATE INDEX ix_variants_active ON product_variants(tenant_id, is_active);
```

#### `product_attribute_values`

```sql
CREATE TABLE product_attribute_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
    text_value TEXT,
    numeric_value NUMERIC(15,3),
    decimal_value NUMERIC(15,5),
    boolean_value BOOLEAN,
    date_value DATE,
    option_id UUID REFERENCES attribute_options(id) ON DELETE SET NULL,
    -- For multiple_choice, store comma-separated option_ids or use a junction table.
    -- For simplicity, store single option_id for single_choice; for multiple_choice use JSONB array.
    option_ids JSONB,  -- For multiple_choice: ["uuid1", "uuid2"]
    
    -- Either product_id or variant_id should be set, not both required
    CONSTRAINT ck_pav_product_or_variant CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE INDEX ix_pav_tenant ON product_attribute_values(tenant_id);
CREATE INDEX ix_pav_product ON product_attribute_values(product_id);
CREATE INDEX ix_pav_variant ON product_attribute_values(variant_id);
CREATE INDEX ix_pav_attribute ON product_attribute_values(attribute_id);
```

#### `product_images`

```sql
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    caption VARCHAR(500),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ck_pi_product_or_variant CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE INDEX ix_product_images_product ON product_images(product_id);
CREATE INDEX ix_product_images_variant ON product_images(variant_id);
```

#### `price_history`

```sql
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    price_type VARCHAR(20) NOT NULL,  -- 'purchase', 'selling', 'mrp'
    old_price NUMERIC(15,2),
    new_price NUMERIC(15,2) NOT NULL,
    changed_by UUID REFERENCES users(id),
    reason TEXT,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT ck_price_history_type CHECK (price_type IN ('purchase', 'selling', 'mrp'))
);
CREATE INDEX ix_price_history_variant ON price_history(variant_id);
CREATE INDEX ix_price_history_date ON price_history(tenant_id, effective_date);
```

#### Full-text search support

Add full-text search and trigram support for fast, flexible product discovery:

```sql
-- Add to products table
ALTER TABLE products ADD COLUMN search_vector tsvector;
CREATE INDEX ix_products_search ON products USING gin(search_vector);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        coalesce(NEW.name, '') || ' ' || 
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.model, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
```

Also add trigram extensions and index attribute values for attribute search (e.g. searching "18W" matches LED lights with 18W wattage):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX ix_variants_sku_trgm ON product_variants USING gin(sku gin_trgm_ops);
CREATE INDEX ix_pav_text_val ON product_attribute_values(tenant_id, text_value);
CREATE INDEX ix_pav_num_val ON product_attribute_values(tenant_id, numeric_value);
```

**Note:** Include these in the Alembic migration. Add `op.execute(...)` for raw SQL statements (triggers, extensions).

---

## 3. API Endpoints — Phase 1

### 3.1 Auth Endpoints

| Method | Path | Description | Auth Required | Role |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Register new business + admin user | No | — |
| POST | `/api/v1/auth/login` | Login, returns tokens | No | — |
| POST | `/api/v1/auth/refresh` | Refresh access token | Refresh token | — |
| POST | `/api/v1/auth/logout` | Invalidate session | Yes | Any |
| GET | `/api/v1/auth/me` | Current user + business info | Yes | Any |
| PUT | `/api/v1/auth/me` | Update own profile | Yes | Any |
| PUT | `/api/v1/auth/change-password` | Change own password | Yes | Any |

#### POST `/api/v1/auth/register`

**Request:**
```json
{
  "business_name": "Sharma Furniture",
  "email": "admin@sharmafurniture.com",
  "password": "SecureP@ss123",
  "full_name": "Rajesh Sharma",
  "phone": "9876543210"
}
```

**Response (201):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "full_name": "..." },
    "business": { "id": "uuid", "name": "Sharma Furniture" },
    "access_token": "jwt...",
    "refresh_token": "jwt..."
  },
  "message": "Business registered successfully"
}
```

**Logic:**
1. Validate email is unique globally
2. Create business record
3. Hash password, create user
4. Get or create "admin" role
5. Create business_user with admin role
6. Seed default stock_conditions, tax_rates, units_of_measure for this business
7. Generate JWT tokens
8. Audit log: "REGISTER" action

#### POST `/api/v1/auth/login`

**Request:**
```json
{
  "email": "admin@sharmafurniture.com",
  "password": "SecureP@ss123"
}
```

**Response (200):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "full_name": "...", "role": "admin" },
    "business": { "id": "uuid", "name": "Sharma Furniture" },
    "access_token": "jwt...",
    "refresh_token": "jwt..."
  }
}
```

**Logic:**
1. Find user by email
2. Verify password
3. Find active business_user membership
4. If user belongs to multiple businesses, return the first active one (multi-business selector is a future feature)
5. Generate tokens with `sub=user_id, tenant_id=business_id, role=role_name`
6. Update `last_login_at`
7. Audit log: "LOGIN"

#### GET `/api/v1/auth/me`

**Response:**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "full_name": "...", "phone": "..." },
    "business": { "id": "uuid", "name": "...", "currency": "INR", "timezone": "Asia/Kolkata" },
    "role": { "name": "admin", "display_name": "Administrator" },
    "permissions": ["products.view", "products.create", ...]
  }
}
```

### 3.2 Business Endpoints

| Method | Path | Description | Role |
|---|---|---|---|
| GET | `/api/v1/business/profile` | Get current business profile | Any |
| PUT | `/api/v1/business/profile` | Update business profile | Admin |

### 3.3 User Management Endpoints

| Method | Path | Description | Role |
|---|---|---|---|
| GET | `/api/v1/users` | List users in business | Admin |
| POST | `/api/v1/users` | Add user to business | Admin |
| GET | `/api/v1/users/{id}` | Get user details | Admin |
| PUT | `/api/v1/users/{id}` | Update user role/status | Admin |

#### POST `/api/v1/users`

**Request:**
```json
{
  "email": "staff@sharmafurniture.com",
  "password": "TempP@ss123",
  "full_name": "Suresh Kumar",
  "phone": "9876543211",
  "role_name": "staff"
}
```

**Logic:**
1. Check if email exists globally. If yes, check if they're already in this business. If not, create business_user membership.
2. If user doesn't exist, create user + business_user.
3. Audit log: "USER_ADDED"

### 3.4 Settings/Master Data Endpoints

Each master entity follows the same pattern:

| Method | Path | Description | Role |
|---|---|---|---|
| GET | `/api/v1/categories` | List (tree or flat, filterable) | Admin, Staff |
| POST | `/api/v1/categories` | Create | Admin |
| GET | `/api/v1/categories/{id}` | Get one | Admin, Staff |
| PUT | `/api/v1/categories/{id}` | Update | Admin |
| DELETE | `/api/v1/categories/{id}` | Archive (soft delete) | Admin |

Same pattern for: `/api/v1/brands`, `/api/v1/units`, `/api/v1/locations`, `/api/v1/stock-conditions`, `/api/v1/tax-rates`, `/api/v1/attributes`.

#### Special: Categories Tree

`GET /api/v1/categories?format=tree` should return nested:
```json
{
  "data": [
    {
      "id": "uuid", "name": "Furniture", "children": [
        { "id": "uuid", "name": "Sofas", "children": [] },
        { "id": "uuid", "name": "Tables", "children": [] }
      ]
    }
  ]
}
```

#### Special: Locations Tree

`GET /api/v1/locations?format=tree` — same nested structure.

#### Special: Attributes

`GET /api/v1/attributes?category_id=xxx` — filter attributes by category.

`POST /api/v1/attributes` — Create attribute:
```json
{
  "name": "Width",
  "code": "width",
  "data_type": "decimal",
  "category_id": "uuid-for-furniture",
  "is_required": false,
  "is_searchable": true,
  "unit_label": "cm",
  "options": []  // Only for single_choice/multiple_choice
}
```

For choice types, include options:
```json
{
  "name": "Color",
  "code": "color",
  "data_type": "single_choice",
  "is_searchable": true,
  "is_filterable": true,
  "options": [
    { "value": "Red" },
    { "value": "Blue" },
    { "value": "Grey" },
    { "value": "Walnut" }
  ]
}
```

### 3.5 Product Endpoints

| Method | Path | Description | Role |
|---|---|---|---|
| GET | `/api/v1/products` | List/search products (paginated) | Admin, Staff |
| POST | `/api/v1/products` | Create product + variants + attributes | Admin |
| GET | `/api/v1/products/{id}` | Full product detail | Admin, Staff |
| PUT | `/api/v1/products/{id}` | Update product | Admin |
| DELETE | `/api/v1/products/{id}` | Archive product | Admin |
| GET | `/api/v1/products/search` | Global search (landing page) | Admin, Staff |
| POST | `/api/v1/products/import` | CSV import | Admin |
| GET | `/api/v1/products/export` | CSV export | Admin |
| POST | `/api/v1/products/import/preview` | Preview CSV before import | Admin |

#### POST `/api/v1/products`

**Request:**
```json
{
  "name": "Three-Seater Sofa",
  "description": "Premium fabric sofa with wooden legs",
  "category_id": "uuid",
  "brand_id": "uuid",
  "model": "Comfort Plus 210",
  "tax_rate_id": "uuid",
  "variants": [
    {
      "sku": "SOFA-3S-GRY-001",
      "variant_name": "Grey Fabric, 210cm, Walnut Legs",
      "barcode": "8901234567890",
      "unit_id": "uuid-for-piece",
      "purchase_price": 15000.00,
      "selling_price": 28000.00,
      "mrp": 32000.00,
      "reorder_point": 2,
      "reorder_quantity": 5
    }
  ],
  "attributes": [
    { "attribute_id": "uuid-width", "decimal_value": 210.0 },
    { "attribute_id": "uuid-depth", "decimal_value": 85.0 },
    { "attribute_id": "uuid-height", "decimal_value": 78.0 },
    { "attribute_id": "uuid-color", "option_id": "uuid-grey" },
    { "attribute_id": "uuid-material", "text_value": "Sheesham wood frame" },
    { "attribute_id": "uuid-upholstery", "text_value": "Premium cotton fabric" }
  ]
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Three-Seater Sofa",
    "category": { "id": "uuid", "name": "Sofas" },
    "brand": { "id": "uuid", "name": "HomeCraft" },
    "variants": [
      {
        "id": "uuid",
        "sku": "SOFA-3S-GRY-001",
        "variant_name": "Grey Fabric, 210cm, Walnut Legs",
        "selling_price": 28000.00,
        "unit": { "code": "PC", "name": "Piece" }
      }
    ],
    "attributes": [ ... ],
    "images": [],
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Product created successfully"
}
```

**Logic:**
1. **Cross-Tenant Foreign Key Validation:** Verify that `category_id`, `brand_id`, `tax_rate_id`, variant `unit_id`, and all `attribute_id` / `option_id` values exist and belong to the current shop (`tenant_id`). If any belong to another tenant or do not exist, return `404 Not Found` (never reveal another tenant's records). Same rule applies when assigning parent categories or parent locations.
2. Check SKU uniqueness within tenant
3. Create product, variants, attribute values in one transaction
4. Record price_history entries for initial prices
5. Audit log: "CREATE" on entity_type "product"

#### GET `/api/v1/products/search`

**Query params:**
```
?q=18W&category_id=uuid&brand_id=uuid&is_active=true&page=1&page_size=20&sort_by=name&sort_order=asc
```

**Search logic:**
1. If `q` is provided, search across:
   - Product name, description, model (via PostgreSQL full-text `search_vector` and trigram)
   - SKU, barcode (via ILIKE / trigram matching on product variants)
   - Brand name and Category name
   - **Searchable product specifications/attributes:** Join `product_attribute_values` and `attribute_definitions` (where `is_searchable = TRUE`) to match text values, choice option labels (e.g., "Sheesham", "Matte"), and numeric values combined with unit labels (e.g., searching "18W" matches numeric value `18` with unit label `"W"` or text `"18W"`).
2. Join product_variants to include SKU/barcode matches
3. Apply filters: category, brand, is_active
4. Return paginated results with:
   - Product name, thumbnail (primary image URL), category, brand
   - First/default SKU, selling price
   - is_active status

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Three-Seater Sofa",
      "category": "Sofas",
      "brand": "HomeCraft",
      "model": "Comfort Plus 210",
      "primary_image_url": "/uploads/...",
      "default_sku": "SOFA-3S-GRY-001",
      "selling_price": 28000.00,
      "mrp": 32000.00,
      "variant_count": 1,
      "is_active": true
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total_items": 45, "total_pages": 3 }
}
```

#### Product Image Upload

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/products/{id}/images` | Upload image(s) |
| PUT | `/api/v1/products/{id}/images/{image_id}` | Update caption/primary/sort |
| DELETE | `/api/v1/products/{id}/images/{image_id}` | Remove image |

**Upload:** Accept `multipart/form-data`. Validate file type (JPEG, PNG, WebP), max size (from config, default 10MB). Store in `uploads/products/{tenant_id}/{product_id}/` directory. Store metadata in `product_images` table.

#### CSV Import

**`POST /api/v1/products/import/preview`**

Accept CSV file upload. Parse and validate:
- Required columns: `name`, `sku` (at minimum)
- Optional columns: `description`, `category`, `brand`, `model`, `unit`, `purchase_price`, `selling_price`, `mrp`, `barcode`, and any attribute codes as column headers
- Validate: SKU uniqueness, category/brand existence, data types
- Return preview with row-level status:

```json
{
  "data": {
    "total_rows": 50,
    "valid_rows": 47,
    "error_rows": 3,
    "preview": [
      { "row": 1, "status": "valid", "data": { "name": "...", "sku": "..." } },
      { "row": 5, "status": "error", "errors": ["Duplicate SKU: XYZ-001"] },
      ...
    ]
  }
}
```

**`POST /api/v1/products/import`**

Accept the validated CSV. Import all valid rows. Skip error rows. Return summary:
```json
{
  "data": {
    "imported": 47,
    "skipped": 3,
    "errors": [
      { "row": 5, "errors": ["Duplicate SKU: XYZ-001"] }
    ]
  }
}
```

#### CSV Export

**`GET /api/v1/products/export?format=csv`**

Export current filtered product list as CSV download. Include: name, sku, category, brand, model, unit, purchase_price, selling_price, mrp, barcode, is_active, and attribute values as columns.

---

## 4. Frontend Pages — Phase 1

### 4.1 Login Page (`/login`)

- Email + password form
- "Register new business" link → registration form (modal or separate page)
- Registration form: business name, admin email, password, full name, phone
- On success: redirect to home/landing page
- Show validation errors from API
- Remember email (localStorage, optional)

### 4.2 Main Layout

**Desktop:** Ant Design `Layout` with:
- **Left Sidebar (`Sider`):** Collapsible. Menu items:
  - 🏠 Home (landing/search)
  - 📦 Catalogue
    - Products
    - Categories
    - Brands
  - 📍 Locations
  - ⚙️ Settings
    - Business Profile
    - Users
    - Units
    - Attributes
    - Stock Conditions
    - Tax Rates
- **Header:** App name, global search input, user dropdown (profile, logout)
- **Content area:** Routed page content

**Mobile:** Hamburger menu, stacked layout.

### 4.3 Landing Page / Home (`/`)

- **Prominent search bar** at top (like Google, hero-style)
- Search across products by name, SKU, barcode, category, brand
- **Search results** in card or table view:
  - Thumbnail, product name, SKU, brand, category
  - Selling price, MRP
  - Status badge (active/archived)
- Click a result → navigate to product detail
- **Below search:** Quick stats cards (placeholder for now):
  - Total products, total SKUs, categories count
- **Recently viewed products** (store in localStorage)

### 4.4 Product List Page (`/products`)

- Ant Design `Table` with columns: Image, Name, SKU, Category, Brand, Price, Status
- Filters: category dropdown, brand dropdown, active/archived toggle, search input
- Pagination controls
- "Add Product" button (top right)
- Row click → product detail
- Bulk actions: export selected

### 4.5 Product Create/Edit (`/products/new`, `/products/:id/edit`)

- **Form layout** (not modal — these are complex forms)
- Sections:
  1. **Basic Info:** Name, description, category (tree select), brand, model, tax rate
  2. **Variants/SKUs:** Inline editable table. Columns: SKU, variant name, barcode, unit, purchase price, selling price, MRP, reorder point, reorder qty. Add/remove rows.
  3. **Attributes:** Dynamic form fields based on selected category's attribute definitions. Show appropriate input types (text field, number input, date picker, select dropdown, checkbox).
  4. **Images:** Upload zone (drag & drop), thumbnail grid, set primary, add caption, reorder.
- Save → API call → redirect to product detail

### 4.6 Product Detail Page (`/products/:id`)

- **Header:** Product name, SKU, category/brand badges, active status, edit button
- **Primary image** with image gallery
- **Tabs:**
  1. **Overview:** Key specs, prices, unit, barcode, model, description
  2. **Specifications:** All attribute values in a key-value table
  3. **Images:** Full image gallery with captions
  4. *(Stock by Location — placeholder tab, implemented in Phase 2)*
  5. *(Purchase History — placeholder tab, implemented in Phase 3)*
  6. *(Sales History — placeholder tab, implemented in Phase 4)*
  7. *(Movement History — placeholder tab, implemented in Phase 2)*

### 4.7 Categories Page (`/settings/categories`)

- Tree view (Ant Design `Tree` component) showing nested categories
- Add/edit/archive category (inline or modal)
- Drag to reorder (optional, nice-to-have)

### 4.8 Brands Page (`/settings/brands`)

- Simple table: Name, Description, Status
- Add/edit/archive

### 4.9 Locations Page (`/locations`)

- Tree view showing location hierarchy
- Add/edit/archive location
- Show location type, code, address

### 4.10 Settings Pages

- **Business Profile** (`/settings/business`): Form to edit business details
- **Users** (`/settings/users`): Table of users, add user form, change role
- **Units** (`/settings/units`): Table CRUD
- **Attributes** (`/settings/attributes`): Table with data type badges, category association
- **Stock Conditions** (`/settings/stock-conditions`): Table CRUD with sellable toggle
- **Tax Rates** (`/settings/tax-rates`): Table CRUD with rate, HSN/SAC fields

### 4.11 CSV Import Page (`/products/import`)

1. Upload CSV file (drag & drop zone)
2. Show preview table with status column (valid ✅ / error ❌)
3. Error rows highlighted with error messages
4. "Import Valid Rows" button
5. Show result summary

---

## 5. Backend Implementation Details

### 5.1 Auth Middleware

Create `app/dependencies.py`:

```python
from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.common.security import decode_token
from app.common.exceptions import UnauthorizedException, ForbiddenException
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.auth.models import User, BusinessUser, RolePermission, Permission
import uuid

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tenant_id"])
        role = payload.get("role", "")
    except Exception:
        raise UnauthorizedException("Invalid or expired token")
    
    # Verify user still exists and is active
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException("User not found or inactive")
    
    # Attach tenant context
    user.current_tenant_id = tenant_id
    user.current_role = role
    
    return user

def require_role(*allowed_roles: str):
    """Dependency that checks if the current user has one of the allowed roles."""
    async def role_checker(user = Depends(get_current_user)):
        if user.current_role not in allowed_roles:
            raise ForbiddenException(f"Role '{user.current_role}' is not authorized for this action")
        return user
    return role_checker

def get_tenant_id(user = Depends(get_current_user)) -> uuid.UUID:
    """Extract tenant_id from the authenticated user."""
    return user.current_tenant_id
```

### 5.2 File Storage Service

Create `app/common/storage.py`:

```python
import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Convert to bytes

async def save_upload(
    file: UploadFile,
    subdirectory: str,
    allowed_types: set = ALLOWED_IMAGE_TYPES,
) -> dict:
    """Save an uploaded file and return metadata."""
    # Validate type
    if file.content_type not in allowed_types:
        raise ValueError(f"File type {file.content_type} not allowed")
    
    # Read content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    
    # Create directory
    upload_path = Path(settings.UPLOAD_DIR) / subdirectory
    upload_path.mkdir(parents=True, exist_ok=True)
    
    # Write file
    file_path = upload_path / unique_name
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return metadata
    return {
        "file_url": f"/uploads/{subdirectory}/{unique_name}",
        "file_name": file.filename or unique_name,
        "file_size": len(content),
        "mime_type": file.content_type,
    }

async def delete_file(file_url: str):
    """Delete a file by its URL path."""
    file_path = Path(settings.UPLOAD_DIR) / file_url.lstrip("/uploads/")
    if file_path.exists():
        os.remove(file_path)
```

**Serve static files** — Add to `main.py`:
```python
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
```

### 5.3 Price History Tracking

Whenever a variant's `purchase_price`, `selling_price`, or `mrp` is updated, create a `price_history` record with the old and new values.

---

## 6. Seed Data — Phase 1

Extend `app/seeds/seed_data.py` with a `seed_demo_data()` function that creates:

### Business
- Name: "Demo Retailer"
- Admin user: demo@stockpilot.com / DemoPass123

### Categories
```
Furniture
├── Sofas
├── Tables
├── Chairs
├── Beds
Electrical
├── Lighting
├── Switches & Sockets
├── Wiring
Hardware
├── Fasteners
├── Tools
├── Adhesives
Sanitaryware
├── Basins
├── Toilets
├── Faucets
```

### Brands
HomeCraft, Philips, Havells, Jaquar, Asian Paints, Godrej, Stanley, Fischer

### Units
PC (Piece, 0 decimal), BOX (Box, 0), PKT (Packet, 0), MTR (Meter, 2), SQFT (Square Foot, 2), KG (Kilogram, 3), LTR (Litre, 3), SET (Set, 0), ROLL (Roll, 0)

### Locations
```
Main Store (type: store)
├── Ground Floor (type: floor)
│   ├── Display Area A (type: section)
│   └── Display Area B (type: section)
├── First Floor (type: floor)
Godown 1 (type: godown)
├── Section A (type: section)
│   ├── Rack 1 (type: rack)
│   └── Rack 2 (type: rack)
├── Section B (type: section)
```

### Attributes (by category)

**Furniture:**
- Width (decimal, cm, searchable)
- Depth (decimal, cm)
- Height (decimal, cm)
- Frame Material (single_choice: Sheesham, Teak, Metal, MDF, Plywood)
- Upholstery (text)
- Color (single_choice: Red, Blue, Grey, Brown, Beige, Black, White, Walnut, Natural)
- Finish (single_choice: Matte, Glossy, Natural, Lacquered, PU)
- Seating Capacity (number)

**Electrical:**
- Wattage (decimal, W, searchable)
- Voltage (decimal, V)
- Color Temperature (single_choice: Warm White, Cool White, Daylight)
- Phase (single_choice: Single, Three)
- Wire Gauge (text)
- IP Rating (text)
- Warranty (text)

**Hardware:**
- Diameter (decimal, mm, searchable)
- Length (decimal, mm)
- Grade (text, searchable)
- Material (single_choice: SS, MS, Brass, Aluminium, Zinc)
- Finish (single_choice: Plain, Galvanized, Chrome, Black Oxide)

**Sanitaryware:**
- Size/Width (decimal, mm, searchable)
- Material (single_choice: Ceramic, Vitreous China, Stainless Steel)
- Color (single_choice: White, Ivory, Grey, Black)
- Mounting Type (single_choice: Wall Mount, Counter Top, Pedestal, Under Counter)
- Tap Hole Configuration (single_choice: Single Hole, Three Hole, No Hole)

### Sample Products (4 minimum)

1. **Three-Seater Sofa** (Furniture > Sofas)
   - SKU: SOFA-3S-GRY-001
   - Brand: HomeCraft, Model: Comfort Plus 210
   - Purchase: ₹15,000, Selling: ₹28,000, MRP: ₹32,000
   - Attributes: 210cm × 85cm × 78cm, Sheesham frame, Grey cotton, Matte finish

2. **LED Panel Light 18W** (Electrical > Lighting)
   - SKU: LED-PNL-18W-001
   - Brand: Philips, Model: AstraLine
   - Purchase: ₹320, Selling: ₹550, MRP: ₹650
   - Unit: Piece
   - Attributes: 18W, 220V, Cool White

3. **SS Screw M6×25** (Hardware > Fasteners)
   - SKU: SCR-SS-M6-25-001
   - Brand: Fischer
   - Purchase: ₹250/box, Selling: ₹400/box
   - Unit: Box
   - Attributes: 6mm diameter, 25mm length, SS 304, Plain

4. **Wash Basin 550mm** (Sanitaryware > Basins)
   - SKU: BSN-CER-550-001
   - Brand: Jaquar, Model: Lyric
   - Purchase: ₹2,800, Selling: ₹4,500, MRP: ₹5,200
   - Unit: Piece
   - Attributes: 550mm, Ceramic, White, Counter Top, Single Hole

---

## 7. Tests — Phase 1

### Backend Tests to Write

#### Auth Tests (`tests/modules/test_auth.py`)

```
test_register_creates_business_and_admin_user
test_register_duplicate_email_returns_409
test_register_missing_fields_returns_422
test_login_valid_credentials_returns_tokens
test_login_invalid_password_returns_401
test_login_nonexistent_email_returns_401
test_login_inactive_user_returns_401
test_me_returns_current_user_and_business
test_me_without_token_returns_401
test_me_with_expired_token_returns_401
test_change_password_success
test_change_password_wrong_current_password
```

#### Category Tests (`tests/modules/test_categories.py`)

```
test_create_category_success
test_create_subcategory_with_parent
test_create_duplicate_category_returns_409
test_list_categories_returns_paginated
test_list_categories_tree_format
test_update_category
test_archive_category
test_categories_isolated_between_tenants
test_staff_cannot_create_category
test_create_category_rejects_parent_from_another_tenant
```

#### Product Tests (`tests/modules/test_products.py`)

```
test_create_product_with_variant_and_attributes
test_create_product_duplicate_sku_returns_409
test_create_product_rejects_foreign_key_from_another_tenant
test_list_products_paginated
test_search_products_by_name
test_search_products_by_sku
test_search_products_by_category
test_search_products_by_brand
test_search_products_by_attribute_spec
test_get_product_detail
test_update_product
test_archive_product
test_products_isolated_between_tenants
test_upload_product_image
test_set_primary_image
test_csv_import_preview_valid_file
test_csv_import_preview_invalid_rows
test_csv_import_commit
test_csv_export
test_price_history_created_on_price_change
```

#### Tenant Isolation Test (`tests/modules/test_tenant_isolation.py`)

```
test_tenant_a_cannot_see_tenant_b_products
test_tenant_a_cannot_see_tenant_b_categories
test_tenant_a_cannot_update_tenant_b_product
```

---

## 8. Acceptance Checklist

- [ ] Admin can register a new business and log in
- [ ] Login returns JWT tokens; authenticated requests work
- [ ] Unauthorized requests return 401; forbidden requests return 403
- [ ] Admin can create categories (including nested subcategories)
- [ ] Admin can create brands, units, locations (hierarchical), stock conditions, tax rates
- [ ] Admin can create attribute definitions with data types and options
- [ ] Admin can create a product with SKU, attributes, and images
- [ ] **Furniture product** (sofa with dimensions, fabric, color, finish) works without schema changes
- [ ] **Electrical product** (LED light with wattage, voltage, color temp) works without schema changes
- [ ] Duplicate SKU within the same business is rejected (409)
- [ ] Product images upload and display correctly (primary image shown in search)
- [ ] Global search returns results by name, SKU, barcode, category, brand, and searchable attribute specifications (e.g. searching "18W" finds the 18W LED panel)
- [ ] Cross-tenant foreign key references are rejected with 404 (categories, brands, units, tax rates, attributes, parent locations)
- [ ] Search results are paginated with proper pagination metadata
- [ ] Product detail page shows overview, specifications, and images tabs
- [ ] Archived products don't appear in default search (`is_active=true`)
- [ ] CSV import: preview shows validation errors; import commits valid rows
- [ ] CSV export: downloads filtered product list
- [ ] Staff role user cannot access admin-only settings (server-side check)
- [ ] Data is isolated between tenants (Tenant A cannot see Tenant B's products)
- [ ] Price history records are created when prices change
- [ ] All tests pass: `pytest -v`
- [ ] Responsive layout works on desktop and mobile browser widths
- [ ] Loading, empty state, and error states are handled on all pages

---

## 9. Demo Scenario

After Phase 1, demonstrate:

1. Register "Sharma Furniture" business with admin user
2. Log in as admin
3. Create categories: Furniture > Sofas, Electrical > Lighting
4. Create attributes: width, depth, height, color for Furniture; wattage, voltage for Electrical
5. Create a sofa product with dimensions, fabric, color, finish attributes
6. Upload 2 images for the sofa, set one as primary
7. Create an LED panel light with wattage, voltage, color temperature
8. Search for "sofa" from the landing page — sofa appears with thumbnail
9. Search for "18W" — LED panel appears
10. Open sofa detail → verify specs tab shows all attributes
11. Import 10 products via CSV → show preview → commit
12. Add a staff user → verify they can view products but cannot edit settings

---

## 10. What NOT To Build in Phase 1

- ❌ Stock balances or stock movements (Phase 2)
- ❌ Opening stock entry (Phase 2)
- ❌ Stock transfers (Phase 2)
- ❌ Suppliers or purchase orders (Phase 3)
- ❌ Customers or invoices (Phase 4)
- ❌ Payments (Phase 4)
- ❌ Returns (Phase 5)
- ❌ Reports or dashboards (Phase 6)
- ❌ Barcode scanning/printing UI (Phase 7)
- ❌ Time-bound offers/promotions (Phase 4)
- ❌ Stock reservation (Phase 7)
- ❌ Quotations/sales orders (Phase 7)

---

## 11. Handoff to Phase 2

Once Phase 1 passes all acceptance checks and the user approves, proceed to Phase 2: Stock balances, movements, transfers, and ageing. The architect will provide `phase_2_stock_movements.md`.

**End of Phase 1 specification.**
