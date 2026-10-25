import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.common.exceptions import NotFoundException
from app.modules.auth.models import Business
from app.modules.business.schemas import BusinessProfile, BusinessProfileUpdate
from app.modules.audit.service import log_audit


async def get_business_profile(db: AsyncSession, tenant_id: uuid.UUID) -> BusinessProfile:
    result = await db.execute(select(Business).where(Business.id == tenant_id))
    business = result.scalar_one_or_none()
    if not business:
        raise NotFoundException("Business", str(tenant_id))
    return BusinessProfile.model_validate(business)


async def update_business_profile(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: BusinessProfileUpdate,
) -> BusinessProfile:
    result = await db.execute(select(Business).where(Business.id == tenant_id))
    business = result.scalar_one_or_none()
    if not business:
        raise NotFoundException("Business", str(tenant_id))

    before = {
        "name": business.name,
        "phone": business.phone,
        "email": business.email,
        "city": business.city,
    }

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(business, key, value)

    await log_audit(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        action="UPDATE",
        entity_type="business",
        entity_id=tenant_id,
        description="Business profile updated",
        before_data=before,
        after_data=update_dict,
    )

    await db.commit()
    await db.refresh(business)
    return BusinessProfile.model_validate(business)
