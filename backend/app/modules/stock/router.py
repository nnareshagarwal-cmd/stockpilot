import uuid
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_tenant_id, require_role
from app.modules.auth.models import User
from app.modules.stock.service import StockService
from app.modules.stock.schemas import (
    OpeningStockBatchRequest,
    StockBalanceResponse,
    StockMovementResponse,
    StockTransferCreate,
    StockTransferResponse,
    StockTransferReceiveRequest,
    ConditionChangeRequest,
    StockAdjustmentCreate,
    StockAdjustmentResponse,
    AgeingSummaryResponse,
    ReconciliationResponse,
    LowStockItemResponse,
)

router = APIRouter(prefix="/stock", tags=["Stock & Inventory"])


@router.post("/opening", status_code=status.HTTP_201_CREATED)
async def record_opening_stock(
    batch_req: OpeningStockBatchRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin", "staff")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    movements = await service.record_opening_stock_batch(
        tenant_id=tenant_id,
        user_id=current_user.id,
        batch_req=batch_req,
    )
    return {
        "status": "success",
        "message": f"Successfully recorded {len(movements)} opening stock entries",
        "count": len(movements),
    }


@router.get("/balances")
async def list_stock_balances(
    variant_id: Optional[uuid.UUID] = Query(None),
    location_id: Optional[uuid.UUID] = Query(None),
    condition_id: Optional[uuid.UUID] = Query(None),
    is_sellable: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    offset = (page - 1) * page_size
    items, total, summary = await service.list_balances(
        tenant_id=tenant_id,
        variant_id=variant_id,
        location_id=location_id,
        condition_id=condition_id,
        is_sellable=is_sellable,
        search=search,
        limit=page_size,
        offset=offset,
    )
    return {
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        },
        "summary": summary,
    }


@router.get("/movements")
async def list_stock_movements(
    variant_id: Optional[uuid.UUID] = Query(None),
    location_id: Optional[uuid.UUID] = Query(None),
    movement_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    offset = (page - 1) * page_size
    items, total = await service.list_movements(
        tenant_id=tenant_id,
        variant_id=variant_id,
        location_id=location_id,
        movement_type=movement_type,
        limit=page_size,
        offset=offset,
    )
    return {
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        },
    }


