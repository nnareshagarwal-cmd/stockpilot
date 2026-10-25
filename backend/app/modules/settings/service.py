import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, case
from sqlalchemy.orm import selectinload

from app.common.exceptions import (
    NotFoundException,
    ConflictException,
    ValidationException,
)
from app.modules.settings.models import (
    Category,
    Brand,
    UnitOfMeasure,
    Location,
    StockCondition,
    TaxRate,
    AttributeDefinition,
    AttributeOption,
    ListOfValues,
)
from app.modules.settings.schemas import (
    CategoryCreate,
    CategoryUpdate,
    CategoryTreeItem,
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    UnitCreate,
    UnitUpdate,
    UnitResponse,
    LocationCreate,
    LocationUpdate,
    LocationTreeItem,
    StockConditionCreate,
    StockConditionUpdate,
    StockConditionResponse,
    TaxRateCreate,
    TaxRateUpdate,
    TaxRateResponse,
    AttributeDefinitionCreate,
    AttributeDefinitionUpdate,
    AttributeDefinitionResponse,
    AttributeOptionResponse,
    ListOfValuesCreate,
    ListOfValuesUpdate,
    ListOfValuesResponse,
)
from app.modules.audit.service import log_audit


# ==================== CATEGORIES ====================

async def create_category(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: CategoryCreate) -> Category:
    if data.parent_id:
        parent_res = await db.execute(
            select(Category).where(Category.id == data.parent_id, Category.tenant_id == tenant_id)
        )
        if not parent_res.scalar_one_or_none():
            raise NotFoundException("Parent category", str(data.parent_id))

    # Check unique constraint (tenant_id, name, parent_id)
    dup_res = await db.execute(
        select(Category).where(
            Category.tenant_id == tenant_id,
            Category.name == data.name,
            Category.parent_id == data.parent_id,
        )
    )
    if dup_res.scalar_one_or_none():
        raise ConflictException(f"Category '{data.name}' already exists under this parent")

    category = Category(
        tenant_id=tenant_id,
        created_by=user_id,
        **data.model_dump(),
    )
    db.add(category)
    await log_audit(
        db, tenant_id, user_id, "CREATE", "category", category.id, f"Created category {category.name}"
    )
    await db.commit()
    await db.refresh(category)
    return category


async def get_categories(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    is_active: Optional[bool] = None,
    as_tree: bool = False,
) -> List[Any]:
    query = select(Category).where(Category.tenant_id == tenant_id)
    if is_active is not None:
        query = query.where(Category.is_active == is_active)
    query = query.order_by(Category.sort_order, Category.name)

    result = await db.execute(query)
    categories = result.scalars().all()

    if not as_tree:
        return [
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "parent_id": c.parent_id,
                "description": c.description,
                "sort_order": c.sort_order,
                "is_active": c.is_active,
            }
            for c in categories
        ]

    # Build nested tree
    by_id: Dict[uuid.UUID, CategoryTreeItem] = {}
    for c in categories:
        by_id[c.id] = CategoryTreeItem(
            id=c.id,
            name=c.name,
            code=c.code,
            parent_id=c.parent_id,
            description=c.description,
            sort_order=c.sort_order,
            is_active=c.is_active,
            children=[],
        )

    roots: List[CategoryTreeItem] = []
    for item in by_id.values():
        if item.parent_id and item.parent_id in by_id:
            by_id[item.parent_id].children.append(item)
        else:
            roots.append(item)

    return roots


async def get_category(db: AsyncSession, tenant_id: uuid.UUID, category_id: uuid.UUID) -> Category:
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.tenant_id == tenant_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise NotFoundException("Category", str(category_id))
    return cat


async def update_category(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    data: CategoryUpdate,
) -> Category:
    cat = await get_category(db, tenant_id, category_id)

    if data.parent_id is not None:
        if data.parent_id == category_id:
            raise ValidationException("Category cannot be its own parent")
        parent_res = await db.execute(
            select(Category).where(Category.id == data.parent_id, Category.tenant_id == tenant_id)
        )
        if not parent_res.scalar_one_or_none():
            raise NotFoundException("Parent category", str(data.parent_id))

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(cat, key, value)
    cat.updated_by = user_id

    await log_audit(
        db, tenant_id, user_id, "UPDATE", "category", cat.id, f"Updated category {cat.name}"
    )
    await db.commit()
    await db.refresh(cat)
    return cat


