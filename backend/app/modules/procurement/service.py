import uuid
import re
import io
import urllib.parse
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy import select, func, and_, or_, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.procurement.models import CompanyStockBatch, CompanyStockItem
from app.modules.procurement.schemas import (
    CompanyStockItemResponse,
    CompanyStockSummaryResponse,
    CompanyStockUploadResult,
    WhatsAppOrderPreviewRequest,
    WhatsAppOrderPreviewResponse,
)
from app.modules.catalogue.models import (
    Product,
    ProductVariant,
    ProductAttributeValue,
)
from app.modules.settings.models import (
    Category,
    Brand,
    TaxRate,
    UnitOfMeasure,
    AttributeDefinition,
)
from app.modules.stock.models import StockBalance
from app.common.pagination import PaginationMeta, paginate


def clean_desc(desc: Optional[str]) -> str:
    if not desc:
        return ""
    # Strip trailing triangle ▸ and extra hyphens/spaces
    cleaned = desc.replace("\u25b8", "").strip()
    cleaned = re.sub(r"\s*-\s*-\s*$", "", cleaned)
    return cleaned.strip()


def clean_color(color: Optional[str]) -> Optional[str]:
    if not color:
        return None
    val = str(color).strip()
    if val in ("-", "--", "---", "- - -", "- -", "None", "—"):
        return None
    val = re.sub(r"[\s\-]+$", "", val)
    return val if val else None


def clean_size(size: Optional[str]) -> Optional[str]:
    if not size:
        return None
    val = str(size).strip()
    if val in ("—", "-", "--", "None"):
        return None
    return val


def categorize_item(name: str, desc: str, raw_cat: str) -> Tuple[str, str, str]:
    """
    Returns (Main Category Name, Subcategory Name, SKU Category Code)
    """
    text_content = f"{name} {desc}".lower()
    raw = (raw_cat or "").lower()

    if "bed" in raw or "bed" in text_content:
        if "bedside" in text_content:
            return ("Bedroom Furniture", "Bedside Tables", "TBL")
        elif "king" in text_content:
            return ("Bedroom Furniture", "King Size Beds", "BED")
        elif "queen" in text_content:
            return ("Bedroom Furniture", "Queen Size Beds", "BED")
        elif "sofa cum bed" in text_content or "cum bed" in text_content:
            return ("Sofas & Seating", "Sofa Cum Beds", "SFA")
        else:
            return ("Bedroom Furniture", "Queen Size Beds", "BED")

    elif "wardrobe" in raw or "almirah" in text_content or "wardrobe" in text_content:
        if "2 door" in text_content or "2 d" in text_content or "2dw" in text_content:
            return ("Bedroom Furniture", "2 Door Wardrobes", "WDR")
        elif "4 door" in text_content or "4 d" in text_content:
            return ("Bedroom Furniture", "4 Door Wardrobes", "WDR")
        elif "sliding" in text_content:
            return ("Bedroom Furniture", "Sliding Door Wardrobes", "WDR")
        else:
            return ("Bedroom Furniture", "2 Door Wardrobes", "WDR")

    elif "dressing" in raw or "dressing" in text_content or "dt -" in text_content:
        return ("Bedroom Furniture", "Dressing Tables", "DRS")

    elif "office chair" in raw or "office chair" in text_content or "ccrhb" in text_content or "ccrmb" in text_content:
        return ("Office & Study", "Office Chairs", "OFC")

    elif "sofa" in raw or "sofa" in text_content:
        if "1 seater" in text_content or "1+1" in text_content:
            return ("Sofas & Seating", "1 Seater Sofas", "SFA")
        elif "2 seater" in text_content:
            return ("Sofas & Seating", "2 Seater Sofas", "SFA")
        elif "3 seater" in text_content or "3+" in text_content:
            return ("Sofas & Seating", "3 Seater Sofas", "SFA")
        elif "l-shape" in text_content or "sectional" in text_content:
            return ("Sofas & Seating", "Sectional Sofas", "SFA")
        else:
            return ("Sofas & Seating", "2 Seater Sofas", "SFA")

    elif "dinn" in raw or "dining" in raw or "dining" in text_content or "dinning" in text_content:
        if "set" in text_content or "set" in raw:
            return ("Dining", "6 Seater Dining Sets", "DIN")
        elif "table top" in text_content or "top" in raw:
            return ("Dining", "Dining Tables", "DIN")
        elif "frame" in text_content or "base" in raw:
            return ("Dining", "Dining Tables", "DIN")
        else:
            return ("Dining", "Dining Tables", "DIN")

    elif "table" in raw or "table" in text_content or "coffee" in text_content or "center" in text_content:
        if "coffee" in text_content or "center" in text_content or "centre" in text_content or " ct -" in text_content:
            return ("Living Tables & Storage", "Centre & Coffee Tables", "TBL")
        elif "study" in text_content or "computer" in text_content or " st -" in text_content:
            return ("Office & Study", "Study & Computer Desks", "TBL")
        elif "bedside" in text_content:
            return ("Bedroom Furniture", "Bedside Tables", "TBL")
        elif "side" in text_content or "end table" in text_content:
            return ("Living Tables & Storage", "Side & End Tables", "TBL")
        else:
            return ("Living Tables & Storage", "Centre & Coffee Tables", "TBL")

    elif "chair" in raw or "chair" in text_content:
        return ("Sofas & Seating", "Accent & Lounge Chairs", "CHR")

    elif "tv" in text_content or "tv unit" in text_content or "wtu" in text_content:
        return ("Living Tables & Storage", "TV & Media Units", "STG")

    elif "shoe" in text_content or "shoe rack" in text_content or "sr-" in text_content:
        return ("Living Tables & Storage", "Shoe Racks & Cabinets", "STG")

    elif "storage" in text_content or "cabinet" in text_content or "pedestal" in text_content:
        return ("Living Tables & Storage", "Cabinets & Sideboards", "STG")

    else:
        return ("Living Tables & Storage", "Cabinets & Sideboards", "GEN")


