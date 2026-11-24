import csv
import io
import uuid
import re
from collections import defaultdict
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, delete, case
from sqlalchemy.orm import selectinload

from app.common.exceptions import (
    NotFoundException,
    ConflictException,
    ValidationException,
)
from app.common.storage import save_upload, delete_file
from app.common.pagination import paginate, PaginationMeta
from app.modules.settings.models import (
    Category,
    Brand,
    UnitOfMeasure,
    TaxRate,
    AttributeDefinition,
    AttributeOption,
    Location,
    StockCondition,
)
from app.modules.stock.models import StockBalance
from app.modules.catalogue.models import (
    Product,
    ProductVariant,
    ProductAttributeValue,
    ProductImage,
    PriceHistory,
)
from app.modules.catalogue.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductDetailResponse,
    ProductSearchItem,
    VariantResponse,
    VariantIn,
    AttributeValueDetail,
    ProductImageResponse,
    CsvPreviewResponse,
    CsvRowPreview,
    CsvImportResult,
)
from app.modules.audit.service import log_audit


async def validate_cross_tenant_foreign_keys(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    category_id: Optional[uuid.UUID] = None,
    subcategory_id: Optional[uuid.UUID] = None,
    brand_id: Optional[uuid.UUID] = None,
    tax_rate_id: Optional[uuid.UUID] = None,
    unit_ids: Optional[List[uuid.UUID]] = None,
    attribute_ids: Optional[List[uuid.UUID]] = None,
    option_ids: Optional[List[uuid.UUID]] = None,
):
    """Enforce §4.7 / §6.4: referenced records MUST exist within current tenant or return 404."""
    if category_id:
        res = await db.execute(
            select(Category).where(Category.id == category_id, Category.tenant_id == tenant_id)
        )
        if not res.scalar_one_or_none():
            raise NotFoundException("Category", str(category_id))

    if subcategory_id:
        res = await db.execute(
            select(Category).where(Category.id == subcategory_id, Category.tenant_id == tenant_id)
        )
        if not res.scalar_one_or_none():
            raise NotFoundException("Subcategory", str(subcategory_id))

    if brand_id:
        res = await db.execute(
            select(Brand).where(Brand.id == brand_id, Brand.tenant_id == tenant_id)
        )
        if not res.scalar_one_or_none():
            raise NotFoundException("Brand", str(brand_id))

    if tax_rate_id:
        res = await db.execute(
            select(TaxRate).where(TaxRate.id == tax_rate_id, TaxRate.tenant_id == tenant_id)
        )
        if not res.scalar_one_or_none():
            raise NotFoundException("TaxRate", str(tax_rate_id))

    if unit_ids:
        for uid in set(unit_ids):
            if uid:
                res = await db.execute(
                    select(UnitOfMeasure).where(UnitOfMeasure.id == uid, UnitOfMeasure.tenant_id == tenant_id)
                )
                if not res.scalar_one_or_none():
                    raise NotFoundException("UnitOfMeasure", str(uid))

    if attribute_ids:
        for aid in set(attribute_ids):
            if aid:
                res = await db.execute(
                    select(AttributeDefinition).where(AttributeDefinition.id == aid, AttributeDefinition.tenant_id == tenant_id)
                )
                if not res.scalar_one_or_none():
                    raise NotFoundException("AttributeDefinition", str(aid))

    if option_ids:
        for oid in set(option_ids):
            if oid:
                res = await db.execute(
                    select(AttributeOption)
                    .join(AttributeDefinition, AttributeDefinition.id == AttributeOption.attribute_id)
                    .where(AttributeOption.id == oid, AttributeDefinition.tenant_id == tenant_id)
                )
                if not res.scalar_one_or_none():
                    raise NotFoundException("AttributeOption", str(oid))


def _calc_dimensions(val_mm: Optional[Decimal], val_in: Optional[Decimal]) -> tuple[Optional[Decimal], Optional[Decimal]]:
    mm = val_mm
    inch = val_in
    if mm is not None and inch is None:
        try:
            inch = Decimal(str(round(float(mm) / 25.4, 2)))
        except Exception:
            pass
    elif inch is not None and mm is None:
        try:
            mm = Decimal(str(round(float(inch) * 25.4, 1)))
        except Exception:
            pass
    return mm, inch


async def get_next_sku(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    prefix: str,
    count: int = 1,
) -> dict:
    clean_prefix = (prefix or "").strip().rstrip("-").upper()
    if not clean_prefix:
        clean_prefix = "GEN-GEN"

    stmt = select(ProductVariant.sku).where(
        ProductVariant.tenant_id == tenant_id,
        ProductVariant.sku.ilike(f"{clean_prefix}-%"),
    )
    res = await db.execute(stmt)
    existing_skus = res.scalars().all()

    max_seq = 0
    max_digits = 3

    for sku_str in existing_skus:
        sku_clean = sku_str.strip()
        match = re.search(r"-(\d+)$", sku_clean)
        if match:
            num_str = match.group(1)
            num_val = int(num_str)
            if num_val > max_seq:
                max_seq = num_val
            if len(num_str) > max_digits:
                max_digits = len(num_str)

    next_start = max_seq + 1
    safe_count = max(1, min(count, 50))
    skus = [
        f"{clean_prefix}-{str(next_start + i).zfill(max_digits)}"
        for i in range(safe_count)
    ]

    return {
        "prefix": clean_prefix,
        "last_sequence": max_seq,
        "next_sequence": next_start,
        "next_sku": skus[0],
        "skus": skus,
    }