async def archive_category(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, category_id: uuid.UUID
):
    cat = await get_category(db, tenant_id, category_id)
    cat.is_active = False
    cat.updated_by = user_id
    await log_audit(
        db, tenant_id, user_id, "ARCHIVE", "category", cat.id, f"Archived category {cat.name}"
    )
    await db.commit()


# ==================== BRANDS ====================

async def create_brand(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: BrandCreate) -> Brand:
    dup_res = await db.execute(
        select(Brand).where(Brand.tenant_id == tenant_id, Brand.name == data.name)
    )
    if dup_res.scalar_one_or_none():
        raise ConflictException(f"Brand '{data.name}' already exists")

    brand = Brand(tenant_id=tenant_id, **data.model_dump())
    db.add(brand)
    await log_audit(db, tenant_id, user_id, "CREATE", "brand", brand.id, f"Created brand {brand.name}")
    await db.commit()
    await db.refresh(brand)
    return brand


async def get_brands(db: AsyncSession, tenant_id: uuid.UUID, is_active: Optional[bool] = None) -> List[BrandResponse]:
    query = select(Brand).where(Brand.tenant_id == tenant_id)
    if is_active is not None:
        query = query.where(Brand.is_active == is_active)
    query = query.order_by(Brand.name)
    result = await db.execute(query)
    return [BrandResponse.model_validate(b) for b in result.scalars().all()]


async def get_brand(db: AsyncSession, tenant_id: uuid.UUID, brand_id: uuid.UUID) -> Brand:
    res = await db.execute(select(Brand).where(Brand.id == brand_id, Brand.tenant_id == tenant_id))
    b = res.scalar_one_or_none()
    if not b:
        raise NotFoundException("Brand", str(brand_id))
    return b


async def update_brand(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, brand_id: uuid.UUID, data: BrandUpdate
) -> BrandResponse:
    brand = await get_brand(db, tenant_id, brand_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(brand, k, v)
    await log_audit(db, tenant_id, user_id, "UPDATE", "brand", brand.id, f"Updated brand {brand.name}")
    await db.commit()
    await db.refresh(brand)
    return BrandResponse.model_validate(brand)


async def archive_brand(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, brand_id: uuid.UUID):
    brand = await get_brand(db, tenant_id, brand_id)
    brand.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "brand", brand.id, f"Archived brand {brand.name}")
    await db.commit()


# ==================== UNITS OF MEASURE ====================

async def create_unit(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: UnitCreate) -> UnitOfMeasure:
    dup_res = await db.execute(
        select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant_id, UnitOfMeasure.code == data.code.upper())
    )
    if dup_res.scalar_one_or_none():
        raise ConflictException(f"Unit code '{data.code}' already exists")

    unit = UnitOfMeasure(tenant_id=tenant_id, code=data.code.upper(), name=data.name, decimal_places=data.decimal_places)
    db.add(unit)
    await log_audit(db, tenant_id, user_id, "CREATE", "unit", unit.id, f"Created unit {unit.code}")
    await db.commit()
    await db.refresh(unit)
    return unit


async def get_units(db: AsyncSession, tenant_id: uuid.UUID, is_active: Optional[bool] = None) -> List[UnitResponse]:
    query = select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant_id)
    if is_active is not None:
        query = query.where(UnitOfMeasure.is_active == is_active)
    query = query.order_by(UnitOfMeasure.code)
    result = await db.execute(query)
    return [UnitResponse.model_validate(u) for u in result.scalars().all()]


async def get_unit(db: AsyncSession, tenant_id: uuid.UUID, unit_id: uuid.UUID) -> UnitOfMeasure:
    res = await db.execute(select(UnitOfMeasure).where(UnitOfMeasure.id == unit_id, UnitOfMeasure.tenant_id == tenant_id))
    u = res.scalar_one_or_none()
    if not u:
        raise NotFoundException("Unit", str(unit_id))
    return u


