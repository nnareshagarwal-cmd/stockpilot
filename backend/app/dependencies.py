import uuid
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.common.security import decode_token
from app.common.exceptions import UnauthorizedException, ForbiddenException
from app.modules.auth.models import User, BusinessUser, Business, Role

security = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise UnauthorizedException("Invalid token type")
        user_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tenant_id"])
        role_name = payload.get("role", "")
    except Exception:
        raise UnauthorizedException("Invalid or expired token")

    # Verify user still exists and is active
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise UnauthorizedException("User not found or inactive")

    # Verify business membership and business is active
    bu_result = await db.execute(
        select(BusinessUser, Business, Role)
        .join(Business, Business.id == BusinessUser.business_id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.user_id == user_id,
            BusinessUser.business_id == tenant_id,
            BusinessUser.is_active == True,
            Business.is_active == True,
        )
    )
    bu_row = bu_result.first()
    if not bu_row:
        raise UnauthorizedException("Inactive business membership or business")

    user.current_tenant_id = tenant_id
    user.current_role = bu_row[2].name
    return user


def require_role(*allowed_roles: str):
    """Dependency checking that the authenticated user has one of allowed_roles."""
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.current_role not in allowed_roles:
            raise ForbiddenException(f"Role '{user.current_role}' is not authorized for this action")
        return user
    return role_checker


def get_tenant_id(user: User = Depends(get_current_user)) -> uuid.UUID:
    """Extract tenant_id from the authenticated user."""
    return user.current_tenant_id
