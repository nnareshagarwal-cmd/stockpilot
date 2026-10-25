import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role, get_tenant_id
from app.modules.auth.models import User
from app.modules.business.schemas import BusinessProfile, BusinessProfileUpdate
from app.modules.business import service

router = APIRouter(prefix="/business", tags=["Business Profile"])


@router.get("/profile")
async def get_profile(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    profile = await service.get_business_profile(db, tenant_id)
    return {"data": profile.model_dump()}


@router.put("/profile")
async def update_profile(
    data: BusinessProfileUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    profile = await service.update_business_profile(db, user.current_tenant_id, user.id, data)
    return {"data": profile.model_dump(), "message": "Business profile updated successfully"}