async def update_unit(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, unit_id: uuid.UUID, data: UnitUpdate
) -> UnitResponse:
    unit = await get_unit(db, tenant_id, unit_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "code" and v:
            setattr(unit, k, v.upper())
        else:
            setattr(unit, k, v)
    await log_audit(db, tenant_id, user_id, "UPDATE", "unit", unit.id, f"Updated unit {unit.code}")
    await db.commit()
    await db.refresh(unit)
    return UnitResponse.model_validate(unit)


async def archive_unit(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, unit_id: uuid.UUID):
    unit = await get_unit(db, tenant_id, unit_id)
    unit.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "unit", unit.id, f"Archived unit {unit.code}")
    await db.commit()


# ==================== LOCATIONS ====================

async def create_location(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: LocationCreate) -> Location:
    if data.parent_id:
        parent_res = await db.execute(
            select(Location).where(Location.id == data.parent_id, Location.tenant_id == tenant_id)
        )
        if not parent_res.scalar_one_or_none():
            raise NotFoundException("Parent location", str(data.parent_id))

    if data.code:
        dup_res = await db.execute(
            select(Location).where(Location.tenant_id == tenant_id, Location.code == data.code)
        )
        if dup_res.scalar_one_or_none():
            raise ConflictException(f"Location code '{data.code}' already exists")

    loc = Location(tenant_id=tenant_id, **data.model_dump())
    db.add(loc)
    await log_audit(db, tenant_id, user_id, "CREATE", "location", loc.id, f"Created location {loc.name}")
    await db.commit()
    await db.refresh(loc)
    return loc


async def get_locations(
    db: AsyncSession, tenant_id: uuid.UUID, is_active: Optional[bool] = None, as_tree: bool = False
) -> List[Any]:
    query = select(Location).where(Location.tenant_id == tenant_id)
    if is_active is not None:
        query = query.where(Location.is_active == is_active)
    query = query.order_by(Location.sort_order, Location.name)

    result = await db.execute(query)
    locations = result.scalars().all()

    if not as_tree:
        return [
            {
                "id": l.id,
                "name": l.name,
                "code": l.code,
                "location_type": l.location_type,
                "parent_id": l.parent_id,
                "description": l.description,
                "sort_order": l.sort_order,
                "is_active": l.is_active,
            }
            for l in locations
        ]

    by_id: Dict[uuid.UUID, LocationTreeItem] = {}
    for l in locations:
        by_id[l.id] = LocationTreeItem(
            id=l.id,
            name=l.name,
            code=l.code,
            location_type=l.location_type,
            parent_id=l.parent_id,
            description=l.description,
            sort_order=l.sort_order,
            is_active=l.is_active,
            children=[],
        )

    roots: List[LocationTreeItem] = []
    for item in by_id.values():
        if item.parent_id and item.parent_id in by_id:
            by_id[item.parent_id].children.append(item)
        else:
            roots.append(item)

    return roots


async def get_location(db: AsyncSession, tenant_id: uuid.UUID, location_id: uuid.UUID) -> Location:
    res = await db.execute(select(Location).where(Location.id == location_id, Location.tenant_id == tenant_id))
    l = res.scalar_one_or_none()
    if not l:
        raise NotFoundException("Location", str(location_id))
    return l


async def update_location(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, location_id: uuid.UUID, data: LocationUpdate
) -> Location:
    loc = await get_location(db, tenant_id, location_id)
    if data.parent_id is not None:
        if data.parent_id == location_id:
            raise ValidationException("Location cannot be its own parent")
        parent_res = await db.execute(
            select(Location).where(Location.id == data.parent_id, Location.tenant_id == tenant_id)
        )
        if not parent_res.scalar_one_or_none():
            raise NotFoundException("Parent location", str(data.parent_id))

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(loc, k, v)
    await log_audit(db, tenant_id, user_id, "UPDATE", "location", loc.id, f"Updated location {loc.name}")
    await db.commit()
    await db.refresh(loc)
    return loc


async def archive_location(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, location_id: uuid.UUID):
    loc = await get_location(db, tenant_id, location_id)
    loc.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "location", loc.id, f"Archived location {loc.name}")
    await db.commit()