@router.get("/transfers")
async def list_stock_transfers(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    offset = (page - 1) * page_size
    items, total = await service.list_transfers(
        tenant_id=tenant_id,
        status=status_filter,
        limit=page_size,
        offset=offset,
    )
    return {
        "data": [
            StockTransferResponse(
                id=t.id,
                transfer_number=t.transfer_number,
                source_location_id=t.source_location_id,
                source_location_name=t.source_location.name if t.source_location else None,
                destination_location_id=t.destination_location_id,
                destination_location_name=t.destination_location.name if t.destination_location else None,
                status=t.status,
                dispatched_at=t.dispatched_at,
                received_at=t.received_at,
                notes=t.notes,
                created_at=t.created_at,
                items=[
                    {
                        "id": it.id,
                        "variant_id": it.variant_id,
                        "sku": it.variant.sku if it.variant else None,
                        "product_name": it.variant.product.name if it.variant and it.variant.product else None,
                        "condition_id": it.condition_id,
                        "condition_name": it.condition.name if it.condition else None,
                        "quantity": it.quantity,
                        "received_quantity": it.received_quantity,
                    }
                    for it in t.items
                ],
            ).model_dump()
            for t in items
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        },
    }


@router.post("/transfers", status_code=status.HTTP_201_CREATED)
async def create_stock_transfer(
    transfer_data: StockTransferCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin", "staff")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    t = await service.create_transfer(
        tenant_id=tenant_id,
        user_id=current_user.id,
        transfer_data=transfer_data,
        dispatch_immediately=True,
    )
    return {
        "status": "success",
        "data": StockTransferResponse(
            id=t.id,
            transfer_number=t.transfer_number,
            source_location_id=t.source_location_id,
            source_location_name=t.source_location.name if t.source_location else None,
            destination_location_id=t.destination_location_id,
            destination_location_name=t.destination_location.name if t.destination_location else None,
            status=t.status,
            dispatched_at=t.dispatched_at,
            received_at=t.received_at,
            notes=t.notes,
            created_at=t.created_at,
            items=[
                {
                    "id": it.id,
                    "variant_id": it.variant_id,
                    "sku": it.variant.sku if it.variant else None,
                    "product_name": it.variant.product.name if it.variant and it.variant.product else None,
                    "condition_id": it.condition_id,
                    "condition_name": it.condition.name if it.condition else None,
                    "quantity": it.quantity,
                    "received_quantity": it.received_quantity,
                }
                for it in t.items
            ],
        ).model_dump(),
    }


@router.get("/transfers/{transfer_id}")
async def get_stock_transfer(
    transfer_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    t = await service.get_transfer(tenant_id=tenant_id, transfer_id=transfer_id)
    return {
        "data": StockTransferResponse(
            id=t.id,
            transfer_number=t.transfer_number,
            source_location_id=t.source_location_id,
            source_location_name=t.source_location.name if t.source_location else None,
            destination_location_id=t.destination_location_id,
            destination_location_name=t.destination_location.name if t.destination_location else None,
            status=t.status,
            dispatched_at=t.dispatched_at,
            received_at=t.received_at,
            notes=t.notes,
            created_at=t.created_at,
            items=[
                {
                    "id": it.id,
                    "variant_id": it.variant_id,
                    "sku": it.variant.sku if it.variant else None,
                    "product_name": it.variant.product.name if it.variant and it.variant.product else None,
                    "condition_id": it.condition_id,
                    "condition_name": it.condition.name if it.condition else None,
                    "quantity": it.quantity,
                    "received_quantity": it.received_quantity,
                }
                for it in t.items
            ],
        ).model_dump()
    }


@router.put("/transfers/{transfer_id}/receive")
async def receive_stock_transfer(
    transfer_id: uuid.UUID,
    receive_req: Optional[StockTransferReceiveRequest] = None,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin", "staff")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    t = await service.receive_transfer(
        tenant_id=tenant_id,
        user_id=current_user.id,
        transfer_id=transfer_id,
        receive_req=receive_req,
    )
    return {
        "status": "success",
        "data": StockTransferResponse(
            id=t.id,
            transfer_number=t.transfer_number,
            source_location_id=t.source_location_id,
            source_location_name=t.source_location.name if t.source_location else None,
            destination_location_id=t.destination_location_id,
            destination_location_name=t.destination_location.name if t.destination_location else None,
            status=t.status,
            dispatched_at=t.dispatched_at,
            received_at=t.received_at,
            notes=t.notes,
            created_at=t.created_at,
            items=[
                {
                    "id": it.id,
                    "variant_id": it.variant_id,
                    "sku": it.variant.sku if it.variant else None,
                    "product_name": it.variant.product.name if it.variant and it.variant.product else None,
                    "condition_id": it.condition_id,
                    "condition_name": it.condition.name if it.condition else None,
                    "quantity": it.quantity,
                    "received_quantity": it.received_quantity,
                }
                for it in t.items
            ],
        ).model_dump(),
    }


@router.post("/condition-change")
async def change_stock_condition(
    req: ConditionChangeRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin", "staff")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    m_out, m_in = await service.change_condition(
        tenant_id=tenant_id,
        user_id=current_user.id,
        req=req,
    )
    return {
        "status": "success",
        "message": f"Successfully moved {req.quantity} units to new condition",
    }


@router.post("/adjustments", status_code=status.HTTP_201_CREATED)
async def record_stock_adjustment(
    adj_data: StockAdjustmentCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    adj = await service.record_adjustment(
        tenant_id=tenant_id,
        user_id=current_user.id,
        adj_data=adj_data,
    )
    return {
        "status": "success",
        "data": {
            "id": adj.id,
            "adjustment_number": adj.adjustment_number,
            "quantity_delta": adj.quantity_delta,
            "reason_code": adj.reason_code,
            "notes": adj.notes,
            "created_at": adj.created_at,
        },
    }


@router.get("/ageing")
async def get_stock_ageing(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    return await service.get_ageing_report(tenant_id=tenant_id)


@router.get("/reconciliation")
async def get_stock_reconciliation(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    return await service.get_reconciliation(tenant_id=tenant_id)


@router.get("/low-stock")
async def get_low_stock_alerts(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    items = await service.get_low_stock(tenant_id=tenant_id)
    return {"data": [it.model_dump() for it in items]}


class StockMappingAllocateRequest(BaseModel):
    variant_id: uuid.UUID
    location_id: uuid.UUID
    quantity: Decimal = Field(..., ge=0)
    condition_id: Optional[uuid.UUID] = None
    mode: str = "set_total"  # "set_total" | "add"
    notes: Optional[str] = None


@router.get("/mapping/{product_id}")
async def get_product_stock_mapping(
    product_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    data = await service.get_product_stock_mapping(tenant_id, product_id)
    return {"status": "success", "data": data}


@router.post("/mapping/{product_id}/allocate")
async def allocate_product_stock(
    product_id: uuid.UUID,
    payload: StockMappingAllocateRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(require_role("admin", "staff")),
    db: AsyncSession = Depends(get_db),
):
    service = StockService(db)
    data = await service.allocate_product_stock(
        tenant_id=tenant_id,
        user_id=current_user.id,
        product_id=product_id,
        variant_id=payload.variant_id,
        location_id=payload.location_id,
        quantity=payload.quantity,
        condition_id=payload.condition_id,
        mode=payload.mode,
        notes=payload.notes,
    )
    return {"status": "success", "data": data}
