# Generic Inventory, Stock & Billing Management System

## Product Requirements and Phased Development Plan

**Document purpose:** This file is the implementation brief for an AI
coding agent or software development team. Build the application in
small, testable phases. Do not begin a later phase until the current
phase passes its acceptance criteria and the user approves moving
forward.

**Working product name:** StockPilot (placeholder; make the name
configurable)

**Initial target users:** Furniture retailers, hardware shops,
sanitaryware shops, electrical shops, building-material stores, and
other small or medium-sized product businesses.

**Initial deployment assumption:** Responsive web application, usable on
desktop, tablet, and mobile browser. Start with one business and support
multiple stores/godowns within that business. Design the architecture so
multi-company SaaS can be added later without rewriting the core.

------------------------------------------------------------------------

# 1. Product Vision

Build a generic inventory and billing application that helps a retailer
answer these questions quickly:

-   What products do I have?
-   What is the quantity available, reserved, damaged, sold, or in
    transit?
-   Where is each product physically stored: shop, showroom, warehouse,
    godown, rack, shelf, or bin?
-   When was each item received, from whom, at what cost, and how long
    has it been in stock?
-   What are the product's specifications, variants, photographs,
    condition, and identifying codes?
-   What was sold, to whom, on which invoice, at what price, and with
    what discount?
-   Which supplier supplied the product, and what is still due to
    receive or pay?
-   Which items are slow-moving, old, damaged, below reorder level, or
    profitable?
-   Can I search for a product from one landing page and see its stock,
    location, price, and history?

The system must be **generic and configurable**, not hard-coded for
furniture. Furniture-specific attributes such as dimensions, wood type,
finish, upholstery, and color should be configured as attributes.
Electrical shops may use wattage, voltage, phase, and wire gauge;
sanitary shops may use size, finish, and fitting type; hardware shops
may use grade, diameter, and material.

## Tenant and branch scope (important)

- The application is multi-tenant from day one. Each independent retailer/business is a tenant and must have private products, stock, suppliers, customers, invoices, users, settings, and reports.
- Each tenant may have multiple users, controlled by roles and permissions.
- The first release focuses on one operating shop/branch per tenant. The shop may use multiple inventory locations, such as a showroom/store and one or more godowns/warehouses.
- Do not implement branch management screens, branch-level financial settings, inter-branch stock transfers, or consolidated branch reports in the initial release.
- Design core tables so a future `branch_id` or equivalent can be introduced cleanly where needed. Do not treat an inventory location as synonymous with a branch.
- Tenant isolation is mandatory from the first phase. Branch features are deferred; tenant support is not.

## Product principles

1.  **Inventory movements are the source of truth.** Do not let users
    silently overwrite stock balances. Receipts, sales, transfers,
    returns, damage, and corrections must create traceable stock
    movements.
2.  **Product definitions are separate from physical stock.** A
    product/SKU describes what something is; stock records describe how
    many are held at each location and in what condition.
3.  **Support both unique items and quantity-based stock.** A sofa may
    be tracked as individual units or by quantity. Screws may be tracked
    by box, packet, or piece. Serialized products can be added where
    required.
4.  **Configurable attributes, not industry-specific columns.** Use a
    flexible attribute model for uncommon specifications while keeping
    frequently queried business fields relational and typed.
5.  **Practical relational data model.** Use PostgreSQL with a balanced
    model: avoid both excessive normalization and a giant denormalized
    table. Use clear entities, foreign keys, constraints, indexes, and
    JSONB only where flexibility genuinely helps.
6.  **Phased development.** Every phase must have working software,
    automated tests, demo data, and a user acceptance checklist.
7.  **Auditability.** Important actions must record who did what and
    when.
8.  **India-ready, but configurable.** Support INR, Indian number/date
    formats, GST-related invoice fields, and configurable tax rates. Do
    not claim legal or tax compliance without review by a qualified
    professional.
9.  **Simple for shop staff.** Fast search, low-friction data entry,
    clear validation, and keyboard-friendly workflows are priorities.
10. **No premature complexity.** Begin with one business and role-based
    users. Keep future multi-company support in mind, but do not build
    enterprise features before the core is tested.

------------------------------------------------------------------------

# 2. Recommended Technology and Architecture

Use the following defaults unless the existing project has a compelling
reason to differ. Document any deviation before implementation.

-   **Database:** PostgreSQL
-   **Backend:** Choose one mature framework and use it consistently,
    such as Python/FastAPI or Django, or TypeScript/NestJS. Do not mix
    backend stacks without a clear reason.
-   **Frontend:** React with TypeScript, or the existing equivalent if a
    project already exists.
-   **API:** Versioned REST API (`/api/v1`) with documented
    request/response schemas. GraphQL is not required for the first
    release.
-   **Migrations:** Use a migration tool appropriate to the backend; all
    schema changes must be migrations, not manual-only database edits.
-   **Images/files:** Store image files in object storage or a
    filesystem abstraction; store metadata and URLs in PostgreSQL. Do
    not store large image binaries in ordinary product rows.
-   **Authentication:** Secure login, hashed passwords, session/token
    strategy appropriate to the chosen stack, and server-side
    authorization.
-   **Testing:** Unit tests, API/integration tests, database tests, and
    browser-level tests for key workflows.