# ==================== STOCK CONDITIONS ====================

async def create_stock_condition(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: StockConditionCreate
) -> StockConditionResponse:
    dup = await db.execute(
        select(StockCondition).where(StockCondition.tenant_id == tenant_id, StockCondition.code == data.code)
    )
    if dup.scalar_one_or_none():
        raise ConflictException(f"Stock condition code '{data.code}' already exists")

    sc = StockCondition(tenant_id=tenant_id, **data.model_dump())
    db.add(sc)
    await log_audit(db, tenant_id, user_id, "CREATE", "stock_condition", sc.id, f"Created condition {sc.name}")
    await db.commit()
    await db.refresh(sc)
    return StockConditionResponse.model_validate(sc)


async def get_stock_conditions(
    db: AsyncSession, tenant_id: uuid.UUID, is_active: Optional[bool] = None
) -> List[StockConditionResponse]:
    query = select(StockCondition).where(StockCondition.tenant_id == tenant_id)
    if is_active is not None:
        query = query.where(StockCondition.is_active == is_active)
    query = query.order_by(StockCondition.sort_order, StockCondition.name)
    res = await db.execute(query)
    return [StockConditionResponse.model_validate(s) for s in res.scalars().all()]


async def get_stock_condition(db: AsyncSession, tenant_id: uuid.UUID, condition_id: uuid.UUID) -> StockCondition:
    res = await db.execute(select(StockCondition).where(StockCondition.id == condition_id, StockCondition.tenant_id == tenant_id))
    s = res.scalar_one_or_none()
    if not s:
        raise NotFoundException("StockCondition", str(condition_id))
    return s


async def update_stock_condition(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, condition_id: uuid.UUID, data: StockConditionUpdate
) -> StockConditionResponse:
    sc = await get_stock_condition(db, tenant_id, condition_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(sc, k, v)
    await log_audit(db, tenant_id, user_id, "UPDATE", "stock_condition", sc.id, f"Updated condition {sc.name}")
    await db.commit()
    await db.refresh(sc)
    return StockConditionResponse.model_validate(sc)


async def archive_stock_condition(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, condition_id: uuid.UUID):
    sc = await get_stock_condition(db, tenant_id, condition_id)
    sc.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "stock_condition", sc.id, f"Archived condition {sc.name}")
    await db.commit()


# ==================== TAX RATES ====================

async def create_tax_rate(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: TaxRateCreate
) -> TaxRateResponse:
    dup = await db.execute(select(TaxRate).where(TaxRate.tenant_id == tenant_id, TaxRate.name == data.name))
    if dup.scalar_one_or_none():
        raise ConflictException(f"Tax rate '{data.name}' already exists")

    tr = TaxRate(tenant_id=tenant_id, **data.model_dump())
    db.add(tr)
    await log_audit(db, tenant_id, user_id, "CREATE", "tax_rate", tr.id, f"Created tax rate {tr.name}")
    await db.commit()
    await db.refresh(tr)
    return TaxRateResponse.model_validate(tr)


async def get_tax_rates(
    db: AsyncSession, tenant_id: uuid.UUID, is_active: Optional[bool] = None
) -> List[TaxRateResponse]:
    query = select(TaxRate).where(TaxRate.tenant_id == tenant_id)
    if is_active is not None:
        query = query.where(TaxRate.is_active == is_active)
    query = query.order_by(TaxRate.rate)
    res = await db.execute(query)
    return [TaxRateResponse.model_validate(t) for t in res.scalars().all()]


async def get_tax_rate(db: AsyncSession, tenant_id: uuid.UUID, rate_id: uuid.UUID) -> TaxRate:
    res = await db.execute(select(TaxRate).where(TaxRate.id == rate_id, TaxRate.tenant_id == tenant_id))
    t = res.scalar_one_or_none()
    if not t:
        raise NotFoundException("TaxRate", str(rate_id))
    return t


async def update_tax_rate(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, rate_id: uuid.UUID, data: TaxRateUpdate
) -> TaxRateResponse:
    tr = await get_tax_rate(db, tenant_id, rate_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tr, k, v)
    await log_audit(db, tenant_id, user_id, "UPDATE", "tax_rate", tr.id, f"Updated tax rate {tr.name}")
    await db.commit()
    await db.refresh(tr)
    return TaxRateResponse.model_validate(tr)