async def get_or_create_crystal_brand(db: AsyncSession, tenant_id: uuid.UUID) -> Brand:
    result = await db.execute(
        select(Brand).where(
            Brand.tenant_id == tenant_id,
            func.lower(Brand.name) == "crystal",
        )
    )
    brand = result.scalar_one_or_none()
    if not brand:
        brand = Brand(
            tenant_id=tenant_id,
            name="Crystal",
            description="Crystal Manufacturing & Furniture Supplier",
            is_active=True,
        )
        db.add(brand)
        await db.flush()
    return brand


async def get_default_unit_and_tax(db: AsyncSession, tenant_id: uuid.UUID) -> Tuple[Optional[uuid.UUID], Optional[uuid.UUID]]:
    unit_res = await db.execute(
        select(UnitOfMeasure.id).where(
            UnitOfMeasure.tenant_id == tenant_id,
            or_(
                func.lower(UnitOfMeasure.code) == "pc",
                func.lower(UnitOfMeasure.name).ilike("%piece%"),
            ),
        )
    )
    unit_id = unit_res.scalar_one_or_none()

    tax_res = await db.execute(
        select(TaxRate.id).where(
            TaxRate.tenant_id == tenant_id,
            TaxRate.rate == Decimal("18.00"),
        )
    )
    tax_id = tax_res.scalar_one_or_none()
    return unit_id, tax_id