async def create_product(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ProductCreate,
) -> ProductDetailResponse:
    # 1. Cross-tenant foreign key validation
    unit_ids = [v.unit_id for v in data.variants if v.unit_id]
    attr_ids = [a.attribute_id for a in data.attributes if a.attribute_id]
    opt_ids = [a.option_id for a in data.attributes if a.option_id]

    await validate_cross_tenant_foreign_keys(
        db, tenant_id, data.category_id, data.subcategory_id, data.brand_id, data.tax_rate_id, unit_ids, attr_ids, opt_ids
    )

    # 2. Validate SKU uniqueness within tenant
    skus = [v.sku.strip() for v in data.variants]
    if len(skus) != len(set(skus)):
        raise ConflictException("Duplicate SKUs provided in request")

    for sku in skus:
        dup_res = await db.execute(
            select(ProductVariant).where(
                ProductVariant.tenant_id == tenant_id,
                ProductVariant.sku == sku,
            )
        )
        if dup_res.scalar_one_or_none():
            raise ConflictException(f"SKU '{sku}' already exists")

    h_mm, h_in = _calc_dimensions(data.height_mm, data.height_inches)
    w_mm, w_in = _calc_dimensions(data.width_mm, data.width_inches)
    d_mm, d_in = _calc_dimensions(data.depth_mm, data.depth_inches)

    # 3. Create product
    product = Product(
        tenant_id=tenant_id,
        name=data.name,
        description=data.description,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        brand_id=data.brand_id,
        model=data.model,
        tax_rate_id=data.tax_rate_id,
        height_mm=h_mm,
        width_mm=w_mm,
        depth_mm=d_mm,
        height_inches=h_in,
        width_inches=w_in,
        depth_inches=d_in,
        created_by=user_id,
    )

    db.add(product)
    await db.flush()

    # 4. Create variants & price history
    created_variants = []
    for var_in in data.variants:
        variant = ProductVariant(
            tenant_id=tenant_id,
            product_id=product.id,
            sku=var_in.sku.strip(),
            variant_name=var_in.variant_name,
            barcode=var_in.barcode,
            barcode_type=var_in.barcode_type,
            unit_id=var_in.unit_id,
            purchase_price=var_in.purchase_price,
            selling_price=var_in.selling_price,
            mrp=var_in.mrp,
            reorder_point=var_in.reorder_point,
            reorder_quantity=var_in.reorder_quantity,
            weight_kg=var_in.weight_kg,
            is_active=var_in.is_active,
            created_by=user_id,
        )
        db.add(variant)
        await db.flush()
        created_variants.append(variant)

        # Price history
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=variant.id, price_type="purchase",
            old_price=None, new_price=var_in.purchase_price, changed_by=user_id, reason="Initial creation"
        ))
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=variant.id, price_type="selling",
            old_price=None, new_price=var_in.selling_price, changed_by=user_id, reason="Initial creation"
        ))
        if var_in.mrp is not None:
            db.add(PriceHistory(
                tenant_id=tenant_id, variant_id=variant.id, price_type="mrp",
                old_price=None, new_price=var_in.mrp, changed_by=user_id, reason="Initial creation"
            ))

    # 5. Create attributes
    for attr_in in data.attributes:
        pav = ProductAttributeValue(
            tenant_id=tenant_id,
            product_id=product.id,
            variant_id=attr_in.variant_id,
            attribute_id=attr_in.attribute_id,
            text_value=attr_in.text_value,
            numeric_value=attr_in.numeric_value,
            decimal_value=attr_in.decimal_value,
            boolean_value=attr_in.boolean_value,
            date_value=attr_in.date_value,
            option_id=attr_in.option_id,
            option_ids=attr_in.option_ids,
        )
        db.add(pav)

    # 6. Audit log
    await log_audit(
        db, tenant_id, user_id, "CREATE", "product", product.id, f"Created product {product.name}"
    )

    prod_id = product.id
    await db.commit()
    return await get_product_detail(db, tenant_id, prod_id)


async def get_product_detail(db: AsyncSession, tenant_id: uuid.UUID, product_id: uuid.UUID) -> ProductDetailResponse:
    query = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.subcategory),
            selectinload(Product.brand),
            selectinload(Product.tax_rate),
            selectinload(Product.variants).selectinload(ProductVariant.unit),
            selectinload(Product.images),
            selectinload(Product.attribute_values)
            .selectinload(ProductAttributeValue.attribute)
            .selectinload(AttributeDefinition.options),
            selectinload(Product.attribute_values).selectinload(ProductAttributeValue.option),
        )
        .execution_options(populate_existing=True)
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", str(product_id))

    # Pre-fetch lookup maps to guarantee no MissingGreenlet on lazy relations
    unit_ids = [v.unit_id for v in product.variants if v.unit_id]
    units_map = {}
    if unit_ids:
        units_res = await db.execute(
            select(UnitOfMeasure).where(UnitOfMeasure.id.in_(unit_ids))
        )
        units_map = {u.id: u for u in units_res.scalars().all()}

    # Build variants response
    variants_resp = []
    for v in product.variants:
        unit = units_map.get(v.unit_id)
        variants_resp.append(
            VariantResponse(
                id=v.id,
                sku=v.sku,
                variant_name=v.variant_name,
                barcode=v.barcode,
                barcode_type=v.barcode_type,
                unit_id=v.unit_id,
                unit_name=unit.name if unit else None,
                unit_code=unit.code if unit else None,
                purchase_price=v.purchase_price,
                selling_price=v.selling_price,
                mrp=v.mrp,
                reorder_point=v.reorder_point,
                reorder_quantity=v.reorder_quantity,
                weight_kg=v.weight_kg,
                is_active=v.is_active,
            )
        )

    # Pre-fetch attribute definitions and options
    attr_ids = [pav.attribute_id for pav in product.attribute_values if pav.attribute_id]
    option_ids = [pav.option_id for pav in product.attribute_values if pav.option_id]

    attr_defs_map = {}
    if attr_ids:
        attr_defs_res = await db.execute(
            select(AttributeDefinition).where(AttributeDefinition.id.in_(attr_ids))
        )
        attr_defs_map = {a.id: a for a in attr_defs_res.scalars().all()}

    options_map = {}
    if option_ids:
        opts_res = await db.execute(
            select(AttributeOption).where(AttributeOption.id.in_(option_ids))
        )
        options_map = {o.id: o for o in opts_res.scalars().all()}

    # Build attributes detail
    attrs_resp = []
    for pav in product.attribute_values:
        attr_def = attr_defs_map.get(pav.attribute_id)
        opt = options_map.get(pav.option_id)
        fmt_val = ""
        opt_label = opt.value if opt else None

        if pav.text_value is not None:
            fmt_val = pav.text_value
        elif pav.decimal_value is not None:
            fmt_val = f"{pav.decimal_value} {attr_def.unit_label or ''}".strip() if attr_def else str(pav.decimal_value)
        elif pav.numeric_value is not None:
            fmt_val = f"{pav.numeric_value} {attr_def.unit_label or ''}".strip() if attr_def else str(pav.numeric_value)
        elif pav.boolean_value is not None:
            fmt_val = "Yes" if pav.boolean_value else "No"
        elif pav.date_value is not None:
            fmt_val = str(pav.date_value)
        elif opt_label:
            fmt_val = opt_label

        attrs_resp.append(
            AttributeValueDetail(
                id=pav.id,
                attribute_id=pav.attribute_id,
                attribute_name=attr_def.name if attr_def else "",
                attribute_code=attr_def.code if attr_def else "",
                data_type=attr_def.data_type if attr_def else "text",
                unit_label=attr_def.unit_label if attr_def else None,
                variant_id=pav.variant_id,
                text_value=pav.text_value,
                numeric_value=pav.numeric_value,
                decimal_value=pav.decimal_value,
                boolean_value=pav.boolean_value,
                date_value=pav.date_value,
                option_id=pav.option_id,
                option_label=opt_label,
                option_ids=pav.option_ids,
                formatted_value=fmt_val,
            )
        )

    # Build images response (ensure single image or first image defaults to primary)
    if product.images and (len(product.images) == 1 or not any(img.is_primary for img in product.images)):
        if not product.images[0].is_primary:
            product.images[0].is_primary = True
            await db.commit()

    images_resp = [ProductImageResponse.model_validate(img) for img in product.images]

    return ProductDetailResponse(
        id=product.id,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        subcategory_id=product.subcategory_id,
        subcategory_name=product.subcategory.name if product.subcategory else None,
        brand_id=product.brand_id,
        brand_name=product.brand.name if product.brand else None,
        model=product.model,
        tax_rate_id=product.tax_rate_id,
        tax_rate_name=product.tax_rate.name if product.tax_rate else None,
        tax_rate_percent=product.tax_rate.rate if product.tax_rate else None,
        is_active=product.is_active,
        created_at=product.created_at,
        height_mm=product.height_mm,
        width_mm=product.width_mm,
        depth_mm=product.depth_mm,
        height_inches=product.height_inches,
        width_inches=product.width_inches,
        depth_inches=product.depth_inches,
        variants=variants_resp,
        attributes=attrs_resp,
        images=images_resp,
    )


