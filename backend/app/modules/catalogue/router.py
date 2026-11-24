import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, UploadFile, File, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role, get_tenant_id
from app.modules.auth.models import User
from app.modules.catalogue.schemas import (
    ProductCreate,
    ProductUpdate,
    ImageUpdate,
    ImageUrlCreate,
    VariantIn,
)
from app.modules.catalogue import service

router = APIRouter(prefix="/products", tags=["Products & Catalogue"])


@router.get("")
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: Optional[uuid.UUID] = Query(None),
    subcategory_id: Optional[uuid.UUID] = Query(None),
    brand_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = Query(True),
    in_stock: Optional[bool] = Query(None),
    low_stock: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    items, pagination = await service.search_products(
        db=db,
        tenant_id=tenant_id,
        q=search,
        category_id=category_id,
        subcategory_id=subcategory_id,
        brand_id=brand_id,
        is_active=is_active,
        in_stock=in_stock,
        low_stock=low_stock,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "data": [item.model_dump() for item in items],
        "pagination": pagination.model_dump(),
    }


@router.get("/search")
async def search_products(
    q: Optional[str] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    subcategory_id: Optional[uuid.UUID] = Query(None),
    brand_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = Query(True),
    in_stock: Optional[bool] = Query(None),
    low_stock: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    items, pagination = await service.search_products(
        db=db,
        tenant_id=tenant_id,
        q=q,
        category_id=category_id,
        subcategory_id=subcategory_id,
        brand_id=brand_id,
        is_active=is_active,
        in_stock=in_stock,
        low_stock=low_stock,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "data": [item.model_dump() for item in items],
        "pagination": pagination.model_dump(),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    product = await service.create_product(db, user.current_tenant_id, user.id, data)
    return {"data": product.model_dump(), "message": "Product created successfully"}


@router.get("/export")
async def export_products(
    category_id: Optional[uuid.UUID] = Query(None),
    brand_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    csv_text = await service.export_products_csv(
        db=db,
        tenant_id=tenant_id,
        category_id=category_id,
        brand_id=brand_id,
        is_active=is_active,
    )
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"},
    )


@router.get("/next-sku")
async def get_next_sku_endpoint(
    prefix: str = Query(..., description="SKU prefix to check e.g. CRY-OFF"),
    count: int = Query(1, ge=1, le=50, description="Number of sequential SKUs needed"),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await service.get_next_sku(
        db=db,
        tenant_id=tenant_id,
        prefix=prefix,
        count=count,
    )
    return {"data": result}


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    preview = await service.preview_csv_import(db, user.current_tenant_id, file)
    return {"data": preview.model_dump()}


@router.post("/import")
async def commit_import(
    file: UploadFile = File(...),
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.commit_csv_import(db, user.current_tenant_id, user.id, file)
    return {"data": result.model_dump(), "message": "Import finished"}


@router.get("/{product_id}")
async def get_product(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = await service.get_product_detail(db, tenant_id, product_id)
    return {"data": product.model_dump()}


@router.put("/{product_id}")
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    product = await service.update_product(db, user.current_tenant_id, user.id, product_id, data)
    return {"data": product.model_dump(), "message": "Product updated successfully"}


@router.delete("/{product_id}")
async def archive_product(
    product_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.archive_product(db, user.current_tenant_id, user.id, product_id)
    return {"message": "Product archived successfully"}


@router.post("/{product_id}/copy", status_code=status.HTTP_201_CREATED)
async def copy_product(
    product_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    product = await service.copy_product(
        db=db,
        tenant_id=user.current_tenant_id,
        user_id=user.id,
        product_id=product_id,
    )
    return {"data": product.model_dump(), "message": "Product copied successfully"}


# ==================== PRODUCT VARIANTS ====================

@router.post("/{product_id}/variants", status_code=status.HTTP_201_CREATED)
async def create_variant(
    product_id: uuid.UUID,
    data: VariantIn,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    v = await service.add_product_variant(db, user.current_tenant_id, user.id, product_id, data)
    return {"data": v.model_dump(), "message": "Variant created successfully"}


@router.put("/{product_id}/variants/{variant_id}")
async def update_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    data: VariantIn,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    v = await service.update_single_variant(db, user.current_tenant_id, user.id, product_id, variant_id, data)
    return {"data": v.model_dump(), "message": "Variant updated successfully"}


@router.delete("/{product_id}/variants/{variant_id}")
async def delete_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_single_variant(db, user.current_tenant_id, user.id, product_id, variant_id)
    return {"message": "Variant deleted successfully"}


@router.post("/{product_id}/images")
async def upload_images(
    product_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    variant_id: Optional[uuid.UUID] = Query(None),
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    images = await service.upload_product_images(
        db, user.current_tenant_id, user.id, product_id, files, variant_id
    )
    return {"data": [img.model_dump() for img in images], "message": f"{len(images)} image(s) uploaded successfully"}


@router.post("/{product_id}/images/url")
async def add_image_url(
    product_id: uuid.UUID,
    data: ImageUrlCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    img = await service.add_product_image_url(
        db, user.current_tenant_id, user.id, product_id, data.file_url, data.caption, data.is_primary
    )
    return {"data": img.model_dump(), "message": "Image URL added successfully"}


@router.put("/{product_id}/images/{image_id}")
async def update_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    data: ImageUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    img = await service.update_product_image(
        db=db,
        tenant_id=user.current_tenant_id,
        user_id=user.id,
        product_id=product_id,
        image_id=image_id,
        caption=data.caption,
        is_primary=data.is_primary,
        sort_order=data.sort_order,
    )
    return {"data": img.model_dump(), "message": "Image updated successfully"}


@router.delete("/{product_id}/images/{image_id}")
async def delete_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_product_image(
        db=db,
        tenant_id=user.current_tenant_id,
        user_id=user.id,
        product_id=product_id,
        image_id=image_id,
    )
    return {"message": "Image deleted successfully"}