-   **Deployment:** Environment-based configuration, repeatable local
    setup, database backup instructions, and a staging environment
    before production.
-   **Observability:** Structured logs, useful error messages, and
    health checks.

## Architecture boundaries

Keep these concerns separate:

-   Product catalogue and attributes
-   Locations and stock
-   Stock movement ledger
-   Purchasing and supplier receipts
-   Sales and invoices
-   Customers and suppliers
-   Returns and damage handling
-   Reports and dashboards
-   Authentication, roles, audit logs, settings

Avoid building one giant controller/service or one table that attempts
to represent products, stock, invoices, suppliers, and customers
together.

------------------------------------------------------------------------

# 3. Core Domain Concepts

## 3.1 Product, variant, SKU, and unit

-   **Product:** The general product identity, e.g. "Three-seater sofa".
-   **Variant/SKU:** A sellable variation, e.g. "Grey fabric, 210 cm,
    walnut legs". Each stock-managed variant has a unique SKU within the
    business.
-   **Attribute:** A configurable property such as color, dimensions,
    thickness, material, brand, model, finish, wattage, or print/design.
-   **Unit of measure (UOM):** Piece, box, packet, meter, square foot,
    kilogram, litre, set, etc.
-   **Barcode:** Optional barcode/QR identifier for quick scanning.
-   **Serial number:** Optional unique identifier for individually
    tracked products.
-   **Batch/lot:** Optional identifier for products where a batch
    matters.

Do not require every product to have variants. A simple product may have
one SKU. Avoid making every attribute a variant dimension automatically;
the user should choose which attributes define distinct stock items.

## 3.2 Stock and location

A location hierarchy should support examples such as:

-   Business
    -   Store / Showroom
        -   Floor
            -   Rack
                -   Shelf / Bin
    -   Godown / Warehouse
        -   Section
            -   Rack
                -   Bin

Use a location type (e.g. store, showroom, warehouse, godown, rack,
shelf, bin, other), parent location, active status, and optional
address/contact details. Permit simple flat locations as well as nested
locations.

Track stock by at least:

-   SKU
-   Location
-   Stock condition/status
-   Quantity on hand
-   Quantity reserved, if reservations are enabled
-   Quantity available
-   Unit of measure

For phase 1, implement a clear basic stock model. Add lot/serial-level
tracking only when the relevant phase is approved.

## 3.3 Stock condition and age

Suggested condition/status values:

-   New / sellable
-   Good / sellable
-   Open-box / display
-   Damaged / not sellable
-   Under inspection
-   Returned / pending inspection
-   Written off

These values should be configurable. Do not treat condition as a
free-text field.

Record receipt date and, where relevant, manufacturing date, warranty
start/end, and expiry date. Calculate stock age from the receipt date of
the remaining stock, not from the product creation date. For accurate
ageing when multiple receipts exist, stock must retain receipt-layer or
batch-level history. If FIFO valuation is later implemented, it should
use the same receipt layers.

## 3.4 Inventory events

Stock changes must be explained by events such as:

-   Opening balance
-   Supplier receipt
-   Sale
-   Customer return
-   Supplier return
-   Transfer out / transfer in
-   Damage or condition change
-   Stock adjustment
-   Write-off
-   Purchase receipt reversal or sales return reversal

Each event should include reference number, timestamp, user,
source/destination location where relevant, reason, and line-level SKU
and quantity. Posted transactions should not be silently deleted or
edited; use reversal/correction entries and audit history.

------------------------------------------------------------------------

# 4. Functional Scope

## 4.1 Landing page and global product search

The landing page is the main work surface, not just a marketing page.

A prominent search should support:

-   Product name and description
-   SKU / item code
-   Barcode
-   Brand and model
-   Category
-   Attribute values such as color, size, dimensions, thickness,
    wattage, finish
-   Supplier item code, if available

Search results should show:

-   Product image thumbnail
-   Product name and SKU
-   Brand/model and key specifications
-   Available quantity and total on-hand quantity
-   Store/godown location summary
-   Condition summary
-   Selling price and any active offer
-   Low-stock or aged-stock indicator where applicable

Opening a result should show a product detail page with tabs/sections
for Overview, Stock by Location, Specifications, Images, Purchase
History, Sales History, Stock Movements, and Audit History, according to
the user's permissions.

Search must be paginated and indexed. Do not load the entire catalogue
into the browser. Provide empty states, loading states, clear errors,
and useful filters.

## 4.2 Product catalogue

-   Create, view, edit, archive, and search products.
-   Product name, SKU, category, brand, model, description, base unit,
    barcode, tax classification/code where applicable, active status,
    and images.
-   Variants with SKU, variant attributes, barcode, unit, and status.
-   Configurable categories and subcategories.
-   Configurable attributes with data types: text, number, decimal,
    boolean, date, single choice, multiple choice, and measurement where
    appropriate.
-   Attribute definitions should specify which category they apply to,
    whether required, and whether searchable/filterable.
-   Support multiple images per product/variant, captions, primary
    image, and upload validation.
-   Import products from CSV/XLSX using a preview and validation report;
    export the catalogue.
-   Duplicate SKU prevention within the business.
-   Archive rather than hard-delete products that have transaction
    history.

## 4.3 Inventory and locations