async def archive_tax_rate(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, rate_id: uuid.UUID):
    tr = await get_tax_rate(db, tenant_id, rate_id)
    tr.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "tax_rate", tr.id, f"Archived tax rate {tr.name}")
    await db.commit()


# ==================== ATTRIBUTE DEFINITIONS ====================

async def create_attribute(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data: AttributeDefinitionCreate
) -> AttributeDefinitionResponse:
    if data.category_id:
        cat_res = await db.execute(
            select(Category).where(Category.id == data.category_id, Category.tenant_id == tenant_id)
        )
        if not cat_res.scalar_one_or_none():
            raise NotFoundException("Category", str(data.category_id))

    dup = await db.execute(
        select(AttributeDefinition).where(AttributeDefinition.tenant_id == tenant_id, AttributeDefinition.code == data.code)
    )
    if dup.scalar_one_or_none():
        raise ConflictException(f"Attribute code '{data.code}' already exists")

    attr = AttributeDefinition(
        tenant_id=tenant_id,
        name=data.name,
        code=data.code,
        data_type=data.data_type,
        category_id=data.category_id,
        is_required=data.is_required,
        is_searchable=data.is_searchable,
        is_filterable=data.is_filterable,
        unit_label=data.unit_label,
        description=data.description,
        sort_order=data.sort_order,
    )
    db.add(attr)
    await db.flush()

    if data.options:
        for opt in data.options:
            db.add(AttributeOption(attribute_id=attr.id, value=opt.value, sort_order=opt.sort_order))

    await log_audit(db, tenant_id, user_id, "CREATE", "attribute", attr.id, f"Created attribute {attr.name}")
    await db.commit()

    # Reload with options
    reloaded = await get_attribute(db, tenant_id, attr.id)
    return AttributeDefinitionResponse.model_validate(reloaded)


async def get_attributes(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    category_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
) -> List[AttributeDefinitionResponse]:
    query = (
        select(AttributeDefinition)
        .options(selectinload(AttributeDefinition.options))
        .where(AttributeDefinition.tenant_id == tenant_id)
    )

    if category_id is not None:
        # Include category-specific AND global attributes (where category_id is NULL)
        query = query.where(
            (AttributeDefinition.category_id == category_id) | (AttributeDefinition.category_id.is_(None))
        )
    if is_active is not None:
        query = query.where(AttributeDefinition.is_active == is_active)

    query = query.order_by(AttributeDefinition.sort_order, AttributeDefinition.name)
    result = await db.execute(query)
    return [AttributeDefinitionResponse.model_validate(a) for a in result.scalars().all()]


async def get_attribute(db: AsyncSession, tenant_id: uuid.UUID, attr_id: uuid.UUID) -> AttributeDefinition:
    res = await db.execute(
        select(AttributeDefinition)
        .options(selectinload(AttributeDefinition.options))
        .where(AttributeDefinition.id == attr_id, AttributeDefinition.tenant_id == tenant_id)
    )
    attr = res.scalar_one_or_none()
    if not attr:
        raise NotFoundException("AttributeDefinition", str(attr_id))
    return attr


async def update_attribute(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    attr_id: uuid.UUID,
    data: AttributeDefinitionUpdate,
) -> AttributeDefinitionResponse:
    attr = await get_attribute(db, tenant_id, attr_id)

    if data.category_id is not None:
        cat_res = await db.execute(
            select(Category).where(Category.id == data.category_id, Category.tenant_id == tenant_id)
        )
        if not cat_res.scalar_one_or_none():
            raise NotFoundException("Category", str(data.category_id))

    update_dict = data.model_dump(exclude_unset=True, exclude={"options"})
    for k, v in update_dict.items():
        setattr(attr, k, v)

    if data.options is not None:
        # Replace options
        for existing_opt in list(attr.options):
            await db.delete(existing_opt)
        for opt in data.options:
            db.add(AttributeOption(attribute_id=attr.id, value=opt.value, sort_order=opt.sort_order))

    await log_audit(db, tenant_id, user_id, "UPDATE", "attribute", attr.id, f"Updated attribute {attr.name}")
    await db.commit()
    reloaded = await get_attribute(db, tenant_id, attr.id)
    return AttributeDefinitionResponse.model_validate(reloaded)


