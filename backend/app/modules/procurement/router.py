import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_tenant_id
from app.modules.auth.models import User
from app.modules.procurement import service
from app.modules.procurement.schemas import (
    CompanyStockItemResponse,
    CompanyStockSummaryResponse,
    CompanyStockUploadResult,
    WhatsAppOrderPreviewRequest,
    WhatsAppOrderPreviewResponse,
)

router = APIRouter(prefix="/procurement", tags=["Procurement & Supplier Orders"])


@router.post("/company-stock/upload")
async def upload_company_stock(
    file: UploadFile = File(...),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) files are supported")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    result = await service.parse_and_sync_excel(
        db=db,
        tenant_id=tenant_id,
        file_bytes=content,
        filename=file.filename,
        user_id=current_user.id,
    )
    return {"data": result.model_dump()}


@router.get("/company-stock")
async def list_company_stock(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    subcategory_id: Optional[uuid.UUID] = Query(None),
    stock_filter: Optional[str] = Query("all"),  # 'all', 'in_company_stock', 'out_of_store', 'in_store'
    sort_by: str = Query("company_stock"),
    sort_order: str = Query("desc"),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    items, pagination = await service.list_company_stock(
        db=db,
        tenant_id=tenant_id,
        search=search,
        category_id=category_id,
        subcategory_id=subcategory_id,
        stock_filter=stock_filter,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "data": [item.model_dump() for item in items],
        "pagination": pagination.model_dump(),
    }


@router.get("/company-stock/summary")
async def get_company_stock_summary(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    summary = await service.get_procurement_summary(db=db, tenant_id=tenant_id)
    return {"data": summary.model_dump()}


@router.post("/whatsapp-preview")
async def generate_whatsapp_preview(
    req: WhatsAppOrderPreviewRequest,
):
    res = service.generate_whatsapp_order_message(
        items=req.items,
        supplier_name=req.supplier_name or "Crystal",
        delivery_location=req.delivery_location or "Home Decor Showroom",
        special_notes=req.special_notes,
    )
    return {"data": res.model_dump()}