-   View on-hand, reserved, available, damaged, and sellable quantities.
-   View stock by store, godown, rack, shelf, and bin.
-   Receive stock from a supplier.
-   Transfer stock between locations using transfer-out and transfer-in
    states; do not make in-transit stock disappear.
-   Record physical stock counts and reconcile differences through
    approved adjustments.
-   Track stock age and ageing bands, e.g. 0--30, 31--60, 61--90,
    91--180, and over 180 days; make bands configurable.
-   Configure reorder point and preferred reorder quantity by SKU and
    optionally by location.
-   Optional stock reservation for quotations/orders.
-   Prevent negative stock by default. If a business setting allows it,
    require permission and log the exception.
-   Distinguish physical quantity, sellable quantity, damaged quantity,
    and available quantity in the UI.

## 4.4 Purchasing and supplier receipts

-   Supplier/vendor directory with business name, contact person, phone,
    email, address, GSTIN where applicable, payment terms, notes, active
    status, and supplied SKUs.
-   Purchase order (PO) with supplier, expected date, line items,
    quantities, rates, discounts, taxes, freight/other charges, and
    notes.
-   PO statuses: Draft, Submitted/Approved, Partially Received,
    Received/Closed, Cancelled.
-   Goods receipt note (GRN) records what actually arrived, when, where,
    condition, quantity accepted/rejected, supplier invoice/challan
    number, and attachments.
-   Support partial receipts and multiple receipts against one PO.
-   Receiving stock must create stock movement records and update stock
    balances within one database transaction.
-   Record purchase rate, additional landed costs where supported, and
    supplier invoice details.
-   Record damaged/short supply at receipt and allow inspection
    outcomes.
-   Supplier return/debit note workflow can be added in a later phase.
-   Provide supplier purchase history and outstanding PO view.

## 4.5 Sales, quotations, orders, and invoices

-   Customer directory with customer type (individual/business), name,
    phone, email, billing address, shipping address, GSTIN where
    applicable, and notes.
-   Fast customer selection and the ability to create a customer during
    billing.
-   Sales invoice with invoice number, date, customer, items, quantity,
    unit price, line discount, invoice discount, tax, freight/charges,
    rounding, grand total, payment status, and notes.
-   Invoice numbering must be configurable by business and financial
    year; prevent duplicates.
-   Support draft and posted invoices. Posting an invoice must validate
    stock and create sales stock movements atomically.
-   Invoice PDF/print layout with business details, customer details,
    item descriptions, SKU, quantity, unit, rate, discount, tax, totals,
    and payment instructions.
-   Support print-friendly A4 output first; thermal receipt output may
    be added later.
-   Payment recording: cash, UPI, card, bank transfer, cheque,
    credit/other; allow split payments and partial payments.
-   Payment status: Unpaid, Partially Paid, Paid, Refunded, Overdue
    where applicable.
-   Discounts: fixed amount and percentage, line-level and
    invoice-level, subject to permission and configured limits.
-   Selling price, list/MRP price if applicable, cost price, active
    offer price, offer start/end date, and price history.
-   Price overrides must capture the user and reason. Show margin
    warnings to authorized users where selling below cost.
-   Quotation-to-invoice conversion and sales order/reservation can be
    added in later phases.
-   Customer returns, credit notes, refunds, and invoice cancellation
    must use auditable reversal workflows.

**Important:** Invoice tax calculations, GST fields, invoice numbering,
credit notes, and statutory formatting must be validated for the
intended jurisdiction and business type before production use. The
application should not claim to file GST returns unless that feature is
separately designed and tested.

## 4.6 Pricing, discounts, and offers

-   Maintain purchase cost and selling price separately.
-   Support optional MRP/list price.
-   Support default price and customer-specific price only if needed.
-   Configure time-bound offers with start/end dates, eligible
    SKUs/categories, discount type, and active status.
-   Define discount permissions and maximum discount thresholds.
-   Keep price history with effective date and user.
-   Never overwrite historical invoice line prices when the current
    product price changes.
-   Define whether displayed cost is last purchase cost, weighted
    average cost, or another valuation basis. For the initial release,
    label the chosen method clearly and do not imply accounting-grade
    inventory valuation unless implemented.

## 4.7 Reporting and dashboard

Initial reports:

-   Stock summary by SKU and location
-   Stock movement ledger
-   Stock ageing
-   Slow-moving / no-movement stock
-   Low-stock / reorder report
-   Damaged and non-sellable stock
-   Purchase register and supplier receipt history
-   Sales register and invoice list
-   Sales by date, product, category, and customer
-   Gross margin estimate, with the cost basis clearly stated
-   Customer outstanding balances
-   Supplier pending receipts and purchase order status
-   Stock adjustment report
-   Export to CSV/XLSX where practical

Every report should support date filters when relevant,
location/category/SKU filters, pagination, and export permissions.
Totals must reconcile to the underlying transactions.

## 4.8 Users, permissions, and audit

Roles to start with:

-   Owner/Admin: full configuration and access
-   Manager: operational management and approvals
-   Inventory staff: products, receipts, transfers, counts, and stock
    views
-   Sales/Billing staff: customers, quotations, invoices, and payments
-   Read-only/Auditor: view permitted data and reports

