from fastapi import APIRouter, Depends, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    ChangePasswordRequest,
    UpdateProfileRequest,
)
from app.modules.auth import service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await service.register_business(db, data)
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
        "message": "Business registered successfully",
    }


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await service.login_user(db, data)
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
        "message": "Logged in successfully",
    }


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    body: RefreshRequest = None,
    db: AsyncSession = Depends(get_db),
):
    token = None
    if body and body.refresh_token:
        token = body.refresh_token
    elif "refresh_token" in request.cookies:
        token = request.cookies["refresh_token"]

    if not token:
        from app.common.exceptions import UnauthorizedException
        raise UnauthorizedException("No refresh token provided")

    result = await service.refresh_tokens(db, token)
    response.set_cookie(
        key="refresh_token",
        value=result.refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 3600,
    )
    return {"data": result.model_dump()}


@router.post("/logout")
async def logout(response: Response, user: User = Depends(get_current_user)):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await service.get_current_user_info(db, user)
    return {"data": result.model_dump()}


@router.put("/me")
async def update_me(
    data: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await service.update_profile(db, user, data)
    return {"data": result.model_dump(), "message": "Profile updated successfully"}


@router.put("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.change_password(db, user, data)
    return {"message": "Password changed successfully"}
