import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class InventorySummarySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_products: int
    total_stock: Decimal
    available_stock: Decimal
    reserved_stock: Decimal
    inventory_valuation: Optional[Decimal] = None
    valuation_basis: str = "FIFO Cost Basis"
    can_view_valuation: bool = True


class StockHealthSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    low_stock_products: int
    out_of_stock_products: int
    damaged_stock: Decimal
    products_with_stock: int


class AgeingBandSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: str
    period: str
    quantity: Decimal
    valuation: Decimal
    percentage: float


class DashboardAgeingSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_valuation: Decimal
    total_quantity: Decimal
    bands: List[AgeingBandSchema]


class ActionRequiredSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    replenishment_products: int
    out_of_stock_products: int
    pending_transfers: int
    reconciliation_balanced: bool
    reconciliation_discrepancies: int


class RecentStockActivitySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    product_name: str
    variant_name: Optional[str] = None
    sku: str
    movement_type: str
    activity: str
    quantity: Decimal
    location_name: str
    reference_number: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inventory: InventorySummarySchema
    stock_health: StockHealthSchema
    ageing: Optional[DashboardAgeingSchema] = None
    action_required: ActionRequiredSchema
    recent_activity: List[RecentStockActivitySchema] = []
    business_id: uuid.UUID
    business_name: Optional[str] = None
    user_role: str