Use server-side permission checks, not just hidden UI buttons. Record
audit events for sign-in/security events as appropriate, product edits,
price changes, receipts, invoices, stock adjustments, user/role changes,
and configuration changes. Store actor, timestamp, action, entity
type/id, and useful before/after values while avoiding unnecessary
sensitive data.

## 4.9 Settings and usability

-   Business profile, logo, address, contact information, currency,
    timezone, date/number formats, financial year, tax settings, invoice
    prefix/sequence, and default payment terms.
-   Configurable units, categories, brands, attributes, conditions,
    location types, payment methods, and ageing bands.
-   Responsive layout, keyboard navigation, accessible labels,
    confirmation for destructive/irreversible actions, clear validation,
    and useful empty states.
-   Search and list pages should remember filters when practical.
-   Avoid unnecessary modals for multi-line transactions; provide usable
    forms and line-item grids.
-   Use soft deletion/archive for master records referenced by
    transactions.
-   Add CSV/XLSX import templates and row-level error reports.

------------------------------------------------------------------------

# 5. PostgreSQL Data Model Guidance

## 5.1 Modelling approach

Use a **balanced relational model**:

-   Normalize entities that have their own lifecycle or are referenced
    by many records: products, SKUs, locations, suppliers, customers,
    invoices, invoice lines, receipts, receipt lines, users, and stock
    movements.
-   Keep common fields such as SKU, product name, category, unit, active
    status, and default selling price in ordinary typed columns for
    reliable filtering and indexing.
-   Use an attribute-definition and attribute-value model for
    industry-specific specifications.
-   Use JSONB for sparse metadata, import payloads, or versioned
    snapshots only when there is a concrete need. Do not place the
    entire product, customer, invoice, or stock model in JSONB.
-   Snapshot names, SKU, descriptions, prices, tax rates, and other
    important details onto transaction lines where historical documents
    must remain unchanged if the master record changes.
-   Add foreign keys, unique constraints, check constraints, and indexes
    deliberately.
-   Use numeric/decimal types for money and quantities where fractional
    units are allowed. Do not use floating-point types for money.
-   Use UTC timestamps in storage and display them in the configured
    business timezone.
-   Use migrations and seed data. Document each schema change.

## 5.2 Suggested initial entities/tables

The exact schema may evolve during development. The agent should
document the final ERD and explain important trade-offs.

### Business and access

-   `businesses` --- business name, contact details, timezone, currency,
    settings
-   `users` --- login identity, password hash/provider, active status
-   `business_users` --- user membership in a business and role
    (supports future multi-company use)
-   `roles` and `permissions` or a clear equivalent
-   `audit_logs` --- actor, action, entity type/id, timestamp,
    before/after metadata

### Catalogue

-   `categories` --- parent category, name, code, active status
-   `brands` --- name and optional details
-   `units_of_measure` --- code, label, decimal precision, conversion
    rules if needed
-   `products` --- general product identity and default catalogue fields
-   `product_variants` or `skus` --- SKU, product, variant label,
    barcode, unit, status, default prices, reorder defaults
-   `attribute_definitions` --- name, code, data type, applicable
    category, required/searchable flags, allowed options
-   `attribute_options` --- options for single/multiple-choice
    attributes
-   `product_attribute_values` --- attribute values linked to product or
    SKU, with typed value columns or a carefully designed value
    representation
-   `product_images` --- product/SKU, file URL/key, caption, primary
    flag, sort order
-   `price_history` --- SKU, price type, amount, effective date, changed
    by
-   `offers` and `offer_items` --- time-bound promotions and eligible
    items/categories

### Locations and stock

-   `locations` --- business, parent location, type, code, name,
    address/details, active status
-   `stock_balances` --- current balance by SKU/location/condition (a
    projection/cache, not the only source of truth)
-   `stock_movements` --- immutable ledger of quantity changes and
    movement type, source/destination, condition, reference, actor,
    timestamp
-   `stock_lots` or `inventory_layers` --- receipt-linked layers for
    ageing and later valuation, introduced when phase scope requires
    them
-   `stock_reservations` --- optional reserved quantity against
    order/quotation
-   `stock_counts` and `stock_count_lines` --- physical count sessions
    and variance records

### Purchasing

-   `suppliers`
-   `purchase_orders`
-   `purchase_order_lines`
-   `goods_receipts`
-   `goods_receipt_lines`
-   `supplier_returns` and lines (later phase)

### Sales and payments

-   `customers`
-   `quotations` and `quotation_lines` (later phase)
-   `sales_orders` and lines (later phase)
-   `sales_invoices`
-   `sales_invoice_lines`
-   `payments`
-   `payment_allocations` --- payment allocated to one or more invoices
-   `sales_returns` and lines (later phase)
-   `credit_notes` (later phase, if needed for the approved
    tax/accounting workflow)

### Platform operations

-   `number_sequences` --- invoice/PO/GRN sequences by business and
    financial year
-   `attachments` --- metadata for documents attached to transactions
-   `import_jobs` and `import_errors` --- useful if imports become
    substantial

## 5.3 Important data integrity rules

1.  A SKU must be unique within its business. Barcode uniqueness should
    be configurable, since some businesses may reuse supplier barcodes.
2.  A posted transaction must not be silently deleted.
3.  Stock balance changes and the matching stock movement must commit or
    roll back together.
