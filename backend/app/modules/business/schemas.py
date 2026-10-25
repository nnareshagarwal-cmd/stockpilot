import uuid
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class BusinessProfile(BaseModel):
    id: uuid.UUID
    name: str
    legal_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    logo_url: Optional[str] = None
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    date_format: str = "DD/MM/YYYY"
    financial_year_start_month: str = "04"
    is_active: bool = True
    settings: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class BusinessProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    legal_name: Optional[str] = Field(None, max_length=255)
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=10)
    country: Optional[str] = Field(None, max_length=100)
    logo_url: Optional[str] = Field(None, max_length=500)
    currency: Optional[str] = Field(None, max_length=3)
    timezone: Optional[str] = Field(None, max_length=50)
    date_format: Optional[str] = Field(None, max_length=20)
    financial_year_start_month: Optional[str] = Field(None, max_length=2)
    settings: Optional[Dict[str, Any]] = None
