from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.mobile import service
from app.modules.mobile.constants import MOBILE_TILES
from app.modules.mobile.schemas import MobileLoginRequest

router = APIRouter(prefix="/mobile", tags=["Mobile PWA"])


@router.get("/tiles")
async def list_mobile_tiles():
    """Return available mobile tile definitions."""
    return {"data": MOBILE_TILES}


@router.post("/login", status_code=status.HTTP_200_OK)
async def login_with_pin(
    data: MobileLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await service.mobile_login(db, data)
    if result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=7 * 24 * 3600,
        )
    return {
        "data": result.model_dump(),
        "message": "Select business to continue" if result.requires_business_selection else "Logged in successfully",
    }


@router.get("/me")
async def mobile_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await service.get_mobile_me(db, user)
    return {"data": result.model_dump()}
