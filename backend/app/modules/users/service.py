import uuid
from datetime import datetime, timezone
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.common.exceptions import (
    NotFoundException,
    ConflictException,
)
from app.common.security import hash_password
from app.modules.auth.models import User, BusinessUser, Role
from app.modules.mobile.constants import normalize_mobile_pages
from app.modules.users.schemas import UserCreate, UserUpdate, UserDetail
from app.modules.audit.service import log_audit


def _to_user_detail(user: User, role_name: str, membership: BusinessUser) -> UserDetail:
    now = datetime.now(timezone.utc)
    locked_until = membership.pin_locked_until
    is_locked = bool(locked_until is not None and locked_until > now)
    return UserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=role_name,
        is_active=membership.is_active and user.is_active,
        mobile_access=bool(membership.mobile_access),
        has_mobile_pin=bool(membership.mobile_pin_hash),
        mobile_pages=normalize_mobile_pages(membership.mobile_pages),
        pin_failed_attempts=int(membership.pin_failed_attempts or 0) if is_locked or membership.pin_failed_attempts else 0,
        pin_locked_until=locked_until if is_locked else None,
        is_pin_locked=is_locked,
    )


async def list_users(db: AsyncSession, tenant_id: uuid.UUID) -> List[UserDetail]:
    result = await db.execute(
        select(User, Role, BusinessUser)
        .join(BusinessUser, BusinessUser.user_id == User.id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(BusinessUser.business_id == tenant_id)
    )
    return [_to_user_detail(user, role.name, membership) for user, role, membership in result.all()]


async def create_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    admin_id: uuid.UUID,
    data: UserCreate,
) -> UserDetail:
    role_res = await db.execute(select(Role).where(Role.name == data.role_name))
    role = role_res.scalar_one_or_none()
    if not role:
        raise NotFoundException("Role", data.role_name)

    user_res = await db.execute(select(User).where(User.email == data.email.lower()))
    user = user_res.scalar_one_or_none()

    if user:
        bu_res = await db.execute(
            select(BusinessUser).where(
                BusinessUser.business_id == tenant_id,
                BusinessUser.user_id == user.id,
            )
        )
        if bu_res.scalar_one_or_none():
            raise ConflictException(f"User '{data.email}' is already a member of this business")
    else:
        user = User(
            email=data.email.lower(),
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
        )
        db.add(user)
        await db.flush()

    membership = BusinessUser(
        business_id=tenant_id,
        user_id=user.id,
        role_id=role.id,
        is_active=True,
        mobile_access=bool(data.mobile_access),
        mobile_pin_hash=hash_password(data.mobile_pin) if data.mobile_pin else None,
        mobile_pages=normalize_mobile_pages(data.mobile_pages),
    )
    db.add(membership)

    await log_audit(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_id,
        action="USER_ADDED",
        entity_type="user",
        entity_id=user.id,
        description=f"Added user {user.email} with role {role.name}",
    )

    await db.commit()
    return _to_user_detail(user, role.name, membership)


async def get_user_detail(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> UserDetail:
    result = await db.execute(
        select(User, Role, BusinessUser)
        .join(BusinessUser, BusinessUser.user_id == User.id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.business_id == tenant_id,
            User.id == user_id,
        )
    )
    row = result.first()
    if not row:
        raise NotFoundException("User", str(user_id))
    user, role, membership = row
    return _to_user_detail(user, role.name, membership)


async def update_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    admin_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UserUpdate,
) -> UserDetail:
    result = await db.execute(
        select(User, BusinessUser, Role)
        .join(BusinessUser, BusinessUser.user_id == User.id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.business_id == tenant_id,
            User.id == user_id,
        )
    )
    row = result.first()
    if not row:
        raise NotFoundException("User", str(user_id))
    user, membership, current_role = row

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    if data.is_active is not None:
        membership.is_active = data.is_active
    if data.mobile_access is not None:
        membership.mobile_access = data.mobile_access
    if data.mobile_pin is not None:
        membership.mobile_pin_hash = hash_password(data.mobile_pin)
        membership.pin_failed_attempts = 0
        membership.pin_locked_until = None
    if data.mobile_pages is not None:
        membership.mobile_pages = normalize_mobile_pages(data.mobile_pages)

    if data.role_name is not None:
        r_res = await db.execute(select(Role).where(Role.name == data.role_name))
        new_role = r_res.scalar_one_or_none()
        if not new_role:
            raise NotFoundException("Role", data.role_name)
        membership.role_id = new_role.id
        role_to_return = new_role.name
    else:
        role_to_return = current_role.name

    await log_audit(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_id,
        action="UPDATE",
        entity_type="user",
        entity_id=user.id,
        description=f"Updated user {user.email}",
    )

    await db.commit()
    return _to_user_detail(user, role_to_return, membership)


async def unlock_user_mobile_pin(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    admin_id: uuid.UUID,
    user_id: uuid.UUID,
) -> UserDetail:
    result = await db.execute(
        select(User, BusinessUser, Role)
        .join(BusinessUser, BusinessUser.user_id == User.id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(
            BusinessUser.business_id == tenant_id,
            User.id == user_id,
        )
    )
    row = result.first()
    if not row:
        raise NotFoundException("User", str(user_id))
    user, membership, role = row

    membership.pin_failed_attempts = 0
    membership.pin_locked_until = None

    await log_audit(
        db=db,
        tenant_id=tenant_id,
        user_id=admin_id,
        action="MOBILE_PIN_UNLOCK",
        entity_type="user",
        entity_id=user.id,
        description=f"Unlocked mobile PIN for {user.email}",
    )
    await db.commit()
    return _to_user_detail(user, role.name, membership)
