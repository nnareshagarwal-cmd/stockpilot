# StockPilot — Phases 2 to 7 Roadmap & Detailed Engineering Specification

> **Reference Documents:**
> - [00_master_architecture.md](file:///c:/My%20Drive/vscodeworkspace1_v1_homedecor/docs/00_master_architecture.md) — Architectural rules, multi-tenant isolation, and coding standards
> - [generic_inventory_management_phased_spec_multitenant.md](file:///c:/My%20Drive/vscodeworkspace1_v1_homedecor/docs/generic_inventory_management_phased_spec_multitenant.md) — Master product specification
> - [phase_0_foundation.md](file:///c:/My%20Drive/vscodeworkspace1_v1_homedecor/docs/phase_0_foundation.md) — Foundation, Docker, PostgreSQL & Alembic setup (Complete)
> - [phase_1_auth_catalogue.md](file:///c:/My%20Drive/vscodeworkspace1_v1_homedecor/docs/phase_1_auth_catalogue.md) — Authentication, multi-tenant DB, master settings & product catalogue (Complete)

---

## Executive Phase Summary (Phases 2 – 7)

| Phase | Title | Core Goal | Key New Database Tables | Primary UI Screens |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 2** *(Next)* | **Opening Stock, Balances, Movements & Ageing** | Real physical stock tracking across locations and condition states (New, Good, Damaged, Display). Ledger of all movements; zero negative stock; FIFO receipt-layer ageing. | `stock_balances`, `stock_movements`, `stock_layers`, `stock_transfers`, `stock_transfer_items`, `stock_adjustments` | Stock Balances Matrix, Movement Ledger, Location Transfer Modal, Adjustment Modal, Ageing Summary |
| **Phase 3** | **Suppliers, Purchase Orders & Goods Receipt (GRN)** | Procure stock from suppliers, handle partial receipts, track incoming purchase costs, and automatically increment stock balances via Goods Receipt Notes (GRN). | `suppliers`, `purchase_orders`, `purchase_order_lines`, `goods_receipt_notes`, `goods_receipt_lines` | Suppliers Directory, Purchase Orders Manager, GRN Entry with Damaged/Shortage Recording |
| **Phase 4** | **Customers, Sales Invoicing, Billing & Payments** | Sell inventory to customers with auto-stock deduction, customizable tax/GST invoice numbers, line & invoice discounts, partial/split payments (Cash, UPI, Card), and printable A4 invoice PDFs. | `customers`, `invoices`, `invoice_lines`, `payments` | Customer Directory, Fast POS / Sales Billing Screen, Invoices List & Printable A4 PDF Viewer |
| **Phase 5** | **Returns, Physical Audits & Operational Controls** | Manage customer sales returns, supplier debit returns, physical cycle count sessions, approval workflows for variances, and full document reversals. | `sales_returns`, `sales_return_lines`, `supplier_returns`, `stock_count_sessions`, `stock_count_items` | Sales Return Modal, Supplier Return Screen, Stock Count Audit Session, Variance Approval |
| **Phase 6** | **Reports, Dashboards, Valuation & Analytics** | Strategic business intelligence: Real-time Stock Summary by Location, FIFO/Landed Inventory Valuation, Ageing Bands (0–30, 31–60, 90+ days), Sales & Purchase Registers, and CSV/Excel exports. | *(Analytical queries, indexed views, and reporting functions)* | Executive Dashboard, Stock Ageing Matrix, Low Stock Alert Screen, Sales / Profit Margin Reports |
| **Phase 7** | **Advanced Workflows & Retail Configurability** | High-velocity retail tools: Quotations to invoice conversion, barcode generation & scanner support, packaging unit conversions (Box to Piece), and serial number tracking. | `quotations`, `quotation_lines`, `serial_numbers`, `unit_conversions` | Barcode Print Studio, Quotation Builder, Serial Number Lookup, Packaging Conversion Config |

---

# Architectural Progression Diagram

```
                       ┌──────────────────────────────────────────────┐
                       │  Phase 1: Product Catalogue (Completed)      │
                       │  SKUs, Attributes, Categories, Locations     │
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │  Phase 2: Stock Balances, Ledger & Movements │  ◄── CURRENT FOCUS
                       │  Balances, Transfers, Conditions, FIFO Ageing│
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │  Phase 3: Suppliers, POs & Goods Receipt     │
                       │  Inward Shipments, Landed Costs, GRN Ledger  │
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │  Phase 4: Sales Invoicing & Billing (POS)    │
                       │  Outward Stock, Discounts, GST, A4 PDF Bill  │
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │  Phase 5: Returns & Physical Stock Audits    │
                       │  Customer Returns, Blind Audits, Adjustments │
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │  Phase 6: Reporting, Ageing & Dashboards     │
                       │  Gross Margins, Dead Stock Bands, CSV Export │
                       └──────────────────────┬───────────────────────┘
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │  Phase 7: Advanced Workflows (Barcodes/Quotes│
                       │  Quotations, Barcode Labels, Box->Pcs Units  │
                       └──────────────────────────────────────────────┘
```

---

## Phase 2 — Opening Stock, Balances, Movements, Transfers & Ageing

### 1. Goal & Business Value
In Phase 1, we established **what products exist** (catalogue, SKUs, attributes, locations).
In Phase 2, we establish **how many units physically exist, where they are stored, what condition they are in, and how they move**.
- Answers: *"How many Eleanor King Beds are in Showroom 2nd Floor vs Gali Godown? How many are damaged vs sellable? How many days have they been in stock?"*
- Eliminates manual stock guesswork: Every stock change creates an immutable, auditable movement record.

### 2. Phase 2 Scope Checklist

| # | Feature | Description |
|---|---|---|
| 1 | **Opening Stock Entry** | Initial stock intake with quantity, location, condition, unit cost, and reference. |
| 2 | **Real-time Stock Balances** | Aggregate balances grouped by `(variant_id, location_id, condition_id)`. |
| 3 | **Double-Entry Stock Ledger** | Every quantity change writes a row in `stock_movements` (no silent balance overwrites). |
| 4 | **Stock Transfers** | Move items between locations (e.g. Gali Godown → Showroom 2nd Floor) with in-transit states. |
| 5 | **Condition Changes** | Transfer stock between conditions (e.g. Good → Damaged or Display) with reason & photo note. |
| 6 | **Stock Adjustments** | Admin-authorized manual adjustments (found, lost, clerical fix) requiring reason codes. |
| 7 | **FIFO Receipt Layers (Ageing)** | Stores incoming receipt date and unit cost layers to calculate exact stock age in days. |
| 8 | **Reorder / Low-Stock Alerts** | Triggers alert when available sellable stock falls below `variant.reorder_point`. |
| 9 | **Reconciliation Checker** | Automated tool verifying sum of ledger movements equals current stock balances. |
| 10 | **Discovery & Detail Integration**| Live stock quantity and location tags automatically reflect in Landing Page & Product Details. |

### 3. Phase 2 Database Schema (Alembic Migration 003)

```sql
-- 1. Stock Balances (Fast lookup of on-hand, reserved, and available quantities)
CREATE TABLE stock_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    condition_id UUID NOT NULL REFERENCES stock_conditions(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    reserved_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_stock_balance UNIQUE (tenant_id, variant_id, location_id, condition_id),
    CONSTRAINT chk_positive_quantity CHECK (quantity >= 0) -- Blocks negative stock by default
);

-- 2. Stock Movements Ledger (The single source of truth for all inventory events)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL, -- 'OPENING_STOCK', 'PURCHASE_RECEIPT', 'SALE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'CONDITION_CHANGE', 'RETURN'
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    condition_id UUID NOT NULL REFERENCES stock_conditions(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL, -- Positive for intake, negative for deduction
    balance_after NUMERIC(12, 3) NOT NULL,
    unit_cost NUMERIC(12, 2),
    reference_type VARCHAR(50), -- 'opening_entry', 'transfer', 'adjustment', 'grn', 'invoice'
    reference_id UUID,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Stock Layers (For accurate FIFO ageing calculation and cost tracking)
CREATE TABLE stock_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    condition_id UUID NOT NULL REFERENCES stock_conditions(id) ON DELETE RESTRICT,
    initial_quantity NUMERIC(12, 3) NOT NULL,
    remaining_quantity NUMERIC(12, 3) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    received_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Stock Transfers (Inter-location transfer with dispatch & receive states)
CREATE TABLE stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    transfer_number VARCHAR(50) NOT NULL,
    source_location_id UUID NOT NULL REFERENCES locations(id),
    destination_location_id UUID NOT NULL REFERENCES locations(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED'
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    dispatched_by UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_transfer_number UNIQUE (tenant_id, transfer_number)
);

CREATE TABLE stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id),
    condition_id UUID NOT NULL REFERENCES stock_conditions(id),
    quantity NUMERIC(12, 3) NOT NULL,
    received_quantity NUMERIC(12, 3) DEFAULT 0.000
);

-- 5. Stock Adjustments (Audit log for manual variance corrections)
CREATE TABLE stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    adjustment_number VARCHAR(50) NOT NULL,
    variant_id UUID NOT NULL REFERENCES product_variants(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    condition_id UUID NOT NULL REFERENCES stock_conditions(id),
    quantity_delta NUMERIC(12, 3) NOT NULL, -- e.g. -1 or +2
    reason_code VARCHAR(50) NOT NULL, -- 'DAMAGED_IN_STORE', 'PHYSICAL_COUNT_DISCREPANCY', 'CLERICAL_ERROR', 'SAMPLE'
    notes TEXT,
    approved_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4. Phase 2 Backend API Endpoints

- `POST /api/v1/stock/opening` — Batch intake of opening stock entries.
- `GET  /api/v1/stock/balances` — Paginated stock balances filterable by variant, location, condition, category, or search term.
- `GET  /api/v1/stock/movements` — Complete historical ledger of movements with date range, user, and transaction reference.
- `POST /api/v1/stock/transfers` — Create & dispatch stock transfer between locations.
- `PUT  /api/v1/stock/transfers/{id}/receive` — Complete receipt of stock transfer at destination.
- `POST /api/v1/stock/condition-change` — Move stock from Good to Damaged / Display with reason.
- `POST /api/v1/stock/adjustments` — Record physical variance adjustment with approval audit.
- `GET  /api/v1/stock/ageing` — Ageing summary breakdown by bands (0–30, 31–60, 61–90, 91–180, 180+ days).
- `GET  /api/v1/stock/reconciliation` — Automated validation comparing sum of ledger to running balances.

### 5. Phase 2 Acceptance Criteria & Demo Scenario
1. **Opening Stock**: Enter 10 King Beds in *Gali Godown Ground Floor* at ₹22,000 unit cost.
2. **Transfer**: Dispatch 4 King Beds from *Gali Godown* to *Showroom Second Floor*.
   - Verify *Gali Godown* shows 6 on hand.
   - Verify *In-Transit* shows 4.
   - Complete receipt at *Showroom Second Floor* → balance becomes 4.
3. **Condition Change**: Change 1 King Bed in Showroom from "Good" to "Damaged (Display scratch)".
   - Verify Sellable stock = 3, Damaged = 1. Physical total remains 4.
4. **Zero Negative Stock**: Attempting to transfer or sell 10 units when only 6 are available throws `400 Bad Request` with exact shortfall.
5. **Ledger Reconciliation**: Reconciliation query confirms sum of ledger equals balances with 100% precision.

---

## Phase 3 — Suppliers, Purchase Orders & Goods Receipt (GRN)

### 1. Goal & Business Value
Enables full supply chain procurement. Automatically generates stock intake and inventory cost layers whenever purchase shipments arrive from manufacturers or distributors.

### 2. Key Capabilities
- **Supplier Directory**: Supplier name, contact details, GSTIN, PAN, payment credit terms (e.g. Net 30, Net 15, COD), bank details, and active status.
- **Purchase Orders (PO)**: Line items, ordered quantities, agreed purchase rates, line discounts, expected delivery dates.
  - Statuses: `DRAFT`, `SUBMITTED`, `PARTIALLY_RECEIVED`, `CLOSED`, `CANCELLED`.
- **Goods Receipt Note (GRN)**:
  - Records the actual shipment received against a PO.
  - Captures supplier invoice number, delivery challan, received date, and recipient staff.
  - Automatically splits received quantities into **Accepted/Sellable** vs **Damaged/Short**.
  - **Single Atomic Transaction**: Posting a GRN simultaneously writes `stock_movements`, updates `stock_balances`, and creates `stock_layers` with actual landed purchase cost.
- **Partial Receipts**: Order 20 sofas; receive 12 today and 8 next week across separate GRNs against the same PO.

### 3. Key Database Tables
- `suppliers` (id, tenant_id, name, contact_person, phone, email, gstin, pan, payment_terms, address)
- `purchase_orders` (id, tenant_id, supplier_id, po_number, status, order_date, expected_date, notes)
- `purchase_order_lines` (id, po_id, variant_id, ordered_qty, unit_cost, line_discount, received_qty)
- `goods_receipt_notes` (id, tenant_id, po_id, grn_number, supplier_invoice_no, received_at, status)
- `goods_receipt_lines` (id, grn_id, po_line_id, variant_id, location_id, condition_id, received_qty, accepted_qty, damaged_qty, unit_cost)

---

## Phase 4 — Customers, Sales Invoicing, Billing & Payments

### 1. Goal & Business Value
The everyday sales engine of the business: fast retail billing, GST-ready invoices, payment collection, and instant inventory deduction.

### 2. Key Capabilities
- **Customer Profiles**: B2C retail walk-in and B2B corporate customers with GSTIN, billing address, phone, and loyalty history.
- **High-Speed Billing (POS / Sales Invoice)**:
  - Fast keyboard-driven item addition (search by product name, SKU, or barcode).
  - Configurable selling prices with MRP strike-through and discount rules (percentage or flat ₹).
  - Margin protection: Warns or blocks staff if a discount drops selling price below purchase cost.
  - Multi-tax calculation: Auto-computes CGST/SGST or IGST based on customer state vs business state.
- **Atomic Stock Deduction**: Posting a finalized invoice immediately decrements sellable stock at the selected store location and logs a `SALE` movement.
- **Payment Collection**: Record payments in full, partial, or split modes (e.g. ₹20,000 Cash + ₹15,000 UPI).
- **Printable A4 / Thermal Invoice**: Clean, branded PDF generated with company logo, GSTIN, invoice number sequence (e.g. `INV-2026-0001`), line items, HSN codes, and bank payment QR/details.

### 3. Key Database Tables
- `customers` (id, tenant_id, name, phone, email, gstin, address, city, state, pincode)
- `invoices` (id, tenant_id, customer_id, location_id, invoice_number, invoice_date, status, subtotal, discount_amount, tax_amount, grand_total, paid_amount)
- `invoice_lines` (id, invoice_id, variant_id, quantity, unit_price, discount_percent, tax_rate, tax_amount, line_total)
- `payments` (id, tenant_id, invoice_id, customer_id, payment_date, amount, payment_method, reference_no, notes)

---

## Phase 5 — Returns, Physical Stock Audits & Operational Controls

### 1. Goal & Business Value
Controls shrinkage, damaged stock, customer returns, and physical godown count discrepancies with rigorous approval workflows.

### 2. Key Capabilities
- **Customer Sales Returns**:
  - Reference original invoice number.
  - Returned units do not automatically become sellable; they enter an `INSPECTION` condition until staff certifies them as Good or Damaged.
  - Generates Credit Note or Refund record.
- **Supplier Returns (Debit Notes)**: Return damaged or defective shipments back to suppliers with corresponding stock deduction and debit note generation.
- **Physical Stock Count Sessions**:
  - Staff conducts periodic cycle counts by location (e.g. Count all items in *Showroom First Floor*).
  - Blind count mode: Staff counts physical stock without seeing expected system numbers to prevent bias.
  - System flags variances (System count: 12, Physical count: 11).
  - Admin approves variance adjustment, writing an audited `STOCK_ADJUSTMENT` movement.

### 3. Key Database Tables
- `sales_returns` & `sales_return_lines`
- `supplier_returns` & `supplier_return_lines`
- `stock_count_sessions` & `stock_count_items`

---

## Phase 6 — Reports, Dashboards, Inventory Ageing & Insights

### 1. Goal & Business Value
Transforms transactional data into actionable insights for business owners and store managers.

### 2. Key Capabilities
- **Interactive Executive Dashboard**:
  - Total inventory valuation (at cost and at selling price).
  - Today's sales revenue, cash/UPI collection breakdown, and profit margin estimate.
  - Low stock warning carousel.
- **Stock Ageing Matrix**:
  - Analyzes inventory duration based on original receipt layers: `0–30 Days`, `31–60 Days`, `61–90 Days`, `91–180 Days`, `180+ Days (Dead Stock)`.
  - Pinpoints slow-moving items taking up warehouse space.
- **Sales & Purchase Registers**:
  - Date-range filtered sales registers with customer, tax slab, and payment status breakdown.
  - Purchase registers for supplier payments and GST input tax credit (ITC) reconciliation.
- **Fast Exports**: 1-click export of any report to CSV/Excel format.

---

## Phase 7 — Advanced Workflows & Retail Configurability

### 1. Goal & Business Value
Power-user capabilities tailored for scaling multi-godown retail and distribution businesses.

### 2. Key Capabilities
- **Quotations & Estimates**: Issue quotations with validity periods; 1-click convert approved quotation to Sales Invoice.
- **Barcode & QR Generation**:
  - Generate and print 50×25mm or custom barcode labels with Product Name, SKU, MRP, and Barcode.
  - USB / Bluetooth barcode scanner integration on the search bar and billing screen.
- **Packaging Unit Conversions**:
  - Support dual units (e.g. Buy screws in *Boxes of 500*, sell in *Pieces* or *Packets of 50*).
- **Serial Number / Warranty Tracking**:
  - Track individual serial numbers for electronics, high-end furniture items, or appliances with warranty start/end dates.
- **Inter-Branch Stock Balancing**: Rebalancing algorithms suggesting transfers from overstocked warehouses to high-velocity showrooms.

---

## Readiness Checklist to Kick Off Phase 2

Before beginning implementation of Phase 2:
- [x] Phase 0 project foundation, Docker, and PostgreSQL running cleanly.
- [x] Phase 1 authentication, multi-tenant database, categories, brands, locations, and catalogue operational.
- [x] Search dropdown with live photo, category, brand, and clean room location working.
- [x] Dynamic compact metric strip taking minimal vertical space.
- [x] Test suite passing with 100% green tests (28/28).
- [ ] **Ready for User Approval**: Proceed with Phase 2 implementation.