async def parse_and_sync_excel(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    user_id: Optional[uuid.UUID] = None,
) -> CompanyStockUploadResult:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = wb.active

    # 1. Parse report date from row 1 or filename
    report_date = None
    row1_val = str(sheet.cell(1, 1).value or "")
    date_match = re.search(r"(\d{4}[-_]\d{2}[-_]\d{2})|(\d{2}[-_.]\d{2}[-_.]\d{4})", f"{row1_val} {filename}")
    if date_match:
        raw_date = date_match.group(0).replace("_", "-").replace(".", "-")
        try:
            if re.match(r"^\d{4}-\d{2}-\d{2}$", raw_date):
                report_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
            elif re.match(r"^\d{2}-\d{2}-\d{4}$", raw_date):
                report_date = datetime.strptime(raw_date, "%d-%m-%Y").date()
        except Exception:
            report_date = date.today()
    if not report_date:
        report_date = date.today()

    # 2. Setup Brand, Unit, TaxRate, and Categories
    brand = await get_or_create_crystal_brand(db, tenant_id)
    unit_id, tax_id = await get_default_unit_and_tax(db, tenant_id)

    # Load categories cache for tenant
    cats_res = await db.execute(
        select(Category).where(Category.tenant_id == tenant_id)
    )
    all_categories = cats_res.scalars().all()
    parent_map: Dict[str, Category] = {
        c.name.lower(): c for c in all_categories if c.parent_id is None
    }
    sub_map: Dict[Tuple[uuid.UUID, str], Category] = {
        (c.parent_id, c.name.lower()): c for c in all_categories if c.parent_id is not None
    }

    # Load existing company stock items for tenant
    existing_cs_res = await db.execute(
        select(CompanyStockItem).where(CompanyStockItem.tenant_id == tenant_id)
    )
    existing_cs_map = {
        item.supplier_item_code: item for item in existing_cs_res.scalars().all()
    }

    # Load existing Crystal products by supplier_item_code or name
    prod_res = await db.execute(
        select(Product)
        .options(selectinload(Product.variants))
        .where(
            Product.tenant_id == tenant_id,
            Product.brand_id == brand.id,
        )
    )
    existing_products = prod_res.scalars().all()
    prod_by_model: Dict[str, Product] = {p.model: p for p in existing_products if p.model}
    prod_by_name: Dict[str, Product] = {p.name.strip().lower(): p for p in existing_products}

    # 3. Create batch record
    batch = CompanyStockBatch(
        tenant_id=tenant_id,
        filename=filename,
        brand_name="Crystal",
        report_date=report_date,
        uploaded_by=user_id,
    )
    db.add(batch)
    await db.flush()

    # 4. Set all existing Crystal items company_stock to 0 (Smart Overwrite baseline)
    await db.execute(
        update(CompanyStockItem)
        .where(CompanyStockItem.tenant_id == tenant_id, CompanyStockItem.brand_name == "Crystal")
        .values(company_stock=0)
    )

    # Counter for auto-generating SKUs
    # Find current max SKU number for CRYS-
    var_res = await db.execute(
        select(ProductVariant.sku).where(
            ProductVariant.tenant_id == tenant_id,
            ProductVariant.sku.like("CRYS-%"),
        )
    )
    existing_skus = set(var_res.scalars().all())
    sku_counters: Dict[str, int] = {}

    total_rows = 0
    total_stock = 0
    new_products_created = 0
    existing_products_updated = 0

    # Start from row 3 (Row 1 = Title, Row 2 = Headers)
    for r in range(3, sheet.max_row + 1):
        item_code_val = sheet.cell(r, 2).value
        if not item_code_val:
            continue
        supplier_code = str(item_code_val).strip()
        raw_desc = str(sheet.cell(r, 3).value or "").strip()
        raw_cat = str(sheet.cell(r, 4).value or "").strip()
        raw_size = clean_size(sheet.cell(r, 5).value)
        raw_color = clean_color(sheet.cell(r, 6).value)
        raw_qty = sheet.cell(r, 7).value

        try:
            qty = int(raw_qty) if raw_qty is not None else 0
            if qty < 0:
                qty = 0
        except (ValueError, TypeError):
            qty = 0

        total_rows += 1
        total_stock += qty

        cleaned_d = clean_desc(raw_desc)
        main_cat_name, sub_cat_name, sku_prefix = categorize_item(supplier_code, cleaned_d, raw_cat)

        # Resolve Category IDs
        main_cat = parent_map.get(main_cat_name.lower())
        cat_id = main_cat.id if main_cat else None

        sub_cat = None
        if main_cat and (main_cat.id, sub_cat_name.lower()) in sub_map:
            sub_cat = sub_map[(main_cat.id, sub_cat_name.lower())]
        elif main_cat:
            # Fallback to first subcategory under main category
            first_subs = [c for c in all_categories if c.parent_id == main_cat.id]
            sub_cat = first_subs[0] if first_subs else None
        subcat_id = sub_cat.id if sub_cat else None

        # Check if Product exists
        product = prod_by_model.get(supplier_code) or prod_by_name.get(supplier_code.lower())

        if not product:
            # Generate sequential SKU: e.g. CRYS-BED-0001
            current_count = sku_counters.get(sku_prefix, 0) + 1
            sku_candidate = f"CRYS-{sku_prefix}-{StringSeq(current_count)}"
            while sku_candidate in existing_skus:
                current_count += 1
                sku_candidate = f"CRYS-{sku_prefix}-{StringSeq(current_count)}"
            sku_counters[sku_prefix] = current_count
            existing_skus.add(sku_candidate)

            # Create Master Product
            product = Product(
                tenant_id=tenant_id,
                name=supplier_code,
                description=cleaned_d or f"{supplier_code} ({main_cat_name})",
                category_id=cat_id,
                subcategory_id=subcat_id,
                brand_id=brand.id,
                model=supplier_code,
                tax_rate_id=tax_id,
                is_active=True,
                created_by=user_id,
            )
            db.add(product)
            await db.flush()

            # Create Default Variant
            variant = ProductVariant(
                tenant_id=tenant_id,
                product_id=product.id,
                sku=sku_candidate,
                variant_name="Standard",
                unit_id=unit_id,
                purchase_price=Decimal("0.00"),
                selling_price=Decimal("0.00"),
                mrp=Decimal("0.00"),
                is_active=True,
                created_by=user_id,
            )
            db.add(variant)

            prod_by_model[supplier_code] = product
            prod_by_name[supplier_code.lower()] = product
            new_products_created += 1
        else:
            existing_products_updated += 1

        # Upsert CompanyStockItem
        if supplier_code in existing_cs_map:
            cs_item = existing_cs_map[supplier_code]
            cs_item.company_stock = qty
            cs_item.report_date = report_date
            cs_item.batch_id = batch.id
            cs_item.size = raw_size
            cs_item.color = raw_color
            cs_item.description = cleaned_d
            cs_item.category_raw = raw_cat
            cs_item.product_id = product.id
        else:
            cs_item = CompanyStockItem(
                tenant_id=tenant_id,
                product_id=product.id,
                batch_id=batch.id,
                brand_name="Crystal",
                supplier_item_code=supplier_code,
                item_name=supplier_code,
                description=cleaned_d,
                category_raw=raw_cat,
                size=raw_size,
                color=raw_color,
                company_stock=qty,
                report_date=report_date,
            )
            db.add(cs_item)
            existing_cs_map[supplier_code] = cs_item

    # Update batch summary
    batch.total_items = total_rows
    batch.total_company_stock = total_stock
    batch.new_products_created = new_products_created

    await db.commit()

    return CompanyStockUploadResult(
        batch_id=batch.id,
        filename=filename,
        report_date=report_date,
        total_rows_processed=total_rows,
        total_company_stock=total_stock,
        new_products_created=new_products_created,
        existing_products_updated=existing_products_updated,
        brand_name="Crystal",
    )