async def archive_attribute(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, attr_id: uuid.UUID):
    attr = await get_attribute(db, tenant_id, attr_id)
    attr.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "attribute", attr.id, f"Archived attribute {attr.name}")
    await db.commit()


# ==================== LIST OF VALUES (LOV) ====================

CATEGORY_TO_ATTR_CODE = {
    "color_finish": "color_finish",
    "primary_material": "prim_material",
    "prim_material": "prim_material",
    "storage_included": "storage_type",
    "storage_type": "storage_type",
}

async def get_lov_items(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
) -> List[ListOfValuesResponse]:
    query = select(ListOfValues).where(ListOfValues.tenant_id == tenant_id)
    if category:
        # Check alias if needed
        cats = [category.lower()]
        if category.lower() in ("primary_material", "prim_material"):
            cats = ["primary_material", "prim_material"]
        elif category.lower() in ("storage_included", "storage_type"):
            cats = ["storage_included", "storage_type"]
        query = query.where(ListOfValues.category.in_(cats))
    if is_active is not None:
        query = query.where(ListOfValues.is_active == is_active)
    query = query.order_by(ListOfValues.category, ListOfValues.sort_order, ListOfValues.label)
    result = await db.execute(query)
    items = result.scalars().all()

    # Match option_ids for attribute-linked categories
    responses = []
    for item in items:
        resp = ListOfValuesResponse.model_validate(item)
        attr_code = CATEGORY_TO_ATTR_CODE.get(item.category.lower())
        if attr_code:
            # find corresponding attribute option
            opt_res = await db.execute(
                select(AttributeOption)
                .join(AttributeDefinition, AttributeDefinition.id == AttributeOption.attribute_id)
                .where(
                    AttributeDefinition.tenant_id == tenant_id,
                    AttributeDefinition.code == attr_code,
                    AttributeOption.value.ilike(item.value),
                )
            )
            opt = opt_res.scalar_one_or_none()
            if opt:
                resp.option_id = opt.id
        responses.append(resp)
    return responses


