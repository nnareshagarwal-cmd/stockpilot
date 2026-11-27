import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.modules.auth.schemas import BusinessSummary, UserSummary


class MobileLoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=255, description="Phone number or email")
    pin: str = Field(..., pattern=r"^\d{4}$", description="4-digit numeric PIN")
    business_id: Optional[uuid.UUID] = None


class MobileBusinessChoice(BaseModel):
    id: uuid.UUID
    name: str


class MobileLoginResponseData(BaseModel):
    requires_business_selection: bool = False
    businesses: List[MobileBusinessChoice] = []
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserSummary] = None
    business: Optional[BusinessSummary] = None
    mobile_pages: Dict[str, bool] = {}
    allowed_tiles: List[str] = []


class MobileMeData(BaseModel):
    user: UserSummary
    business: BusinessSummary
    mobile_access: bool
    mobile_pages: Dict[str, bool]
    allowed_tiles: List[str]