def StringSeq(n: int) -> str:
    return str(n).zfill(4)


async def list_company_stock(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    search: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    subcategory_id: Optional[uuid.UUID] = None,
    stock_filter: Optional[str] = "all",  # 'all', 'in_company_stock', 'out_of_store', 'in_store'
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "company_stock",
    sort_order: str = "desc",
) -> Tuple[List[CompanyStockItemResponse], PaginationMeta]:
    """
    Returns company stock items joined with master products, categories, variants, and live store balances.
    """
    # Subquery for live in-house store stock
    store_stock_sub = (
        select(
            ProductVariant.product_id,
            func.coalesce(func.sum(StockBalance.quantity), 0).label("store_qty"),
        )
        .join(StockBalance, StockBalance.variant_id == ProductVariant.id, isouter=True)
        .where(ProductVariant.tenant_id == tenant_id)
        .group_by(ProductVariant.product_id)
        .subquery()
    )

    # Base query
    query = (
        select(
            CompanyStockItem,
            Product,
            ProductVariant,
            func.coalesce(store_stock_sub.c.store_qty, 0).label("store_stock"),
        )
        .join(Product, Product.id == CompanyStockItem.product_id)
        .join(ProductVariant, and_(ProductVariant.product_id == Product.id, ProductVariant.is_active == True), isouter=True)
        .join(store_stock_sub, store_stock_sub.c.product_id == Product.id, isouter=True)
        .options(
            selectinload(Product.category),
            selectinload(Product.subcategory),
        )
        .where(CompanyStockItem.tenant_id == tenant_id)
    )

    # Filters
    if category_id:
        query = query.where(Product.category_id == category_id)
    if subcategory_id:
        query = query.where(Product.subcategory_id == subcategory_id)

    if stock_filter == "in_company_stock":
        query = query.where(CompanyStockItem.company_stock > 0)
    elif stock_filter == "out_of_store":
        query = query.where(func.coalesce(store_stock_sub.c.store_qty, 0) <= 0)
    elif stock_filter == "in_store":
        query = query.where(func.coalesce(store_stock_sub.c.store_qty, 0) > 0)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                CompanyStockItem.item_name.ilike(term),
                CompanyStockItem.supplier_item_code.ilike(term),
                CompanyStockItem.description.ilike(term),
                CompanyStockItem.color.ilike(term),
                CompanyStockItem.size.ilike(term),
                ProductVariant.sku.ilike(term),
            )
        )

    # Count total
    count_sub = query.subquery()
    total_res = await db.execute(select(func.count()).select_from(count_sub))
    total_items = total_res.scalar_one()

    # Sorting
    if sort_by == "name":
        order_col = CompanyStockItem.item_name.desc() if sort_order == "desc" else CompanyStockItem.item_name.asc()
    elif sort_by == "store_stock":
        order_col = func.coalesce(store_stock_sub.c.store_qty, 0).desc() if sort_order == "desc" else func.coalesce(store_stock_sub.c.store_qty, 0).asc()
    else:
        order_col = CompanyStockItem.company_stock.desc() if sort_order == "desc" else CompanyStockItem.company_stock.asc()

    query = query.order_by(order_col)

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    rows = (await db.execute(query)).all()

    items: List[CompanyStockItemResponse] = []
    seen_ids = set()

    for cs_item, prod, variant, store_qty in rows:
        if cs_item.id in seen_ids:
            continue
        seen_ids.add(cs_item.id)

        items.append(
            CompanyStockItemResponse(
                id=cs_item.id,
                product_id=prod.id,
                brand_name=cs_item.brand_name,
                supplier_item_code=cs_item.supplier_item_code,
                item_name=cs_item.item_name,
                description=cs_item.description,
                category_name=prod.category.name if prod.category else None,
                subcategory_name=prod.subcategory.name if prod.subcategory else None,
                category_id=prod.category_id,
                subcategory_id=prod.subcategory_id,
                size=cs_item.size,
                color=cs_item.color,
                sku=variant.sku if variant else None,
                company_stock=cs_item.company_stock,
                store_stock=float(store_qty or 0),
                selling_price=float(variant.selling_price) if variant and variant.selling_price else 0.0,
                mrp=float(variant.mrp) if variant and variant.mrp else 0.0,
                cost_price=float(variant.purchase_price) if variant and variant.purchase_price else 0.0,
                report_date=cs_item.report_date,
                updated_at=cs_item.updated_at,
            )
        )

    meta = paginate(total_items, page, page_size)
    return items, meta