async def update_product(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    data: ProductUpdate,
) -> ProductDetailResponse:
    query = (
        select(Product)
        .options(
            selectinload(Product.variants),
            selectinload(Product.attribute_values),
        )
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    result = await db.execute(query)
    product = result.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", str(product_id))

    unit_ids = [v.unit_id for v in data.variants if v.unit_id] if data.variants else None
    attr_ids = [a.attribute_id for a in data.attributes if a.attribute_id] if data.attributes else None
    opt_ids = [a.option_id for a in data.attributes if a.option_id] if data.attributes else None

    await validate_cross_tenant_foreign_keys(
        db, tenant_id, data.category_id, data.subcategory_id, data.brand_id, data.tax_rate_id, unit_ids, attr_ids, opt_ids
    )

    if data.name is not None:
        product.name = data.name
    if data.description is not None:
        product.description = data.description
    if data.category_id is not None:
        product.category_id = data.category_id
    if "subcategory_id" in data.model_fields_set:
        product.subcategory_id = data.subcategory_id
    if data.brand_id is not None:
        product.brand_id = data.brand_id
    if data.model is not None:
        product.model = data.model
    if data.tax_rate_id is not None:
        product.tax_rate_id = data.tax_rate_id
    if data.is_active is not None:
        product.is_active = data.is_active
    if "height_mm" in data.model_fields_set or "height_inches" in data.model_fields_set:
        h_mm, h_in = _calc_dimensions(data.height_mm, data.height_inches)
        product.height_mm = h_mm
        product.height_inches = h_in
    if "width_mm" in data.model_fields_set or "width_inches" in data.model_fields_set:
        w_mm, w_in = _calc_dimensions(data.width_mm, data.width_inches)
        product.width_mm = w_mm
        product.width_inches = w_in
    if "depth_mm" in data.model_fields_set or "depth_inches" in data.model_fields_set:
        d_mm, d_in = _calc_dimensions(data.depth_mm, data.depth_inches)
        product.depth_mm = d_mm
        product.depth_inches = d_in
    product.updated_by = user_id

    # Handle variants if provided
    if data.variants is not None:
        existing_variants = {v.id: v for v in product.variants}
        incoming_skus = [v.sku.strip() for v in data.variants]
        if len(incoming_skus) != len(set(incoming_skus)):
            raise ConflictException("Duplicate SKUs in update request")

        for var_in in data.variants:
            # Check SKU uniqueness
            dup_q = select(ProductVariant).where(
                ProductVariant.tenant_id == tenant_id,
                ProductVariant.sku == var_in.sku.strip(),
            )
            if var_in.id:
                dup_q = dup_q.where(ProductVariant.id != var_in.id)
            dup_res = await db.execute(dup_q)
            if dup_res.scalar_one_or_none():
                raise ConflictException(f"SKU '{var_in.sku}' already exists")

            if var_in.id and var_in.id in existing_variants:
                existing_v = existing_variants[var_in.id]
                # Check price changes
                if existing_v.purchase_price != var_in.purchase_price:
                    db.add(PriceHistory(
                        tenant_id=tenant_id, variant_id=existing_v.id, price_type="purchase",
                        old_price=existing_v.purchase_price, new_price=var_in.purchase_price,
                        changed_by=user_id, reason="Price update"
                    ))
                if existing_v.selling_price != var_in.selling_price:
                    db.add(PriceHistory(
                        tenant_id=tenant_id, variant_id=existing_v.id, price_type="selling",
                        old_price=existing_v.selling_price, new_price=var_in.selling_price,
                        changed_by=user_id, reason="Price update"
                    ))
                if existing_v.mrp != var_in.mrp:
                    db.add(PriceHistory(
                        tenant_id=tenant_id, variant_id=existing_v.id, price_type="mrp",
                        old_price=existing_v.mrp, new_price=var_in.mrp or Decimal("0.00"),
                        changed_by=user_id, reason="Price update"
                    ))

                existing_v.sku = var_in.sku.strip()
                existing_v.variant_name = var_in.variant_name
                existing_v.barcode = var_in.barcode
                existing_v.barcode_type = var_in.barcode_type
                existing_v.unit_id = var_in.unit_id
                existing_v.purchase_price = var_in.purchase_price
                existing_v.selling_price = var_in.selling_price
                existing_v.mrp = var_in.mrp
                existing_v.reorder_point = var_in.reorder_point
                existing_v.reorder_quantity = var_in.reorder_quantity
                existing_v.weight_kg = var_in.weight_kg
                existing_v.is_active = var_in.is_active
                existing_v.updated_by = user_id
            else:
                new_v = ProductVariant(
                    tenant_id=tenant_id,
                    product_id=product.id,
                    sku=var_in.sku.strip(),
                    variant_name=var_in.variant_name,
                    barcode=var_in.barcode,
                    barcode_type=var_in.barcode_type,
                    unit_id=var_in.unit_id,
                    purchase_price=var_in.purchase_price,
                    selling_price=var_in.selling_price,
                    mrp=var_in.mrp,
                    reorder_point=var_in.reorder_point,
                    reorder_quantity=var_in.reorder_quantity,
                    weight_kg=var_in.weight_kg,
                    is_active=var_in.is_active,
                    created_by=user_id,
                )
                db.add(new_v)
                await db.flush()
                # Initial price history
                db.add(PriceHistory(
                    tenant_id=tenant_id, variant_id=new_v.id, price_type="purchase",
                    old_price=None, new_price=var_in.purchase_price, changed_by=user_id, reason="Added variant"
                ))
                db.add(PriceHistory(
                    tenant_id=tenant_id, variant_id=new_v.id, price_type="selling",
                    old_price=None, new_price=var_in.selling_price, changed_by=user_id, reason="Added variant"
                ))

    # Handle attributes if provided
    if data.attributes is not None:
        for old_pav in list(product.attribute_values):
            await db.delete(old_pav)
        for attr_in in data.attributes:
            pav = ProductAttributeValue(
                tenant_id=tenant_id,
                product_id=product.id,
                variant_id=attr_in.variant_id,
                attribute_id=attr_in.attribute_id,
                text_value=attr_in.text_value,
                numeric_value=attr_in.numeric_value,
                decimal_value=attr_in.decimal_value,
                boolean_value=attr_in.boolean_value,
                date_value=attr_in.date_value,
                option_id=attr_in.option_id,
                option_ids=attr_in.option_ids,
            )
            db.add(pav)

    await log_audit(db, tenant_id, user_id, "UPDATE", "product", product.id, f"Updated product {product.name}")
    await db.commit()
    return await get_product_detail(db, tenant_id, product_id)


async def archive_product(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, product_id: uuid.UUID):
    res = await db.execute(select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id))
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", str(product_id))

    product.is_active = False
    product.updated_by = user_id
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "product", product.id, f"Archived product {product.name}")