4.  Invoice lines must preserve the product/SKU description, SKU code,
    unit, unit price, discount, tax rate, and tax amount used at the
    time of sale.
5.  A transfer must not create or destroy stock: it moves stock from one
    location to another, with in-transit state if the transfer is not
    yet received.
6.  All quantities must be non-negative at line level unless the
    workflow explicitly supports a return or reversal.
7.  Money fields use `NUMERIC`/decimal precision and explicit rounding
    rules.
8.  Use database constraints for critical invariants in addition to
    application validation.
9.  Stock balances should be rebuildable/reconcilable from the movement
    ledger.
10. All queries and mutations must be scoped to the user's authorized
    business and locations.

## 5.4 Indexing and performance

At minimum, consider indexes for:

-   SKU code and barcode
-   Product name and searchable descriptions
-   Category, brand, active status
-   Location parent/type/code
-   Stock balance by SKU and location
-   Stock movements by SKU, location, timestamp, and reference
-   Invoice number, invoice date, customer, payment status
-   Supplier name and customer name/phone

Use PostgreSQL full-text search or trigram indexes if measured search
needs justify them. Do not add every possible index without considering
write cost. Check query plans for slow list/search/report queries.

------------------------------------------------------------------------

# 6. Phased Development Plan and Acceptance Gates

**Non-negotiable delivery rule:** Implement only the phase currently
approved. At the end of each phase, stop, present the working software,
tests, screenshots or a short demo, known limitations, and acceptance
checklist. Wait for explicit approval before starting the next phase.

## Phase 0 --- Discovery, architecture, and project foundation

### Build

-   Confirm assumptions and list unresolved questions.
-   Set up repository, code formatting, linting, environment
    configuration, and README.
-   Set up frontend and backend skeleton.
-   Configure PostgreSQL and migration tooling.
-   Add health-check endpoint and basic error handling.
-   Add a repeatable local development setup, preferably Docker Compose.
-   Create initial ERD and API conventions.
-   Add automated test setup and CI checks if available.

### Acceptance tests

-   A developer can start the application from a clean checkout using
    documented commands.
-   Backend health check works.
-   Application connects to PostgreSQL.
-   Migrations can be applied to an empty database.
-   Tests and linting run successfully.
-   Secrets are not committed to source control.
-   The ERD and key design decisions are documented.

### Do not build yet

No full inventory workflows, invoicing, complex roles, analytics, or
advanced valuation.

**Approval gate:** User approves architecture, database direction, and
local setup.

## Phase 1 --- Login, business setup, locations, and basic product catalogue

### Build

-   Login/logout and secure password handling.
-   Single-business setup with business profile.
-   Basic roles: Admin and Staff, with server-side authorization.
-   Create/edit/archive categories, brands, units, and locations.
-   Create/edit/archive products and SKUs.
-   Product attributes with typed fields and category-specific
    definitions.
-   Product image upload and primary image.
-   Product list, detail page, filters, and global landing-page search.
-   CSV import for products with preview, validation, and row-level
    errors.
-   Seed/demo data representing furniture, hardware, electrical, and
    sanitary products.

### Acceptance tests

-   Admin can create a category, unit, location, product, SKU, and
    attributes.
-   Furniture and electrical products can use different attributes
    without schema changes.
-   Duplicate SKU is rejected within the business.
-   Product images upload and display correctly.
-   Search works by name, SKU, barcode, category, brand, and configured
    searchable attributes.
-   Archived products do not appear in default active search but remain
    visible in historical records.
-   Staff cannot access Admin-only settings.
-   CSV import validates bad rows and does not partially corrupt valid
    catalogue data.
-   Responsive layout works on desktop and mobile browser.

### Demo scenario

Create a sofa with dimensions, fabric, color, and finish; create a drill
with voltage, wattage, and model; search for each from the landing page.

**Approval gate:** User can maintain and search the product catalogue
without inventory transactions.

## Phase 2 --- Opening stock, stock balances, locations, movements, and ageing

### Build

-   Opening-stock entry with quantity, location, condition,
    receipt/opening date, and reference.
-   Stock balances by SKU/location/condition.
-   Stock movement ledger and stock history view.
-   Stock transfer between locations, including dispatch and receipt.
-   Condition changes (e.g. good to damaged) with reason and audit
    trail.
-   Stock adjustment workflow with permissions and reason.
-   Stock ageing view based on receipt layers or an explicitly
    documented initial ageing method.
-   Inventory summary page and low-stock/reorder thresholds.
-   Reconciliation tool to compare movement ledger with stock balances.

### Acceptance tests

-   Opening stock creates auditable movements and a matching balance.
-   Transfer decreases source and increases destination only when the
    relevant steps are completed; in-transit stock is visible.
-   Condition change moves quantity between conditions without changing
    total physical quantity.
-   Adjustment requires a reason and authorized user.
-   Negative stock is blocked by default.
-   Stock totals reconcile across SKU, location, and condition.
-   Ageing is based on receipt date for remaining units, not product
    creation date.
-   A user can identify exactly where stock is stored.
-   Concurrent stock changes cannot oversell or create an inconsistent
    balance.

### Demo scenario

Receive 10 chairs into Godown A, transfer 4 to Showroom B, mark 1 chair
damaged, then verify the balances and movement history.

**Approval gate:** Stock count, location, condition, and movement
history are trusted.

