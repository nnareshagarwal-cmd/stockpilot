import uuid
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ---------------- Category ----------------
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryTreeItem(BaseModel):
    id: uuid.UUID
    name: str
    code: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    children: List["CategoryTreeItem"] = []

    class Config:
        from_attributes = True


# ---------------- Brand ----------------
class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    is_active: Optional[bool] = None


class BrandResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ---------------- Unit of Measure ----------------
class UnitCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=100)
    decimal_places: int = Field(0, ge=0, le=5)


class UnitUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    decimal_places: Optional[int] = Field(None, ge=0, le=5)
    is_active: Optional[bool] = None


class UnitResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    decimal_places: int
    is_active: bool

    class Config:
        from_attributes = True


# ---------------- Location ----------------
LocationType = Literal[
    'store', 'showroom', 'warehouse', 'godown', 'floor', 'section', 'rack', 'shelf', 'bin', 'other'
]


class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    location_type: LocationType = "other"
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    sort_order: int = 0


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    location_type: Optional[LocationType] = None
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class LocationTreeItem(BaseModel):
    id: uuid.UUID
    name: str
    code: Optional[str] = None
    location_type: str
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    children: List["LocationTreeItem"] = []

    class Config:
        from_attributes = True


# ---------------- Stock Condition ----------------
class StockConditionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    is_sellable: bool = True
    description: Optional[str] = None
    sort_order: int = 0


class StockConditionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    is_sellable: Optional[bool] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class StockConditionResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    is_sellable: bool
    description: Optional[str] = None
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


# ---------------- Tax Rate ----------------
class TaxRateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    rate: Decimal = Field(..., ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=20)
    sac_code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None


class TaxRateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    rate: Optional[Decimal] = Field(None, ge=0, le=100)
    hsn_code: Optional[str] = Field(None, max_length=20)
    sac_code: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TaxRateResponse(BaseModel):
    id: uuid.UUID
    name: str
    rate: Decimal
    hsn_code: Optional[str] = None
    sac_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# ---------------- Attribute Definition & Options ----------------
AttributeDataType = Literal[
    'text', 'number', 'decimal', 'boolean', 'date', 'single_choice', 'multiple_choice'
]


class AttributeOptionIn(BaseModel):
    id: Optional[uuid.UUID] = None
    value: str = Field(..., min_length=1, max_length=255)
    sort_order: int = 0


class AttributeOptionResponse(BaseModel):
    id: uuid.UUID
    value: str
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


class AttributeDefinitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=100)
    data_type: AttributeDataType
    category_id: Optional[uuid.UUID] = None
    is_required: bool = False
    is_searchable: bool = False
    is_filterable: bool = False
    unit_label: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    sort_order: int = 0
    options: List[AttributeOptionIn] = []


class AttributeDefinitionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=100)
    data_type: Optional[AttributeDataType] = None
    category_id: Optional[uuid.UUID] = None
    is_required: Optional[bool] = None
    is_searchable: Optional[bool] = None
    is_filterable: Optional[bool] = None
    unit_label: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    options: Optional[List[AttributeOptionIn]] = None


class AttributeDefinitionResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    data_type: str
    category_id: Optional[uuid.UUID] = None
    is_required: bool
    is_searchable: bool
    is_filterable: bool
    unit_label: Optional[str] = None
    description: Optional[str] = None
    sort_order: int
    is_active: bool
    options: List[AttributeOptionResponse] = []

    class Config:
        from_attributes = True


# ---------------- List of Values (Generic Dropdowns) ----------------
class ListOfValuesCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    label: str = Field(..., min_length=1, max_length=255)
    value: Optional[str] = Field(None, max_length=255)
    sort_order: int = 0
    description: Optional[str] = None


class ListOfValuesUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=255)
    value: Optional[str] = Field(None, max_length=255)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class ListOfValuesResponse(BaseModel):
    id: uuid.UUID
    category: str
    label: str
    value: str
    sort_order: int = 0
    is_active: bool = True
    is_system: bool = False
    description: Optional[str] = None
    option_id: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True

