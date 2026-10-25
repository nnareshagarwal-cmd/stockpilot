from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class OpeningStockItem(BaseModel):
    variant_id: UUID
    location_id: UUID
    condition_id: UUID
    quantity: Decimal = Field(..., gt=0)
    unit_cost: Decimal = Field(default=Decimal("0.00"), ge=0)
    received_date: Optional[date] = None
    notes: Optional[str] = None


class OpeningStockBatchRequest(BaseModel):
    items: List[OpeningStockItem]
    batch_reference: Optional[str] = None


class StockBalanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    variant_id: UUID
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    variant_name: Optional[str] = None
    sku: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    condition_id: UUID
    condition_name: Optional[str] = None
    is_sellable: Optional[bool] = None
    quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    updated_at: datetime


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    movement_type: str
    variant_id: UUID
    product_name: Optional[str] = None
    variant_name: Optional[str] = None
    sku: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    condition_id: UUID
    condition_name: Optional[str] = None
    quantity: Decimal
    balance_after: Decimal
    unit_cost: Optional[Decimal] = None
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime


class StockTransferItemCreate(BaseModel):
    variant_id: UUID
    condition_id: UUID
    quantity: Decimal = Field(..., gt=0)


class StockTransferCreate(BaseModel):
    source_location_id: UUID
    destination_location_id: UUID
    notes: Optional[str] = None
    items: List[StockTransferItemCreate]


class StockTransferItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    variant_id: UUID
    sku: Optional[str] = None
    product_name: Optional[str] = None
    condition_id: UUID
    condition_name: Optional[str] = None
    quantity: Decimal
    received_quantity: Decimal


class StockTransferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transfer_number: str
    source_location_id: UUID
    source_location_name: Optional[str] = None
    destination_location_id: UUID
    destination_location_name: Optional[str] = None
    status: str
    dispatched_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    items: List[StockTransferItemResponse] = []


class StockTransferReceiveItem(BaseModel):
    item_id: UUID
    received_quantity: Decimal = Field(..., ge=0)


class StockTransferReceiveRequest(BaseModel):
    items: Optional[List[StockTransferReceiveItem]] = None
    notes: Optional[str] = None


class ConditionChangeRequest(BaseModel):
    variant_id: UUID
    location_id: UUID
    from_condition_id: UUID
    to_condition_id: UUID
    quantity: Decimal = Field(..., gt=0)
    notes: Optional[str] = None


class StockAdjustmentCreate(BaseModel):
    variant_id: UUID
    location_id: UUID
    condition_id: UUID
    quantity_delta: Decimal = Field(...)
    reason_code: str = Field(..., min_length=2, max_length=50)
    notes: Optional[str] = None


class StockAdjustmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    adjustment_number: str
    variant_id: UUID
    product_name: Optional[str] = None
    sku: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    condition_id: UUID
    condition_name: Optional[str] = None
    quantity_delta: Decimal
    reason_code: str
    notes: Optional[str] = None
    created_at: datetime


class AgeingBand(BaseModel):
    band_name: str
    quantity: Decimal
    valuation: Decimal


class AgeingItemResponse(BaseModel):
    variant_id: UUID
    sku: str
    product_name: str
    category_name: Optional[str] = None
    total_quantity: Decimal
    total_valuation: Decimal
    bands: dict[str, Decimal]


class AgeingSummaryResponse(BaseModel):
    total_valuation: Decimal
    total_quantity: Decimal
    bands: dict[str, Decimal]
    items: List[AgeingItemResponse]


class ReconciliationMismatch(BaseModel):
    variant_id: UUID
    sku: Optional[str] = None
    product_name: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    condition_id: UUID
    condition_name: Optional[str] = None
    movement_sum: Decimal
    balance_recorded: Decimal
    difference: Decimal


class ReconciliationResponse(BaseModel):
    is_balanced: bool
    total_checked: int
    mismatches: List[ReconciliationMismatch]


class LowStockItemResponse(BaseModel):
    variant_id: UUID
    product_id: UUID
    sku: str
    product_name: str
    category_name: Optional[str] = None
    reorder_point: Decimal
    available_quantity: Decimal
    shortfall: Decimal