## Phase 3 --- Suppliers, purchase orders, goods receipt, and incoming cost

### Build

-   Supplier CRUD and search.
-   Purchase orders and line items.
-   PO approval/status workflow.
-   Goods receipt note (GRN) with actual received quantities, date,
    location, condition, supplier invoice/challan reference, and
    attachments.
-   Partial receipt support.
-   Purchase cost, line discounts, taxes, and additional charges as
    configured.
-   Link GRNs to stock movements and receipt layers for ageing.
-   Supplier purchase history and open/partially received PO list.

### Acceptance tests

-   A PO does not increase stock by itself.
-   Posting a GRN increases stock exactly once.
-   Partial receipts are supported and remaining quantities are correct.
-   Repeated submission does not duplicate stock movements.
-   Received, rejected, short, and damaged quantities are
    distinguishable.
-   Purchase cost and supplier reference remain available in history.
-   GRN, stock movement, and balance updates commit atomically.
-   A posted receipt is corrected through a controlled
    reversal/correction, not silent deletion.

### Demo scenario

Create a PO for 20 light fixtures, receive 15, mark 1 received unit
damaged, and verify sellable stock, damaged stock, and remaining PO
quantity.

**Approval gate:** Supplier receipts correctly update stock and preserve
incoming cost/history.

## Phase 4 --- Customers, sales invoices, pricing, discounts, and payments

### Build

-   Customer CRUD and quick customer creation during billing.
-   Invoice draft and posting.
-   Invoice line items, quantity, unit, rate, discounts, taxes, charges,
    rounding, and totals.
-   Configurable invoice number sequence and financial-year handling.
-   Stock validation and stock movement creation on invoice posting.
-   Payment recording and partial/split payment allocations.
-   Print-friendly A4 invoice/PDF.
-   Price lists/default selling price, MRP/list price, time-bound
    offers, and price history.
-   Permission-controlled discount/price override and reason capture.
-   Invoice list, filters, detail page, and payment status.

### Acceptance tests

-   Draft invoice does not reduce stock.
-   Posting a valid invoice reduces stock exactly once.
-   Invoice cannot sell more than available sellable stock unless an
    explicitly approved business setting permits it.
-   Invoice totals reconcile at line and document level.
-   Discounts and taxes follow documented rounding rules.
-   Historical invoice values remain unchanged when product price or
    description changes.
-   Partial payments and split payments update the outstanding amount
    correctly.
-   Invoice numbers are unique under concurrent use.
-   PDF/print output is legible and includes required configured
    business/customer/item/total fields.
-   Staff cannot exceed their permitted discount limit.
-   A failed invoice post leaves neither a partial invoice posting nor
    partial stock changes.

### Demo scenario

Create a customer, sell two products with a discount, post an invoice,
record a partial UPI payment, print the invoice, and verify stock and
customer outstanding.

**Approval gate:** Everyday billing and payment workflows work reliably.

## Phase 5 --- Returns, stock counts, adjustments, and operational controls

### Build

-   Customer sales returns with reason and inspection condition.
-   Refund, exchange, or credit workflow as approved.
-   Supplier returns with stock movement and supplier reference.
-   Stock count sessions by location/category.
-   Variance approval and adjustment.
-   Invoice cancellation and reversal policy.
-   More detailed permissions and approvals for sensitive operations.
-   Audit history screens for invoices, receipts, price changes, and
    adjustments.

### Acceptance tests

-   Returned items do not automatically become sellable until
    condition/inspection is assigned.
-   Refunds and credit entries reference the original sale.
-   Supplier returns reduce the appropriate stock and reference the
    receipt/supplier.
-   Stock-count variance is visible and requires approval if configured.
-   Reversals are linked to the original transaction and do not erase
    history.
-   Every sensitive action has actor, timestamp, reason, and reference.
-   Re-running a posted action does not duplicate its effect.

**Approval gate:** Common exception cases are traceable and
controllable.

## Phase 6 --- Reports, dashboards, imports/exports, and business insights

### Build

-   Stock summary by SKU/location/condition.
-   Stock ageing and slow-moving inventory.
-   Low-stock/reorder report.
-   Stock movement ledger.
-   Purchase and sales registers.
-   Sales by date/product/category/customer.
-   Customer outstanding and supplier pending receipt reports.
-   Damaged/written-off stock report.
-   Estimated gross margin report with clear cost basis.
-   CSV/XLSX exports and improved import validation.
-   Dashboard with configurable key metrics.

### Acceptance tests

-   Report totals reconcile with posted transactions.
-   Date filters use the configured business timezone and documented
    inclusive/exclusive boundaries.
-   Exports match the filtered on-screen result.
-   Unauthorized users cannot export restricted data.
-   Slow reports are measured and optimized with appropriate
    indexes/query plans.
-   Ageing and slow-moving logic are documented and tested.

**Approval gate:** Owner/manager can use the system to make stock and
sales decisions.

## Phase 7 --- Advanced workflows and industry configurability

Select features based on feedback from real users; do not build all
optional features automatically.

