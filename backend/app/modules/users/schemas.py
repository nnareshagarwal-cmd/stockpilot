import uuid
from datetime import datetime
from typing import Dict, Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    role_name: str = Field("staff", pattern="^(admin|staff)$")
    mobile_access: bool = False
    mobile_pin: Optional[str] = Field(None, pattern=r"^\d{4}$")
    mobile_pages: Optional[Dict[str, bool]] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    role_name: Optional[str] = Field(None, pattern="^(admin|staff)$")
    is_active: Optional[bool] = None
    mobile_access: Optional[bool] = None
    mobile_pin: Optional[str] = Field(None, pattern=r"^\d{4}$")
    mobile_pages: Optional[Dict[str, bool]] = None


class UserDetail(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    mobile_access: bool = False
    has_mobile_pin: bool = False
    mobile_pages: Dict[str, bool] = {}
    pin_failed_attempts: int = 0
    pin_locked_until: Optional[datetime] = None
    is_pin_locked: bool = False

    class Config:
        from_attributes = True
