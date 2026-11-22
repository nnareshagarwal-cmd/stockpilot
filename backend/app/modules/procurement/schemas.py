import uuid
from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class CompanyStockItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    brand_name: str
    supplier_item_code: str
    item_name: str
    description: Optional[str] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    subcategory_id: Optional[uuid.UUID] = None
    size: Optional[str] = None
    color: Optional[str] = None
    sku: Optional[str] = None
    company_stock: int = 0
    store_stock: float = 0.0
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    cost_price: Optional[float] = None
    report_date: Optional[date] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompanyStockSummaryResponse(BaseModel):
    total_products: int = 0
    total_company_stock: int = 0
    total_store_stock: float = 0.0
    out_of_stock_in_store_count: int = 0
    in_company_stock_count: int = 0
    last_filename: Optional[str] = None
    last_report_date: Optional[date] = None
    last_uploaded_at: Optional[datetime] = None


class CompanyStockUploadResult(BaseModel):
    batch_id: uuid.UUID
    filename: str
    report_date: Optional[date] = None
    total_rows_processed: int
    total_company_stock: int
    new_products_created: int
    existing_products_updated: int
    brand_name: str = "Crystal"


class OrderItemInput(BaseModel):
    product_id: uuid.UUID
    sku: Optional[str] = None
    supplier_item_code: str
    item_name: str
    color: Optional[str] = None
    size: Optional[str] = None
    quantity: int = Field(gt=0)


class WhatsAppOrderPreviewRequest(BaseModel):
    items: List[OrderItemInput]
    supplier_name: Optional[str] = "Crystal"
    delivery_location: Optional[str] = "Home Decor Showroom"
    special_notes: Optional[str] = None


class WhatsAppOrderPreviewResponse(BaseModel):
    formatted_message: str
    total_items: int
    total_quantity: int
    encoded_url: str