async def copy_product(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
) -> ProductDetailResponse:
    query = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.subcategory),
            selectinload(Product.brand),
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.attribute_values),
        )
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    res = await db.execute(query)
    source = res.scalar_one_or_none()
    if not source:
        raise NotFoundException("Product", str(product_id))

    # Generate copy name
    match = re.search(r"^(.*?)\s*\(Copy(?:\s*(\d+))?\)$", source.name)
    if match:
        base = match.group(1).strip()
        num = int(match.group(2)) if match.group(2) else 1
        copy_name = f"{base} (Copy {num + 1})"
    else:
        copy_name = f"{source.name} (Copy)"

    # Create new product
    new_product = Product(
        tenant_id=tenant_id,
        name=copy_name,
        description=source.description,
        category_id=source.category_id,
        subcategory_id=source.subcategory_id,
        brand_id=source.brand_id,
        model=source.model,
        tax_rate_id=source.tax_rate_id,
        height_mm=source.height_mm,
        width_mm=source.width_mm,
        depth_mm=source.depth_mm,
        height_inches=source.height_inches,
        width_inches=source.width_inches,
        depth_inches=source.depth_inches,
        is_active=True,
        created_by=user_id,
    )
    db.add(new_product)
    await db.flush()

    # Determine prefix and generate next sequential SKUs
    num_variants = len(source.variants)
    prefix = ""
    if source.variants and source.variants[0].sku:
        m = re.match(r"^(.*)-(\d+)$", source.variants[0].sku.strip())
        if m:
            prefix = m.group(1)

    if not prefix:
        brand_code = (source.brand.name[:3].upper() if source.brand and source.brand.name else "GEN")
        cat_code = (source.category.name[:3].upper() if source.category and source.category.name else "GEN")
        prefix = f"{brand_code}-{cat_code}"

    sku_info = await get_next_sku(db, tenant_id, prefix, count=max(1, num_variants))
    new_skus = sku_info["skus"]

    variant_id_map = {}
    for idx, var in enumerate(source.variants):
        new_sku = new_skus[idx] if idx < len(new_skus) else f"{prefix}-{str(sku_info['next_sequence'] + idx).zfill(3)}"
        new_var = ProductVariant(
            tenant_id=tenant_id,
            product_id=new_product.id,
            sku=new_sku,
            variant_name=var.variant_name,
            barcode=new_sku if (var.barcode and var.barcode == var.sku) else None,
            barcode_type=var.barcode_type,
            unit_id=var.unit_id,
            purchase_price=var.purchase_price,
            selling_price=var.selling_price,
            mrp=var.mrp,
            reorder_point=var.reorder_point,
            reorder_quantity=var.reorder_quantity,
            weight_kg=var.weight_kg,
            is_active=True,
            height_mm=var.height_mm,
            width_mm=var.width_mm,
            depth_mm=var.depth_mm,
            height_inches=var.height_inches,
            width_inches=var.width_inches,
            depth_inches=var.depth_inches,
            created_by=user_id,
        )
        db.add(new_var)
        await db.flush()
        variant_id_map[var.id] = new_var.id

        # Price history
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=new_var.id, price_type="purchase",
            old_price=None, new_price=var.purchase_price, changed_by=user_id, reason="Copied from product"
        ))
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=new_var.id, price_type="selling",
            old_price=None, new_price=var.selling_price, changed_by=user_id, reason="Copied from product"
        ))
        if var.mrp is not None:
            db.add(PriceHistory(
                tenant_id=tenant_id, variant_id=new_var.id, price_type="mrp",
                old_price=None, new_price=var.mrp, changed_by=user_id, reason="Copied from product"
            ))

    # Copy attribute values
    for pav in source.attribute_values:
        new_var_id = variant_id_map.get(pav.variant_id) if pav.variant_id else None
        new_pav = ProductAttributeValue(
            tenant_id=tenant_id,
            product_id=new_product.id,
            variant_id=new_var_id,
            attribute_id=pav.attribute_id,
            text_value=pav.text_value,
            numeric_value=pav.numeric_value,
            decimal_value=pav.decimal_value,
            boolean_value=pav.boolean_value,
            date_value=pav.date_value,
            option_id=pav.option_id,
            option_ids=pav.option_ids,
        )
        db.add(new_pav)

    # Copy images
    for img in source.images:
        new_var_id = variant_id_map.get(img.variant_id) if img.variant_id else None
        new_img = ProductImage(
            tenant_id=tenant_id,
            product_id=new_product.id,
            variant_id=new_var_id,
            file_url=img.file_url,
            file_name=img.file_name,
            file_size=img.file_size,
            mime_type=img.mime_type,
            caption=img.caption,
            is_primary=img.is_primary,
            sort_order=img.sort_order,
        )
        db.add(new_img)

    await log_audit(db, tenant_id, user_id, "CREATE", "product", new_product.id, f"Copied product from {source.name}")
    await db.commit()

    return await get_product_detail(db, tenant_id, new_product.id)
    await db.commit()


