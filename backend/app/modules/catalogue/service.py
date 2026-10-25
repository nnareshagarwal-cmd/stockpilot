import csv
import io
import uuid
import re
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, delete
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
)
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

    # Build images response
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
                selling_price=first_v.selling_price if first_v else None,
                mrp=first_v.mrp if first_v else None,
                variant_count=len(p.variants),
                is_active=p.is_active,
                locations=sorted(list(loc_set)),
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

    # Check existing image count to set is_primary on first image
    count_res = await db.execute(
        select(func.count(ProductImage.id)).where(ProductImage.product_id == product_id)
    )
    existing_count = count_res.scalar_one()

    saved_images = []
    subdir = f"products/{tenant_id}/{product_id}"

    for i, file in enumerate(files):
        meta = await save_upload(file, subdir)
        is_primary = (existing_count == 0 and i == 0)
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
    await log_audit(db, tenant_id, user_id, "DELETE", "product_image", image_id, "Deleted product image")
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
