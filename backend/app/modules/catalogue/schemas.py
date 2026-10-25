import uuid
from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class VariantIn(BaseModel):
    id: Optional[uuid.UUID] = None
    sku: str = Field(..., min_length=1, max_length=100)
    variant_name: Optional[str] = Field(None, max_length=255)
    barcode: Optional[str] = Field(None, max_length=100)
    barcode_type: Optional[str] = Field(None, max_length=20)
    unit_id: Optional[uuid.UUID] = None
    purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    selling_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    mrp: Optional[Decimal] = Field(None, ge=0)
    reorder_point: Optional[Decimal] = Field(default=Decimal("0.000"), ge=0)
    reorder_quantity: Optional[Decimal] = Field(default=Decimal("0.000"), ge=0)
    weight_kg: Optional[Decimal] = Field(None, ge=0)
    is_active: bool = True


class AttributeValueIn(BaseModel):
    id: Optional[uuid.UUID] = None
    variant_id: Optional[uuid.UUID] = None  # None if product-level
    attribute_id: uuid.UUID
    text_value: Optional[str] = None
    numeric_value: Optional[Decimal] = None
    decimal_value: Optional[Decimal] = None
    boolean_value: Optional[bool] = None
    date_value: Optional[date] = None
    option_id: Optional[uuid.UUID] = None
    option_ids: Optional[List[str]] = None


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=500)
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    subcategory_id: Optional[uuid.UUID] = None
    brand_id: Optional[uuid.UUID] = None
    model: Optional[str] = Field(None, max_length=255)
    tax_rate_id: Optional[uuid.UUID] = None
    variants: List[VariantIn] = []
    attributes: List[AttributeValueIn] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=500)
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    subcategory_id: Optional[uuid.UUID] = None
    brand_id: Optional[uuid.UUID] = None
    model: Optional[str] = Field(None, max_length=255)
    tax_rate_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    variants: Optional[List[VariantIn]] = None
    attributes: Optional[List[AttributeValueIn]] = None


class ProductImageResponse(BaseModel):
    id: uuid.UUID
    file_url: str
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    caption: Optional[str] = None
    is_primary: bool
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class VariantResponse(BaseModel):
    id: uuid.UUID
    sku: str
    variant_name: Optional[str] = None
    barcode: Optional[str] = None
    barcode_type: Optional[str] = None
    unit_id: Optional[uuid.UUID] = None
    unit_name: Optional[str] = None
    unit_code: Optional[str] = None
    purchase_price: Decimal
    selling_price: Decimal
    mrp: Optional[Decimal] = None
    reorder_point: Optional[Decimal] = None
    reorder_quantity: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    is_active: bool

    class Config:
        from_attributes = True


class AttributeValueDetail(BaseModel):
    id: uuid.UUID
    attribute_id: uuid.UUID
    attribute_name: str
    attribute_code: str
    data_type: str
    unit_label: Optional[str] = None
    variant_id: Optional[uuid.UUID] = None
    text_value: Optional[str] = None
    numeric_value: Optional[Decimal] = None
    decimal_value: Optional[Decimal] = None
    boolean_value: Optional[bool] = None
    date_value: Optional[date] = None
    option_id: Optional[uuid.UUID] = None
    option_label: Optional[str] = None
    option_ids: Optional[List[str]] = None
    formatted_value: str = ""


class ProductDetailResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    subcategory_id: Optional[uuid.UUID] = None
    subcategory_name: Optional[str] = None
    brand_id: Optional[uuid.UUID] = None
    brand_name: Optional[str] = None
    model: Optional[str] = None
    tax_rate_id: Optional[uuid.UUID] = None
    tax_rate_name: Optional[str] = None
    tax_rate_percent: Optional[Decimal] = None
    is_active: bool
    created_at: datetime
    variants: List[VariantResponse] = []
    attributes: List[AttributeValueDetail] = []
    images: List[ProductImageResponse] = []


class ProductSearchItem(BaseModel):
    id: uuid.UUID
    name: str
    category: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    subcategory: Optional[str] = None
    subcategory_id: Optional[uuid.UUID] = None
    brand: Optional[str] = None
    brand_id: Optional[uuid.UUID] = None
    model: Optional[str] = None
    primary_image_url: Optional[str] = None
    default_sku: Optional[str] = None
    selling_price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    variant_count: int = 1
    is_active: bool = True
    locations: List[str] = []


class ImageUpdate(BaseModel):
    caption: Optional[str] = None
    is_primary: Optional[bool] = None
    sort_order: Optional[int] = None


class CsvRowPreview(BaseModel):
    row: int
    status: str  # "valid" | "error"
    data: Dict[str, Any]
    errors: List[str] = []


class CsvPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    error_rows: int
    preview: List[CsvRowPreview]


class CsvImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[Dict[str, Any]]