# ==================== SEARCH & LISTING ====================

async def search_products(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    q: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    subcategory_id: Optional[uuid.UUID] = None,
    brand_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = True,
    in_stock: Optional[bool] = None,
    low_stock: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "name",
    sort_order: str = "asc",
) -> Tuple[List[ProductSearchItem], PaginationMeta]:
    # Base query for products in tenant
    query = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.subcategory),
            selectinload(Product.brand),
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.attribute_values).selectinload(ProductAttributeValue.attribute),
            selectinload(Product.attribute_values).selectinload(ProductAttributeValue.option),
        )
        .where(Product.tenant_id == tenant_id)
    )

    if is_active is not None:
        query = query.where(Product.is_active == is_active)
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    if subcategory_id is not None:
        query = query.where(Product.subcategory_id == subcategory_id)
    if brand_id is not None:
        query = query.where(Product.brand_id == brand_id)

    if in_stock is True:
        sellable_stock_subq = (
            select(ProductVariant.product_id)
            .join(StockBalance, StockBalance.variant_id == ProductVariant.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                StockBalance.tenant_id == tenant_id,
                StockCondition.is_sellable == True,
                (StockBalance.quantity - StockBalance.reserved_quantity) > Decimal("0.000"),
            )
            .group_by(ProductVariant.product_id)
        )
        query = query.where(Product.id.in_(sellable_stock_subq))
    elif in_stock is False:
        sellable_stock_subq = (
            select(ProductVariant.product_id)
            .join(StockBalance, StockBalance.variant_id == ProductVariant.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                StockBalance.tenant_id == tenant_id,
                StockCondition.is_sellable == True,
                (StockBalance.quantity - StockBalance.reserved_quantity) > Decimal("0.000"),
            )
            .group_by(ProductVariant.product_id)
        )
        query = query.where(~Product.id.in_(sellable_stock_subq))

    if low_stock is True:
        low_stock_subq = (
            select(ProductVariant.product_id)
            .outerjoin(StockBalance, StockBalance.variant_id == ProductVariant.id)
            .outerjoin(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                ProductVariant.tenant_id == tenant_id,
                ProductVariant.is_active == True,
                ProductVariant.reorder_point > 0,
            )
            .group_by(ProductVariant.id, ProductVariant.product_id, ProductVariant.reorder_point)
            .having(
                func.coalesce(
                    func.sum(
                        case(
                            (StockCondition.is_sellable == True, StockBalance.quantity - StockBalance.reserved_quantity),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ) <= ProductVariant.reorder_point
            )
        )
        query = query.where(Product.id.in_(low_stock_subq))

    if q and q.strip():
        search_term = q.strip()
        words = [w.strip() for w in search_term.split() if w.strip()]
        word_conditions = []

        for w in words:
            w_pattern = f"%{w}%"
            num_unit_match = re.match(r"^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$", w)
            parsed_num = None
            parsed_unit = None
            if num_unit_match:
                try:
                    parsed_num = Decimal(num_unit_match.group(1))
                    parsed_unit = num_unit_match.group(2).lower()
                except Exception:
                    pass

            matching_var_product_ids = (
                select(ProductVariant.product_id)
                .where(
                    ProductVariant.tenant_id == tenant_id,
                    or_(
                        ProductVariant.sku.ilike(w_pattern),
                        ProductVariant.barcode.ilike(w_pattern),
                        ProductVariant.variant_name.ilike(w_pattern),
                    ),
                )
            )

            matching_brand_ids = select(Brand.id).where(Brand.tenant_id == tenant_id, Brand.name.ilike(w_pattern))
            matching_cat_ids = select(Category.id).where(Category.tenant_id == tenant_id, Category.name.ilike(w_pattern))

            attr_conditions = [
                ProductAttributeValue.text_value.ilike(w_pattern),
            ]
            matching_option_ids = select(AttributeOption.id).where(AttributeOption.value.ilike(w_pattern))
            attr_conditions.append(ProductAttributeValue.option_id.in_(matching_option_ids))

            if parsed_num is not None:
                attr_conditions.append(
                    and_(
                        or_(
                            ProductAttributeValue.numeric_value == parsed_num,
                            ProductAttributeValue.decimal_value == parsed_num,
                        ),
                        AttributeDefinition.unit_label.ilike(f"%{parsed_unit}%"),
                    )
                )

            matching_attr_product_ids = (
                select(ProductAttributeValue.product_id)
                .join(AttributeDefinition, AttributeDefinition.id == ProductAttributeValue.attribute_id)
                .where(
                    ProductAttributeValue.tenant_id == tenant_id,
                    AttributeDefinition.is_searchable == True,
                    or_(*attr_conditions),
                )
            )

            word_conditions.append(
                or_(
                    Product.name.ilike(w_pattern),
                    Product.description.ilike(w_pattern),
                    Product.model.ilike(w_pattern),
                    Product.id.in_(matching_var_product_ids),
                    Product.brand_id.in_(matching_brand_ids),
                    Product.category_id.in_(matching_cat_ids),
                    Product.id.in_(matching_attr_product_ids),
                )
            )

        if word_conditions:
            query = query.where(and_(*word_conditions))

    # Count total items
    count_subquery = query.subquery()
    count_result = await db.execute(select(func.count()).select_from(count_subquery))
    total_items = count_result.scalar_one()

    # Sorting
    if sort_by == "name":
        order_col = Product.name.desc() if sort_order == "desc" else Product.name.asc()
    else:
        order_col = Product.created_at.desc() if sort_order == "desc" else Product.created_at.asc()
    query = query.order_by(order_col)

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    products = result.scalars().all()

    items: List[ProductSearchItem] = []
    all_variant_ids = [v.id for p in products for v in p.variants]
    stock_by_variant: Dict[uuid.UUID, Decimal] = {}
    location_names_by_variant: Dict[uuid.UUID, set] = defaultdict(set)
    if all_variant_ids:
        sb_res = await db.execute(
            select(StockBalance.variant_id, StockBalance.quantity, Location.name)
            .join(Location, Location.id == StockBalance.location_id)
            .where(
                StockBalance.tenant_id == tenant_id,
                StockBalance.variant_id.in_(all_variant_ids),
                StockBalance.quantity > 0,
            )
        )
        for var_id, qty, loc_name in sb_res.all():
            stock_by_variant[var_id] = stock_by_variant.get(var_id, Decimal("0")) + Decimal(str(qty))
            if loc_name:
                location_names_by_variant[var_id].add(loc_name)

    for p in products:
        # Default SKU and price from first variant
        first_v = p.variants[0] if p.variants else None
        primary_img = next((img for img in p.images if img.is_primary), p.images[0] if p.images else None)

        # Extract locations
        loc_set = set()
        for av in p.attribute_values:
            if av.attribute and (av.attribute.code in ('assigned_location', 'location', 'godown') or 'location' in av.attribute.name.lower()):
                if av.option and av.option.value:
                    loc_set.add(av.option.value)
                elif av.text_value:
                    loc_set.add(av.text_value)
            elif av.option and any(k in av.option.value.lower() for k in ('floor', 'godown', 'showroom', 'warehouse', 'store')):
                loc_set.add(av.option.value)

        # Real stock & stocked locations
        prod_stock = sum(stock_by_variant.get(v.id, Decimal("0")) for v in p.variants)
        real_locations = set()
        for v in p.variants:
            real_locations.update(location_names_by_variant.get(v.id, set()))
        if not real_locations:
            real_locations = loc_set

        items.append(
            ProductSearchItem(
                id=p.id,
                name=p.name,
                category=p.category.name if p.category else None,
                category_id=p.category_id,
                subcategory=p.subcategory.name if p.subcategory else None,
                subcategory_id=p.subcategory_id,
                brand=p.brand.name if p.brand else None,
                brand_id=p.brand_id,
                model=p.model,
                primary_image_url=primary_img.file_url if primary_img else None,
                default_sku=first_v.sku if first_v else None,
                cost_price=first_v.purchase_price if first_v else None,
                purchase_price=first_v.purchase_price if first_v else None,
                selling_price=first_v.selling_price if first_v else None,
                mrp=first_v.mrp if first_v else None,
                variant_count=len(p.variants),
                is_active=p.is_active,
                locations=sorted(list(real_locations)),
                total_stock=prod_stock,
            )
        )

    meta = paginate(total_items, page, page_size)
    return items, meta


# ==================== PRODUCT IMAGES ====================

async def upload_product_images(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    files: List[UploadFile],
    variant_id: Optional[uuid.UUID] = None,
) -> List[ProductImageResponse]:
    # Verify product belongs to tenant
    res = await db.execute(select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id))
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", str(product_id))

    # Check if there is already any primary image
    has_primary_res = await db.execute(
        select(func.count(ProductImage.id)).where(
            ProductImage.product_id == product_id,
            ProductImage.tenant_id == tenant_id,
            ProductImage.is_primary == True,
        )
    )
    has_primary = has_primary_res.scalar_one() > 0

    count_res = await db.execute(
        select(func.count(ProductImage.id)).where(ProductImage.product_id == product_id)
    )
    existing_count = count_res.scalar_one()

    saved_images = []
    subdir = f"products/{tenant_id}/{product_id}"

    for i, file in enumerate(files):
        meta = await save_upload(file, subdir)
        is_primary = (not has_primary and i == 0)
        if is_primary:
            has_primary = True
        img = ProductImage(
            tenant_id=tenant_id,
            product_id=product_id,
            variant_id=variant_id,
            file_url=meta["file_url"],
            file_name=meta["file_name"],
            file_size=meta["file_size"],
            mime_type=meta["mime_type"],
            is_primary=is_primary,
            sort_order=existing_count + i,
        )
        db.add(img)
        saved_images.append(img)

    await log_audit(
        db, tenant_id, user_id, "UPLOAD", "product_image", product.id, f"Uploaded {len(files)} image(s)"
    )
    await db.commit()
    for img in saved_images:
        await db.refresh(img)

    return [ProductImageResponse.model_validate(img) for img in saved_images]


async def add_product_image_url(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    file_url: str,
    caption: Optional[str] = None,
    is_primary: Optional[bool] = False,
) -> ProductImageResponse:
    res = await db.execute(select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id))
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", str(product_id))

    count_res = await db.execute(
        select(func.count(ProductImage.id)).where(ProductImage.product_id == product_id)
    )
    existing_count = count_res.scalar_one()

    make_primary = bool(is_primary or existing_count == 0)
    if make_primary:
        all_imgs_res = await db.execute(select(ProductImage).where(ProductImage.product_id == product_id))
        for other in all_imgs_res.scalars().all():
            other.is_primary = False

    filename = file_url.split("/")[-1].split("?")[0] or "image.jpg"
    img = ProductImage(
        tenant_id=tenant_id,
        product_id=product_id,
        file_url=file_url,
        file_name=filename,
        caption=caption,
        is_primary=make_primary,
        sort_order=existing_count,
        mime_type="image/jpeg",
    )
    db.add(img)
    await log_audit(db, tenant_id, user_id, "CREATE", "product_image", product.id, f"Added image URL {file_url}")
    await db.commit()
    await db.refresh(img)
    return ProductImageResponse.model_validate(img)


