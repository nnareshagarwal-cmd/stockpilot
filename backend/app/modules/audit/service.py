import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.auth.models import AuditLog


async def log_audit(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    description: Optional[str] = None,
    before_data: Optional[dict] = None,
    after_data: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    audit = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        before_data=before_data,
        after_data=after_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit)
    # Caller's transaction manages commit