async def create_lov_item(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ListOfValuesCreate,
) -> ListOfValuesResponse:
    val = (data.value or data.label).strip()
    lbl = data.label.strip()
    cat = data.category.strip().lower()

    # Check for duplicate in LOV
    dup_res = await db.execute(
        select(ListOfValues).where(
            ListOfValues.tenant_id == tenant_id,
            ListOfValues.category == cat,
            ListOfValues.value.ilike(val),
        )
    )
    existing = dup_res.scalar_one_or_none()
    item = None
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.label = lbl
            await db.commit()
            item = existing
        else:
            item = existing
    else:
        item = ListOfValues(
            tenant_id=tenant_id,
            category=cat,
            label=lbl,
            value=val,
            sort_order=data.sort_order,
            description=data.description,
            is_active=True,
            is_system=False,
        )
        db.add(item)
        await log_audit(db, tenant_id, user_id, "CREATE", "lov", item.id, f"Created LOV item {lbl} under {cat}")
        await db.commit()
        await db.refresh(item)

    resp = ListOfValuesResponse.model_validate(item)

    # If linked to an attribute definition, also ensure AttributeOption exists!
    attr_code = CATEGORY_TO_ATTR_CODE.get(cat)
    if attr_code:
        attr_res = await db.execute(
            select(AttributeDefinition).where(
                AttributeDefinition.tenant_id == tenant_id,
                AttributeDefinition.code == attr_code,
            )
        )
        attr = attr_res.scalar_one_or_none()
        if attr:
            opt_res = await db.execute(
                select(AttributeOption).where(
                    AttributeOption.attribute_id == attr.id,
                    AttributeOption.value.ilike(val),
                )
            )
            opt = opt_res.scalar_one_or_none()
            if not opt:
                new_opt = AttributeOption(
                    attribute_id=attr.id,
                    value=lbl,
                    sort_order=data.sort_order,
                    is_active=True,
                )
                db.add(new_opt)
                await db.commit()
                await db.refresh(new_opt)
                resp.option_id = new_opt.id
            else:
                resp.option_id = opt.id

    if cat in ("unit", "unit_of_measure"):
        u_code = val.upper()
        u_name = lbl
        if "(" in lbl and ")" in lbl:
            parts = lbl.split("(")
            u_name = parts[0].strip()
            u_code = parts[1].replace(")", "").strip().upper()
        unit_res = await db.execute(
            select(UnitOfMeasure).where(
                UnitOfMeasure.tenant_id == tenant_id,
                UnitOfMeasure.code == u_code,
            )
        )
        existing_unit = unit_res.scalar_one_or_none()
        if not existing_unit:
            new_unit = UnitOfMeasure(
                tenant_id=tenant_id,
                code=u_code,
                name=u_name,
                decimal_places=0,
                is_active=True,
            )
            db.add(new_unit)
            await db.commit()

    if cat == "tax_rate":
        import re
        rate_match = re.search(r"(\d+(\.\d+)?)", val or lbl)
        rate_val = Decimal(rate_match.group(1)) if rate_match else Decimal("0.00")
        tax_res = await db.execute(
            select(TaxRate).where(
                TaxRate.tenant_id == tenant_id,
                TaxRate.name == lbl,
            )
        )
        existing_tax = tax_res.scalar_one_or_none()
        if not existing_tax:
            new_tax = TaxRate(
                tenant_id=tenant_id,
                name=lbl,
                rate=rate_val,
                description=data.description or f"GST rate {rate_val}%",
                is_active=True,
            )
            db.add(new_tax)
            await db.commit()

    if cat == "stock_condition":
        cond_res = await db.execute(
            select(StockCondition).where(
                StockCondition.tenant_id == tenant_id,
                StockCondition.name == lbl,
            )
        )
        existing_cond = cond_res.scalar_one_or_none()
        if not existing_cond:
            new_cond = StockCondition(
                tenant_id=tenant_id,
                name=lbl,
                code=val.lower().replace(" ", "_"),
                is_sellable=not ("damaged" in lbl.lower() or "written off" in lbl.lower() or "inspection" in lbl.lower()),
                sort_order=data.sort_order,
                description=data.description,
                is_active=True,
            )
            db.add(new_cond)
            await db.commit()

    return resp


async def update_lov_item(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ListOfValuesUpdate,
) -> ListOfValuesResponse:
    query = select(ListOfValues).where(
        ListOfValues.id == item_id,
        ListOfValues.tenant_id == tenant_id,
    )
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("ListOfValues", str(item_id))

    old_val = item.value
    if data.label is not None:
        item.label = data.label.strip()
    if data.value is not None:
        item.value = data.value.strip()
    if data.sort_order is not None:
        item.sort_order = data.sort_order
    if data.is_active is not None:
        item.is_active = data.is_active
    if data.description is not None:
        item.description = data.description

    await log_audit(db, tenant_id, user_id, "UPDATE", "lov", item.id, f"Updated LOV item {item.label}")
    await db.commit()
    await db.refresh(item)

    # Sync with AttributeOption if linked
    attr_code = CATEGORY_TO_ATTR_CODE.get(item.category.lower())
    if attr_code:
        attr_res = await db.execute(
            select(AttributeDefinition).where(
                AttributeDefinition.tenant_id == tenant_id,
                AttributeDefinition.code == attr_code,
            )
        )
        attr = attr_res.scalar_one_or_none()
        if attr:
            opt_res = await db.execute(
                select(AttributeOption).where(
                    AttributeOption.attribute_id == attr.id,
                    AttributeOption.value.ilike(old_val),
                )
            )
            opt = opt_res.scalar_one_or_none()
            if opt:
                if data.label is not None:
                    opt.value = item.label
                if data.sort_order is not None:
                    opt.sort_order = item.sort_order
                if data.is_active is not None:
                    opt.is_active = item.is_active
                await db.commit()

    # Sync with UnitOfMeasure if category is unit
    cat_lower = item.category.lower()
    if cat_lower == "unit":
        u_code = item.value
        if "(" in item.value and ")" in item.value:
            u_code = item.value.split("(")[1].replace(")", "").strip().upper()
        unit_res = await db.execute(
            select(UnitOfMeasure).where(
                UnitOfMeasure.tenant_id == tenant_id,
                or_(
                    UnitOfMeasure.code.ilike(u_code),
                    UnitOfMeasure.name.ilike(item.label),
                    UnitOfMeasure.name.ilike(old_val),
                ),
            )
        )
        u_record = unit_res.scalar_one_or_none()
        if u_record:
            if data.label is not None:
                u_record.name = item.label.split("(")[0].strip()
            if data.is_active is not None:
                u_record.is_active = item.is_active
            await db.commit()

    # Sync with TaxRate if category is tax_rate
    if cat_lower == "tax_rate":
        tax_res = await db.execute(
            select(TaxRate).where(
                TaxRate.tenant_id == tenant_id,
                or_(TaxRate.name == old_val, TaxRate.name == item.label),
            )
        )
        tax_record = tax_res.scalar_one_or_none()
        if tax_record:
            if data.label is not None:
                tax_record.name = item.label
            if data.is_active is not None:
                tax_record.is_active = item.is_active
            await db.commit()

    # Sync with StockCondition if category is stock_condition
    if cat_lower == "stock_condition":
        cond_res = await db.execute(
            select(StockCondition).where(
                StockCondition.tenant_id == tenant_id,
                or_(StockCondition.name == old_val, StockCondition.name == item.label),
            )
        )
        cond_record = cond_res.scalar_one_or_none()
        if cond_record:
            if data.label is not None:
                cond_record.name = item.label
            if data.is_active is not None:
                cond_record.is_active = item.is_active
            await db.commit()

    return ListOfValuesResponse.model_validate(item)


