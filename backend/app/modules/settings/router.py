import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role, get_tenant_id
from app.modules.auth.models import User
from app.modules.settings import service
from app.modules.settings.schemas import (
    CategoryCreate,
    CategoryUpdate,
    BrandCreate,
    BrandUpdate,
    BrandResponse,
    UnitCreate,
    UnitUpdate,
    LocationCreate,
    LocationUpdate,
    StockConditionCreate,
    StockConditionUpdate,
    TaxRateCreate,
    TaxRateUpdate,
    AttributeDefinitionCreate,
    AttributeDefinitionUpdate,
    ListOfValuesCreate,
    ListOfValuesUpdate,
    ListOfValuesResponse,
)

router = APIRouter(tags=["Master Data & Settings"])


# ---------------- Categories ----------------
@router.get("/categories")
async def list_categories(
    format: Optional[str] = Query(None, description="'tree' for nested structure"),
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    as_tree = format == "tree"
    categories = await service.get_categories(db, tenant_id, is_active=is_active, as_tree=as_tree)
    if as_tree:
        return {"data": [c.model_dump() for c in categories]}
    return {"data": categories}


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    cat = await service.create_category(db, user.current_tenant_id, user.id, data)
    return {
        "data": {
            "id": cat.id,
            "name": cat.name,
            "code": cat.code,
            "parent_id": cat.parent_id,
            "description": cat.description,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
        },
        "message": "Category created successfully",
    }


@router.get("/categories/{category_id}")
async def get_category(
    category_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    cat = await service.get_category(db, tenant_id, category_id)
    return {
        "data": {
            "id": cat.id,
            "name": cat.name,
            "code": cat.code,
            "parent_id": cat.parent_id,
            "description": cat.description,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
        }
    }


@router.put("/categories/{category_id}")
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    cat = await service.update_category(db, user.current_tenant_id, user.id, category_id, data)
    return {
        "data": {
            "id": cat.id,
            "name": cat.name,
            "code": cat.code,
            "parent_id": cat.parent_id,
            "description": cat.description,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
        },
        "message": "Category updated successfully",
    }


@router.delete("/categories/{category_id}")
async def archive_category(
    category_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_category(db, user.current_tenant_id, user.id, category_id)
    return {"message": "Category archived successfully"}


# ---------------- Brands ----------------
@router.get("/brands")
async def list_brands(
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    brands = await service.get_brands(db, tenant_id, is_active=is_active)
    return {"data": [b.model_dump() for b in brands]}


@router.post("/brands", status_code=status.HTTP_201_CREATED)
async def create_brand(
    data: BrandCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    brand = await service.create_brand(db, user.current_tenant_id, user.id, data)
    return {"data": BrandResponse.model_validate(brand, from_attributes=True), "message": "Brand created successfully"}


@router.get("/brands/{brand_id}")
async def get_brand(
    brand_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    brand = await service.get_brand(db, tenant_id, brand_id)
    return {"data": {"id": brand.id, "name": brand.name, "description": brand.description, "logo_url": brand.logo_url, "website": brand.website, "is_active": brand.is_active}}


@router.put("/brands/{brand_id}")
async def update_brand(
    brand_id: uuid.UUID,
    data: BrandUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.update_brand(db, user.current_tenant_id, user.id, brand_id, data)
    return {"data": result.model_dump(), "message": "Brand updated successfully"}


@router.delete("/brands/{brand_id}")
async def archive_brand(
    brand_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_brand(db, user.current_tenant_id, user.id, brand_id)
    return {"message": "Brand archived successfully"}


# ---------------- Units ----------------
@router.get("/units")
async def list_units(
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    units = await service.get_units(db, tenant_id, is_active=is_active)
    return {"data": [u.model_dump() for u in units]}


@router.post("/units", status_code=status.HTTP_201_CREATED)
async def create_unit(
    data: UnitCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    unit = await service.create_unit(db, user.current_tenant_id, user.id, data)
    return {"data": {"id": unit.id, "code": unit.code, "name": unit.name, "decimal_places": unit.decimal_places, "is_active": unit.is_active}, "message": "Unit created successfully"}


@router.get("/units/{unit_id}")
async def get_unit(
    unit_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    unit = await service.get_unit(db, tenant_id, unit_id)
    return {"data": {"id": unit.id, "code": unit.code, "name": unit.name, "decimal_places": unit.decimal_places, "is_active": unit.is_active}}


@router.put("/units/{unit_id}")
async def update_unit(
    unit_id: uuid.UUID,
    data: UnitUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.update_unit(db, user.current_tenant_id, user.id, unit_id, data)
    return {"data": result.model_dump(), "message": "Unit updated successfully"}


@router.delete("/units/{unit_id}")
async def archive_unit(
    unit_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_unit(db, user.current_tenant_id, user.id, unit_id)
    return {"message": "Unit archived successfully"}


# ---------------- Locations ----------------
@router.get("/locations")
async def list_locations(
    format: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    as_tree = format == "tree"
    locations = await service.get_locations(db, tenant_id, is_active=is_active, as_tree=as_tree)
    if as_tree:
        return {"data": [l.model_dump() for l in locations]}
    return {"data": locations}


@router.post("/locations", status_code=status.HTTP_201_CREATED)
async def create_location(
    data: LocationCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    loc = await service.create_location(db, user.current_tenant_id, user.id, data)
    return {
        "data": {
            "id": loc.id,
            "name": loc.name,
            "code": loc.code,
            "location_type": loc.location_type,
            "parent_id": loc.parent_id,
            "sort_order": loc.sort_order,
            "is_active": loc.is_active,
        },
        "message": "Location created successfully",
    }


@router.get("/locations/{location_id}")
async def get_location(
    location_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    loc = await service.get_location(db, tenant_id, location_id)
    return {
        "data": {
            "id": loc.id,
            "name": loc.name,
            "code": loc.code,
            "location_type": loc.location_type,
            "parent_id": loc.parent_id,
            "description": loc.description,
            "sort_order": loc.sort_order,
            "is_active": loc.is_active,
        }
    }


@router.put("/locations/{location_id}")
async def update_location(
    location_id: uuid.UUID,
    data: LocationUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    loc = await service.update_location(db, user.current_tenant_id, user.id, location_id, data)
    return {
        "data": {
            "id": loc.id,
            "name": loc.name,
            "code": loc.code,
            "location_type": loc.location_type,
            "parent_id": loc.parent_id,
            "is_active": loc.is_active,
        },
        "message": "Location updated successfully",
    }


@router.delete("/locations/{location_id}")
async def archive_location(
    location_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_location(db, user.current_tenant_id, user.id, location_id)
    return {"message": "Location archived successfully"}


# ---------------- Stock Conditions ----------------
@router.get("/stock-conditions")
async def list_stock_conditions(
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    conditions = await service.get_stock_conditions(db, tenant_id, is_active=is_active)
    return {"data": [c.model_dump() for c in conditions]}


@router.post("/stock-conditions", status_code=status.HTTP_201_CREATED)
async def create_stock_condition(
    data: StockConditionCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    cond = await service.create_stock_condition(db, user.current_tenant_id, user.id, data)
    return {"data": cond.model_dump(), "message": "Stock condition created successfully"}


@router.get("/stock-conditions/{condition_id}")
async def get_stock_condition(
    condition_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    cond = await service.get_stock_condition(db, tenant_id, condition_id)
    return {"data": StockConditionCreate.model_validate(cond, from_attributes=True)}


@router.put("/stock-conditions/{condition_id}")
async def update_stock_condition(
    condition_id: uuid.UUID,
    data: StockConditionUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    cond = await service.update_stock_condition(db, user.current_tenant_id, user.id, condition_id, data)
    return {"data": cond.model_dump(), "message": "Stock condition updated successfully"}


@router.delete("/stock-conditions/{condition_id}")
async def archive_stock_condition(
    condition_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_stock_condition(db, user.current_tenant_id, user.id, condition_id)
    return {"message": "Stock condition archived successfully"}


# ---------------- Tax Rates ----------------
@router.get("/tax-rates")
async def list_tax_rates(
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    rates = await service.get_tax_rates(db, tenant_id, is_active=is_active)
    return {"data": [r.model_dump() for r in rates]}


@router.post("/tax-rates", status_code=status.HTTP_201_CREATED)
async def create_tax_rate(
    data: TaxRateCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tr = await service.create_tax_rate(db, user.current_tenant_id, user.id, data)
    return {"data": tr.model_dump(), "message": "Tax rate created successfully"}


@router.get("/tax-rates/{rate_id}")
async def get_tax_rate(
    rate_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    tr = await service.get_tax_rate(db, tenant_id, rate_id)
    return {"data": {"id": tr.id, "name": tr.name, "rate": float(tr.rate), "hsn_code": tr.hsn_code, "sac_code": tr.sac_code, "is_active": tr.is_active}}


@router.put("/tax-rates/{rate_id}")
async def update_tax_rate(
    rate_id: uuid.UUID,
    data: TaxRateUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tr = await service.update_tax_rate(db, user.current_tenant_id, user.id, rate_id, data)
    return {"data": tr.model_dump(), "message": "Tax rate updated successfully"}


@router.delete("/tax-rates/{rate_id}")
async def archive_tax_rate(
    rate_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_tax_rate(db, user.current_tenant_id, user.id, rate_id)
    return {"message": "Tax rate archived successfully"}


# ---------------- Attribute Definitions ----------------
@router.get("/attributes")
async def list_attributes(
    category_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    attrs = await service.get_attributes(db, tenant_id, category_id=category_id, is_active=is_active)
    return {"data": [a.model_dump() for a in attrs]}


@router.post("/attributes", status_code=status.HTTP_201_CREATED)
async def create_attribute(
    data: AttributeDefinitionCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    attr = await service.create_attribute(db, user.current_tenant_id, user.id, data)
    return {"data": attr.model_dump(), "message": "Attribute created successfully"}


@router.get("/attributes/{attr_id}")
async def get_attribute(
    attr_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    attr = await service.get_attribute(db, tenant_id, attr_id)
    return {"data": AttributeDefinitionCreate.model_validate(attr, from_attributes=True)}


@router.put("/attributes/{attr_id}")
async def update_attribute(
    attr_id: uuid.UUID,
    data: AttributeDefinitionUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    attr = await service.update_attribute(db, user.current_tenant_id, user.id, attr_id, data)
    return {"data": attr.model_dump(), "message": "Attribute updated successfully"}


@router.delete("/attributes/{attr_id}")
async def archive_attribute(
    attr_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_attribute(db, user.current_tenant_id, user.id, attr_id)
    return {"message": "Attribute archived successfully"}


# ---------------- List of Values (LOV) ----------------
@router.get("/lov/summary")
async def get_lov_summary(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    summary = await service.get_lov_summary(db, tenant_id)
    return {"data": summary}


@router.get("/lov")
async def list_lov(
    category: Optional[str] = Query(None, description="Category code (e.g. color_finish, primary_material, unit, storage_included)"),
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    items = await service.get_lov_items(db, tenant_id, category=category, is_active=is_active)
    return {"data": [item.model_dump() for item in items]}


@router.post("/lov", status_code=status.HTTP_201_CREATED)
async def create_lov(
    data: ListOfValuesCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await service.create_lov_item(db, current_user.current_tenant_id, current_user.id, data)
    return {"data": item.model_dump(), "message": "List of value created successfully"}


@router.put("/lov/{item_id}")
async def update_lov(
    item_id: uuid.UUID,
    data: ListOfValuesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await service.update_lov_item(db, current_user.current_tenant_id, current_user.id, item_id, data)
    return {"data": item.model_dump(), "message": "List of value updated successfully"}


@router.delete("/lov/{item_id}")
async def archive_lov(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_lov_item(db, current_user.current_tenant_id, current_user.id, item_id)
    return {"message": "List of value archived successfully"}