Possible additions: - Quotations and conversion to invoice - Sales
orders and stock reservation - Purchase suggestions based on reorder
level and sales velocity - Multi-store and inter-branch workflows -
Serialized item tracking and warranty details - Batch/lot tracking and
expiry dates - Units and packaging conversions, e.g. box to piece or
roll to meter - Barcode label generation and scanner support - Bulk
price updates - Customer-specific pricing - Supplier/customer
statements - WhatsApp/email invoice sharing - Multi-currency for
specific use cases - Offline-tolerant workflows only if required and
designed carefully - Accounting software integration - GST
reporting/integration only after requirements and compliance review -
Mobile/PWA enhancements - Multi-company SaaS tenancy and subscription
billing

### Acceptance tests

Define a feature-specific acceptance checklist before starting each
selected feature. Existing phases' tests must continue to pass.

**Approval gate:** Each advanced feature is separately scoped and
approved.

## Phase 8 --- Production hardening and launch

### Build

-   Production deployment and staging environment.
-   Database backup and restore runbook.
-   Monitoring, structured logs, health checks, and alerting.
-   Rate limiting and security headers as appropriate.
-   File upload validation and access control.
-   Data export and retention policy.
-   Performance test with realistic catalogue/transaction volume.
-   User onboarding and admin documentation.
-   Migration/rollback plan.
-   UAT with representative furniture, hardware, electrical, and
    sanitary workflows.

### Acceptance tests

-   A backup can be restored into a clean environment and validated.
-   Authorization and business-data isolation tests pass.
-   Critical workflows pass end-to-end in staging.
-   No known critical/high severity defects remain open without explicit
    acceptance.
-   Deployment and rollback steps are documented.
-   The owner has approved the production launch.

------------------------------------------------------------------------

# 7. Cross-Phase Engineering Requirements

These apply in every phase:

-   Add automated tests with each feature; do not defer all testing to
    the end.
-   Use migrations for every database change.
-   Do not use hard-coded sample data in production logic.
-   Use server-side validation and authorization.
-   Use database transactions for multi-step writes.
-   Make posting actions idempotent or guard against duplicate
    submission.
-   Keep stock movements and financial transactions auditable.
-   Use decimal-safe money calculations.
-   Provide loading, empty, success, and error states.
-   Avoid silently swallowing exceptions.
-   Never log passwords, authentication tokens, or unnecessary sensitive
    customer data.
-   Add demo/seed data that can be reset in development only.
-   Update README, API docs, ERD, and test instructions.
-   Maintain a known-limitations list.
-   Do not mark a phase complete merely because the UI exists;
    demonstrate working persistence and tests.
-   Do not remove or weaken existing tests to make a phase pass.

------------------------------------------------------------------------

# 8. Non-Functional Requirements

## Security and privacy

-   Hash passwords using a proven password-hashing algorithm/library.
-   Enforce permissions on the server for every protected operation.
-   Validate uploaded file types, size, and access rights.
-   Protect against SQL injection, XSS, CSRF, and common web
    vulnerabilities using framework best practices.
-   Use HTTPS in production.
-   Keep secrets in environment/secret management, not source control.
-   Restrict customer/supplier data to authorized users.
-   Maintain audit trails without logging secrets.

## Reliability

-   Use transactions for invoice posting, goods receipt posting, stock
    transfers, and payment allocation.
-   Prevent duplicate posting on retries.
-   Provide understandable validation messages.
-   Ensure backups and restoration are documented and tested before
    production.

## Performance

-   Design search and list APIs with pagination.
-   Avoid N+1 queries.
-   Add indexes based on expected filters and observed query plans.
-   Establish a performance target after estimating catalogue size and
    concurrent users. Initial target suggestion: common search/list
    operations should feel responsive with 50,000 SKUs and ordinary
    shop-level concurrency, but verify with a load test rather than
    treating this as guaranteed.

## Accessibility and usability

-   Use clear labels and keyboard-friendly forms.
-   Make primary actions obvious.
-   Use consistent terminology for on-hand, available, reserved,
    damaged, and in-transit stock.
-   Avoid relying only on color to communicate condition or alerts.
-   Confirm irreversible actions and show their consequences.

------------------------------------------------------------------------

# 9. Initial User Interface Map

1.  **Login**
2.  **Home / Global Search**
    -   Search box
    -   Recently viewed products
    -   Low-stock alerts
    -   Recent transactions (permission-based)
3.  **Product Catalogue**
    -   Products/SKUs
    -   Categories and brands
    -   Attributes
    -   Import/export
4.  **Product Detail**
    -   Overview and images
    -   Specifications
    -   Stock by location/condition
    -   Purchase history
    -   Sales history
    -   Movement history
5.  **Inventory**
    -   Stock summary
    -   Locations
    -   Transfers
    -   Adjustments
    -   Stock counts
    -   Ageing
6.  **Purchasing**
    -   Suppliers
    -   Purchase orders
    -   Goods receipts
7.  **Sales**
    -   Customers
    -   Quotations/orders (when implemented)
    -   New invoice
    -   Invoice register
    -   Payments
    -   Returns (when implemented)
8.  **Reports**
9.  **Settings**
    -   Business
    -   Users and roles
    -   Units, categories, attributes, conditions
    -   Invoice numbering and tax configuration

Use a left navigation/sidebar on desktop and a suitable compact
navigation pattern on mobile. Keep global product search easily
accessible.

------------------------------------------------------------------------

# 10. Example Scenarios for Cross-Industry Testing