async def get_procurement_summary(db: AsyncSession, tenant_id: uuid.UUID) -> CompanyStockSummaryResponse:
    # Latest batch
    batch_res = await db.execute(
        select(CompanyStockBatch)
        .where(CompanyStockBatch.tenant_id == tenant_id)
        .order_by(CompanyStockBatch.created_at.desc())
        .limit(1)
    )
    latest_batch = batch_res.scalar_one_or_none()

    # Aggregate counts
    agg_res = await db.execute(
        select(
            func.count(CompanyStockItem.id),
            func.coalesce(func.sum(CompanyStockItem.company_stock), 0),
            func.count().filter(CompanyStockItem.company_stock > 0),
        ).where(CompanyStockItem.tenant_id == tenant_id)
    )
    total_prods, total_company_stock, in_company_stock_count = agg_res.one()

    # Total store stock for Crystal products
    store_stock_res = await db.execute(
        select(func.coalesce(func.sum(StockBalance.quantity), 0))
        .join(ProductVariant, ProductVariant.id == StockBalance.variant_id)
        .join(Product, Product.id == ProductVariant.product_id)
        .join(CompanyStockItem, CompanyStockItem.product_id == Product.id)
        .where(StockBalance.tenant_id == tenant_id)
    )
    total_store_stock = float(store_stock_res.scalar_one() or 0)

    # Count items with 0 in-store stock
    store_stock_sub = (
        select(
            ProductVariant.product_id,
            func.coalesce(func.sum(StockBalance.quantity), 0).label("store_qty"),
        )
        .join(StockBalance, StockBalance.variant_id == ProductVariant.id, isouter=True)
        .where(ProductVariant.tenant_id == tenant_id)
        .group_by(ProductVariant.product_id)
        .subquery()
    )

    zero_store_res = await db.execute(
        select(func.count(CompanyStockItem.id))
        .join(store_stock_sub, store_stock_sub.c.product_id == CompanyStockItem.product_id, isouter=True)
        .where(
            CompanyStockItem.tenant_id == tenant_id,
            CompanyStockItem.company_stock > 0,
            func.coalesce(store_stock_sub.c.store_qty, 0) <= 0,
        )
    )
    out_of_store_count = zero_store_res.scalar_one()

    return CompanyStockSummaryResponse(
        total_products=total_prods or 0,
        total_company_stock=int(total_company_stock or 0),
        total_store_stock=total_store_stock,
        out_of_stock_in_store_count=out_of_store_count or 0,
        in_company_stock_count=in_company_stock_count or 0,
        last_filename=latest_batch.filename if latest_batch else None,
        last_report_date=latest_batch.report_date if latest_batch else None,
        last_uploaded_at=latest_batch.created_at if latest_batch else None,
    )


