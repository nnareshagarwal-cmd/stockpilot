import uuid
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=100)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)


class UserSummary(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class BusinessSummary(BaseModel):
    id: uuid.UUID
    name: str
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"

    class Config:
        from_attributes = True


class RoleSummary(BaseModel):
    name: str
    display_name: str


class AuthData(BaseModel):
    user: UserSummary
    business: BusinessSummary
    access_token: str
    refresh_token: str


class CurrentUserData(BaseModel):
    user: UserSummary
    business: BusinessSummary
    role: RoleSummary
    permissions: List[str] = []