The agent must maintain test data for at least these scenarios:

### Furniture

-   Product: Three-seater sofa
-   Attributes: width, depth, height, frame material, upholstery, color,
    finish
-   Locations: showroom and godown
-   Conditions: new, display, damaged
-   Workflow: receive stock, move one item to showroom, sell one,
    inspect remaining stock age

### Electrical

-   Product: LED panel light
-   Attributes: wattage, voltage, color temperature, shape, brand,
    model, warranty
-   Unit: piece or box
-   Workflow: receive multiple boxes, sell pieces if conversion is
    configured, return a damaged unit

### Hardware

-   Product: Stainless-steel screw
-   Attributes: diameter, length, grade, finish
-   Units: box and piece where conversion is configured
-   Workflow: receive stock, adjust a physical count, report remaining
    stock

### Sanitaryware

-   Product: Wash basin
-   Attributes: width, material, color, mounting type, tap-hole
    configuration
-   Workflow: receive a broken unit, classify it as damaged, ensure it
    is excluded from sellable stock

The system should support these differences through configuration, not
by creating a new code path for every industry.

------------------------------------------------------------------------

# 11. Definition of Done for Every Phase

A phase is complete only when all applicable items below are true:

-   [ ] Requirements for the phase are implemented.
-   [ ] Database migrations are included and tested.
-   [ ] Automated unit and integration tests pass.
-   [ ] Key end-to-end workflows are demonstrated.
-   [ ] Validation, empty, loading, and error states are handled.
-   [ ] Permissions and audit requirements are tested.
-   [ ] Documentation and setup instructions are updated.
-   [ ] Demo data and test instructions are provided.
-   [ ] Known limitations and deferred items are listed.
-   [ ] The user has reviewed and explicitly approved the phase.

------------------------------------------------------------------------

# 12. Instructions to the Coding Agent

Follow these instructions strictly:

1.  First inspect the existing repository and report what is already
    present. Do not overwrite a working project blindly.
2.  Read this entire requirements document before coding.
3.  Start with **Phase 0 only**. Do not implement all phases in one
    pass.
4.  Before coding Phase 0, present a concise plan, proposed stack (if
    not already chosen), architecture, initial ERD, and any blocking
    questions. Ask only questions that materially affect the
    architecture or first phase; otherwise state sensible assumptions.
5.  Implement Phase 0, run its tests, and provide exact setup/test
    commands and a summary of changed files.
6.  Stop at the phase gate and wait for the user's approval before
    proceeding.
7.  At the beginning of each subsequent phase, state the scope and
    acceptance tests for approval.
8.  Do not silently change the data model, transaction semantics, or
    business rules. Explain proposed changes first.
9.  Keep implementation generic. Industry-specific product
    specifications must be configurable.
10. Prefer the smallest maintainable implementation that satisfies the
    current phase over speculative abstraction.
13. For every database table, document its purpose and key
    relationships. For every important stock/financial workflow, explain
    how transactions, reversals, and duplicate submissions are handled.
14. At the end of every phase, provide:
    -   Features completed
    -   Database/schema changes
    -   API/UI changes
    -   Tests run and results
    -   How to test manually
    -   Screenshots or a short demo where possible
    -   Known limitations
    -   Proposed scope for the next phase
15. Do not start the next phase until the user explicitly approves.
16. Never report a test as passed unless it was actually run.
17. Keep a `CHANGELOG.md` or equivalent phase log and update the README
    and ERD as the project evolves.

------------------------------------------------------------------------

# 13. Initial Assumptions and Questions to Resolve

Use these defaults for the first implementation unless the user says
otherwise:

-   Web application, responsive on desktop and mobile browser.
-   PostgreSQL as the primary database.
-   One business initially, with multiple stores/godowns.
-   INR and India-oriented invoice fields, configurable rather than
    hard-coded.
-   Single currency in the first release.
-   Basic username/email and password authentication.
-   Admin and Staff roles initially; more granular roles later.
-   Product/SKU-level quantities initially; serial/IMEI-level tracking
    is optional later.
-   A4 invoice PDF/print is the first output format.
-   No accounting integration, GST filing, offline mode, or subscription
    billing in the initial phases.
-   Stock cannot go negative by default.
-   Stock ledger and posted financial documents are not silently
    editable/deletable.

Questions that can be answered before Phase 1 if needed:

1.  Is this for one retailer's business first, or should multiple
    independent businesses log in from day one?
2.  Do you need barcode scanning and barcode label printing in the first
    release?
3.  Should stock be tracked as individual serialized items, quantities,
    or both?
4.  Do you need GST invoice compliance from the first release, or should
    the first invoice be a configurable basic sales invoice pending
    accountant review?
5.  Is there an existing code repository or preferred frontend/backend
    framework?

Do not block Phase 0 on questions that can safely remain configurable.
Record assumptions and move forward only after the architecture approval
gate.

------------------------------------------------------------------------

# 14. Suggested First Milestone

The first useful milestone is **Phase 1: Product Catalogue + Global
Search** after the project foundation is accepted. This creates an
immediately testable application: users can configure categories and
product attributes, add product images, import products, and search
across furniture, hardware, electrical, and sanitary products.
Inventory, purchasing, and billing should then be layered onto the
catalogue in later approved phases.

**End of specification.**