async def update_product_image(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    caption: Optional[str] = None,
    is_primary: Optional[bool] = None,
    sort_order: Optional[int] = None,
) -> ProductImageResponse:
    res = await db.execute(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            ProductImage.tenant_id == tenant_id,
        )
    )
    img = res.scalar_one_or_none()
    if not img:
        raise NotFoundException("ProductImage", str(image_id))

    if is_primary is True:
        # Reset all other images for this product
        all_imgs_res = await db.execute(
            select(ProductImage).where(ProductImage.product_id == product_id)
        )
        for other in all_imgs_res.scalars().all():
            other.is_primary = False
        img.is_primary = True

    if caption is not None:
        img.caption = caption
    if sort_order is not None:
        img.sort_order = sort_order

    await db.commit()
    await db.refresh(img)
    return ProductImageResponse.model_validate(img)


async def delete_product_image(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    image_id: uuid.UUID,
):
    res = await db.execute(
        select(ProductImage).where(
            ProductImage.id == image_id,
            ProductImage.product_id == product_id,
            ProductImage.tenant_id == tenant_id,
        )
    )
    img = res.scalar_one_or_none()
    if not img:
        raise NotFoundException("ProductImage", str(image_id))

    await delete_file(img.file_url)
    await db.delete(img)
    await db.flush()

    # If remaining images exist, ensure at least one is designated as primary
    rem_res = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id, ProductImage.tenant_id == tenant_id)
        .order_by(ProductImage.sort_order.asc(), ProductImage.created_at.asc())
    )
    remaining = rem_res.scalars().all()
    if remaining and (len(remaining) == 1 or not any(r.is_primary for r in remaining)):
        remaining[0].is_primary = True

    await log_audit(db, tenant_id, user_id, "DELETE", "product_image", image_id, "Deleted product image")
    await db.commit()


