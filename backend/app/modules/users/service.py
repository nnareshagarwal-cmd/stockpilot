import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.common.exceptions import (
    NotFoundException,
    ConflictException,
    ValidationException,
)
from app.common.security import hash_password
from app.modules.auth.models import User, BusinessUser, Role
from app.modules.users.schemas import UserCreate, UserUpdate, UserDetail
from app.modules.audit.service import log_audit


async def list_users(db: AsyncSession, tenant_id: uuid.UUID) -> List[UserDetail]:
    result = await db.execute(
        select(User, Role, BusinessUser.is_active)
        .join(BusinessUser, BusinessUser.user_id == User.id)
        .join(Role, Role.id == BusinessUser.role_id)
        .where(BusinessUser.business_id == tenant_id)
    )
    users = []
    for user, role, bu_active in result.all():
        users.append(
            UserDetail(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                phone=user.phone,
                role=role.name,
                is_active=bu_active and user.is_active,
            )
        )
    return users


async def create_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    admin_id: uuid.UUID,
    data: UserCreate,
) -> UserDetail:
    # Check if role exists
    role_res = await db.execute(select(Role).where(Role.name == data.role_name))
    role = role_res.scalar_one_or_none()
    if not role:
        raise NotFoundException("Role", data.role_name)

    # Check if user already exists
    user_res = await db.execute(select(User).where(User.email == data.email.lower()))
    user = user_res.scalar_one_or_none()

    if user:
        # Check if already a member of this tenant
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
    return UserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=role.name,
        is_active=True,
    )


async def get_user_detail(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> UserDetail:
    result = await db.execute(
        select(User, Role, BusinessUser.is_active)
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
    user, role, bu_active = row
    return UserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=role.name,
        is_active=bu_active and user.is_active,
    )


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
    return UserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=role_to_return,
        is_active=membership.is_active and user.is_active,
    )