async def archive_lov_item(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
) -> None:
    query = select(ListOfValues).where(
        ListOfValues.id == item_id,
        ListOfValues.tenant_id == tenant_id,
    )
    result = await db.execute(query)
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("ListOfValues", str(item_id))

    item.is_active = False
    await log_audit(db, tenant_id, user_id, "ARCHIVE", "lov", item.id, f"Archived LOV item {item.label}")
    await db.commit()

    # Also deactivate corresponding AttributeOption if exists
    attr_code = CATEGORY_TO_ATTR_CODE.get(item.category.lower())
    if attr_code:
        attr_res = await db.execute(
            select(AttributeDefinition).where(
                AttributeDefinition.tenant_id == tenant_id,
                AttributeDefinition.code == attr_code,
            )
        )
        attr = attr_res.scalar_one_or_none()
        if attr:
            opt_res = await db.execute(
                select(AttributeOption).where(
                    AttributeOption.attribute_id == attr.id,
                    AttributeOption.value.ilike(item.value),
                )
            )
            opt = opt_res.scalar_one_or_none()
            if opt:
                opt.is_active = False
                await db.commit()

    # Also deactivate corresponding UnitOfMeasure if exists
    cat_lower = item.category.lower()
    if cat_lower == "unit":
        u_code = item.value
        if "(" in item.value and ")" in item.value:
            u_code = item.value.split("(")[1].replace(")", "").strip().upper()
        unit_res = await db.execute(
            select(UnitOfMeasure).where(
                UnitOfMeasure.tenant_id == tenant_id,
                or_(
                    UnitOfMeasure.code.ilike(u_code),
                    UnitOfMeasure.name.ilike(item.label),
                ),
            )
        )
        u_record = unit_res.scalar_one_or_none()
        if u_record:
            u_record.is_active = False
            await db.commit()


async def get_lov_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> List[dict]:
    query = (
        select(
            ListOfValues.category,
            func.count(ListOfValues.id).label("total_count"),
            func.count(case((ListOfValues.is_active == True, 1))).label("active_count"),
        )
        .where(ListOfValues.tenant_id == tenant_id)
        .group_by(ListOfValues.category)
        .order_by(ListOfValues.category)
    )
    result = await db.execute(query)
    return [
        {
            "category": row.category,
            "total_count": int(row.total_count),
            "active_count": int(row.active_count),
        }
        for row in result.all()
    ]