# ==================== PRODUCT VARIANTS ====================

async def add_product_variant(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    data: VariantIn,
) -> VariantResponse:
    res = await db.execute(select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id))
    product = res.scalar_one_or_none()
    if not product:
        raise NotFoundException("Product", str(product_id))

    dup_res = await db.execute(
        select(ProductVariant).where(ProductVariant.tenant_id == tenant_id, ProductVariant.sku == data.sku.strip())
    )
    if dup_res.scalar_one_or_none():
        raise ConflictException(f"SKU '{data.sku}' already exists")

    new_v = ProductVariant(
        tenant_id=tenant_id,
        product_id=product.id,
        sku=data.sku.strip(),
        variant_name=data.variant_name,
        barcode=data.barcode,
        barcode_type=data.barcode_type,
        unit_id=data.unit_id,
        purchase_price=data.purchase_price,
        selling_price=data.selling_price,
        mrp=data.mrp,
        reorder_point=data.reorder_point or Decimal("0"),
        reorder_quantity=data.reorder_quantity or Decimal("0"),
        weight_kg=data.weight_kg,
        is_active=data.is_active,
        created_by=user_id,
    )
    db.add(new_v)
    await db.flush()

    db.add(PriceHistory(
        tenant_id=tenant_id, variant_id=new_v.id, price_type="purchase",
        old_price=None, new_price=data.purchase_price, changed_by=user_id, reason="Added variant"
    ))
    db.add(PriceHistory(
        tenant_id=tenant_id, variant_id=new_v.id, price_type="selling",
        old_price=None, new_price=data.selling_price, changed_by=user_id, reason="Added variant"
    ))
    await log_audit(db, tenant_id, user_id, "CREATE", "product_variant", new_v.id, f"Added variant {new_v.sku}")
    await db.commit()
    await db.refresh(new_v)
    return VariantResponse.model_validate(new_v)


async def update_single_variant(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    data: VariantIn,
) -> VariantResponse:
    res = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
            ProductVariant.tenant_id == tenant_id,
        )
    )
    v = res.scalar_one_or_none()
    if not v:
        raise NotFoundException("ProductVariant", str(variant_id))

    if data.sku.strip() != v.sku:
        dup_res = await db.execute(
            select(ProductVariant).where(
                ProductVariant.tenant_id == tenant_id,
                ProductVariant.sku == data.sku.strip(),
                ProductVariant.id != variant_id,
            )
        )
        if dup_res.scalar_one_or_none():
            raise ConflictException(f"SKU '{data.sku}' already exists")

    if v.purchase_price != data.purchase_price:
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=v.id, price_type="purchase",
            old_price=v.purchase_price, new_price=data.purchase_price,
            changed_by=user_id, reason="Price update"
        ))
    if v.selling_price != data.selling_price:
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=v.id, price_type="selling",
            old_price=v.selling_price, new_price=data.selling_price,
            changed_by=user_id, reason="Price update"
        ))
    if v.mrp != data.mrp:
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=v.id, price_type="mrp",
            old_price=v.mrp, new_price=data.mrp or Decimal("0.00"),
            changed_by=user_id, reason="Price update"
        ))

    v.sku = data.sku.strip()
    v.variant_name = data.variant_name
    v.barcode = data.barcode
    v.barcode_type = data.barcode_type
    v.unit_id = data.unit_id
    v.purchase_price = data.purchase_price
    v.selling_price = data.selling_price
    v.mrp = data.mrp
    if data.reorder_point is not None:
        v.reorder_point = data.reorder_point
    if data.reorder_quantity is not None:
        v.reorder_quantity = data.reorder_quantity
    if data.weight_kg is not None:
        v.weight_kg = data.weight_kg
    v.is_active = data.is_active
    v.updated_by = user_id

    await log_audit(db, tenant_id, user_id, "UPDATE", "product_variant", v.id, f"Updated variant {v.sku}")
    await db.commit()
    await db.refresh(v)
    return VariantResponse.model_validate(v)


async def delete_single_variant(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
):
    res = await db.execute(
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
            ProductVariant.tenant_id == tenant_id,
        )
    )
    v = res.scalar_one_or_none()
    if not v:
        raise NotFoundException("ProductVariant", str(variant_id))

    count_res = await db.execute(
        select(func.count(ProductVariant.id)).where(
            ProductVariant.product_id == product_id,
            ProductVariant.tenant_id == tenant_id,
        )
    )
    if count_res.scalar_one() <= 1:
        raise ConflictException("A product must have at least one variant. Cannot delete the only variant.")

    from app.modules.stock.models import StockBalance
    stock_res = await db.execute(
        select(func.coalesce(func.sum(StockBalance.quantity), 0)).where(
            StockBalance.variant_id == variant_id,
            StockBalance.tenant_id == tenant_id,
        )
    )
    current_stock = stock_res.scalar_one()
    if current_stock > 0:
        raise ConflictException(f"Cannot delete variant with {current_stock} units in stock. Please transfer or adjust stock first, or mark variant as Inactive.")

    await db.execute(delete(PriceHistory).where(PriceHistory.variant_id == variant_id))
    await db.execute(delete(StockBalance).where(StockBalance.variant_id == variant_id))
    await db.delete(v)
    await log_audit(db, tenant_id, user_id, "DELETE", "product_variant", variant_id, f"Deleted variant {v.sku}")
    await db.commit()


# ==================== CSV IMPORT & EXPORT ====================

def parse_csv_content(csv_bytes: bytes) -> List[Dict[str, str]]:
    text = csv_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for r in reader:
        cleaned = {k.strip(): (v.strip() if v else "") for k, v in r.items() if k}
        rows.append(cleaned)
    return rows


