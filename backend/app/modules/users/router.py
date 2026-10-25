import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.modules.auth.models import User
from app.modules.users.schemas import UserCreate, UserUpdate
from app.modules.users import service

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("")
async def get_users(
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    users = await service.list_users(db, user.current_tenant_id)
    return {"data": [u.model_dump() for u in users]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.create_user(db, user.current_tenant_id, user.id, data)
    return {"data": result.model_dump(), "message": "User added successfully"}


@router.get("/{user_id}")
async def get_user(
    user_id: uuid.UUID,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.get_user_detail(db, user.current_tenant_id, user_id)
    return {"data": result.model_dump()}


@router.put("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await service.update_user(db, user.current_tenant_id, user.id, user_id, data)
    return {"data": result.model_dump(), "message": "User updated successfully"}