def generate_whatsapp_order_message(
    items: List[Any],
    supplier_name: str = "Crystal",
    delivery_location: str = "Home Decor Showroom",
    special_notes: Optional[str] = None,
) -> WhatsAppOrderPreviewResponse:
    today_str = datetime.now().strftime("%d-%b-%Y")
    ref_code = f"PO-CRYS-{datetime.now().strftime('%Y%m%d-%H%M')}"

    total_qty = sum(item.quantity for item in items)
    lines = [
        f"*PURCHASE ORDER — HOME DECOR*",
        f"*Supplier:* {supplier_name}",
        f"*Date:* {today_str}",
        f"*Reference:* {ref_code}",
        "",
        "Please book and dispatch the following items as per your latest stock report:",
        "",
    ]

    for idx, it in enumerate(items, 1):
        lines.append(f"{idx}. *{it.item_name}*")
        sku_str = f"SKU: {it.sku}" if it.sku else ""
        code_str = f"Supplier Code: {it.supplier_item_code}"
        sub_line = " | ".join(filter(None, [sku_str, code_str]))
        if sub_line:
            lines.append(f"   • {sub_line}")

        specs = []
        if it.color:
            specs.append(f"Color: {it.color}")
        if it.size:
            specs.append(f"Size: {it.size}")
        if specs:
            lines.append(f"   • {' | '.join(specs)}")

        lines.append(f"   • *Order Quantity: {it.quantity} pcs*")
        lines.append("")

    lines.append("----------------------------------------")
    lines.append(f"*Total Products:* {len(items)} items")
    lines.append(f"*Total Quantity:* {total_qty} pieces")
    lines.append(f"*Delivery Location:* {delivery_location}")
    if special_notes:
        lines.append(f"*Notes:* {special_notes}")
    lines.append("----------------------------------------")
    lines.append("Kindly confirm stock reservation and dispatch date.")

    msg = "\n".join(lines)
    encoded = urllib.parse.quote(msg)

    return WhatsAppOrderPreviewResponse(
        formatted_message=msg,
        total_items=len(items),
        total_quantity=total_qty,
        encoded_url=f"https://wa.me/?text={encoded}",
    )