async def preview_csv_import(
    db: AsyncSession, tenant_id: uuid.UUID, file: UploadFile
) -> CsvPreviewResponse:
    content = await file.read()
    rows = parse_csv_content(content)

    preview_rows: List[CsvRowPreview] = []
    seen_skus = set()

    for idx, r in enumerate(rows, start=1):
        errors = []
        name = r.get("name")
        sku = r.get("sku")

        if not name:
            errors.append("Missing required field: 'name'")
        if not sku:
            errors.append("Missing required field: 'sku'")
        elif sku in seen_skus:
            errors.append(f"Duplicate SKU in file: '{sku}'")
        else:
            seen_skus.add(sku)
            # Check DB uniqueness
            dup = await db.execute(
                select(ProductVariant).where(
                    ProductVariant.tenant_id == tenant_id,
                    ProductVariant.sku == sku,
                )
            )
            if dup.scalar_one_or_none():
                errors.append(f"SKU already exists in database: '{sku}'")

        # Validate numeric prices if present
        for price_field in ["purchase_price", "selling_price", "mrp"]:
            val = r.get(price_field)
            if val:
                try:
                    p = Decimal(val)
                    if p < 0:
                        errors.append(f"Field '{price_field}' must be >= 0")
                except Exception:
                    errors.append(f"Invalid decimal value for '{price_field}': '{val}'")

        status = "error" if errors else "valid"
        preview_rows.append(
            CsvRowPreview(row=idx, status=status, data=r, errors=errors)
        )

    valid_count = sum(1 for p in preview_rows if p.status == "valid")
    error_count = len(preview_rows) - valid_count

    return CsvPreviewResponse(
        total_rows=len(preview_rows),
        valid_rows=valid_count,
        error_rows=error_count,
        preview=preview_rows,
    )


async def commit_csv_import(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, file: UploadFile
) -> CsvImportResult:
    content = await file.read()
    rows = parse_csv_content(content)

    imported = 0
    skipped = 0
    errors = []
    seen_skus = set()

    # Preload master lookup caches
    cats_res = await db.execute(select(Category).where(Category.tenant_id == tenant_id))
    cats_by_name = {c.name.lower(): c.id for c in cats_res.scalars().all()}

    brands_res = await db.execute(select(Brand).where(Brand.tenant_id == tenant_id))
    brands_by_name = {b.name.lower(): b.id for b in brands_res.scalars().all()}

    units_res = await db.execute(select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant_id))
    units_by_code = {u.code.upper(): u.id for u in units_res.scalars().all()}

    # Preload existing products in tenant to avoid duplicate products by name
    prods_res = await db.execute(select(Product).where(Product.tenant_id == tenant_id, Product.is_active == True))
    prods_by_name = {p.name.lower(): p for p in prods_res.scalars().all()}

    for idx, r in enumerate(rows, start=1):
        name = r.get("name")
        sku = r.get("sku")

        row_errors = []
        if not name or not sku:
            row_errors.append("Missing name or sku")
        elif sku in seen_skus:
            row_errors.append(f"Duplicate SKU in file: {sku}")
        else:
            dup = await db.execute(
                select(ProductVariant).where(ProductVariant.tenant_id == tenant_id, ProductVariant.sku == sku)
            )
            if dup.scalar_one_or_none():
                row_errors.append(f"Duplicate SKU in database: {sku}")

        if row_errors:
            skipped += 1
            errors.append({"row": idx, "errors": row_errors})
            continue

        seen_skus.add(sku)

        # Parse foreign keys
        cat_id = cats_by_name.get(r.get("category", "").lower())
        brand_id = brands_by_name.get(r.get("brand", "").lower())
        unit_id = units_by_code.get(r.get("unit", "").upper())

        purchase_price = Decimal(r.get("purchase_price") or "0.00")
        selling_price = Decimal(r.get("selling_price") or "0.00")
        mrp = Decimal(r.get("mrp")) if r.get("mrp") else None

        product = prods_by_name.get(name.lower())
        if not product:
            product = Product(
                tenant_id=tenant_id,
                name=name,
                description=r.get("description"),
                category_id=cat_id,
                brand_id=brand_id,
                model=r.get("model"),
                created_by=user_id,
            )
            db.add(product)
            await db.flush()
            prods_by_name[name.lower()] = product
        else:
            if cat_id and not product.category_id:
                product.category_id = cat_id
            if brand_id and not product.brand_id:
                product.brand_id = brand_id
            if r.get("description") and not product.description:
                product.description = r.get("description")
            if r.get("model") and not product.model:
                product.model = r.get("model")

        variant = ProductVariant(
            tenant_id=tenant_id,
            product_id=product.id,
            sku=sku,
            variant_name=r.get("variant_name") or name,
            barcode=r.get("barcode"),
            unit_id=unit_id,
            purchase_price=purchase_price,
            selling_price=selling_price,
            mrp=mrp,
            created_by=user_id,
        )
        db.add(variant)
        await db.flush()

        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=variant.id, price_type="purchase",
            old_price=None, new_price=purchase_price, changed_by=user_id, reason="CSV import"
        ))
        db.add(PriceHistory(
            tenant_id=tenant_id, variant_id=variant.id, price_type="selling",
            old_price=None, new_price=selling_price, changed_by=user_id, reason="CSV import"
        ))
        if mrp:
            db.add(PriceHistory(
                tenant_id=tenant_id, variant_id=variant.id, price_type="mrp",
                old_price=None, new_price=mrp, changed_by=user_id, reason="CSV import"
            ))

        imported += 1

    await log_audit(
        db, tenant_id, user_id, "IMPORT", "products", None, f"Imported {imported} products, skipped {skipped}"
    )
    await db.commit()
    return CsvImportResult(imported=imported, skipped=skipped, errors=errors)


async def export_products_csv(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    category_id: Optional[uuid.UUID] = None,
    brand_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
) -> str:
    query = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.brand),
            selectinload(Product.variants).selectinload(ProductVariant.unit),
        )
        .where(Product.tenant_id == tenant_id)
    )
    if is_active is not None:
        query = query.where(Product.is_active == is_active)
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    if brand_id is not None:
        query = query.where(Product.brand_id == brand_id)

    res = await db.execute(query)
    products = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "name", "sku", "category", "brand", "model", "unit",
        "purchase_price", "selling_price", "mrp", "barcode", "is_active", "description"
    ])

    for p in products:
        cat_name = p.category.name if p.category else ""
        brand_name = p.brand.name if p.brand else ""
        if p.variants:
            for v in p.variants:
                unit_code = v.unit.code if v.unit else ""
                writer.writerow([
                    p.name,
                    v.sku,
                    cat_name,
                    brand_name,
                    p.model or "",
                    unit_code,
                    str(v.purchase_price),
                    str(v.selling_price),
                    str(v.mrp) if v.mrp is not None else "",
                    v.barcode or "",
                    "true" if v.is_active and p.is_active else "false",
                    p.description or "",
                ])
        else:
            writer.writerow([
                p.name, "", cat_name, brand_name, p.model or "", "",
                "0.00", "0.00", "", "", "true" if p.is_active else "false", p.description or ""
            ])

    return output.getvalue()
