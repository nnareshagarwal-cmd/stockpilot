import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.common.exceptions import AppException, app_exception_handler
from app.modules.auth.router import router as auth_router
from app.modules.business.router import router as business_router
from app.modules.users.router import router as users_router
from app.modules.settings.router import router as settings_router
from app.modules.catalogue.router import router as catalogue_router
from app.modules.stock.router import router as stock_router


def create_app() -> FastAPI:
    if settings.ENVIRONMENT == "production" and settings.SECRET_KEY in (
        "dev-secret-key-change-in-production",
        "change-this-to-a-random-64-char-string-in-production",
    ):
        raise RuntimeError("Cannot start with default SECRET_KEY in production!")

    application = FastAPI(
        title=settings.APP_NAME,
        description="Multi-tenant Inventory, Stock & Billing Management System",
        version="0.1.0",
        docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    )

    # CORS
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception Handlers
    application.add_exception_handler(AppException, app_exception_handler)

    # Static file directory for uploads
    upload_path = Path(settings.UPLOAD_DIR)
    upload_path.mkdir(parents=True, exist_ok=True)
    application.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

    # Health check
    @application.get("/api/v1/health", tags=["Health"])
    async def health_check():
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            db_status = "connected"
            is_healthy = True
        except Exception:
            db_status = "unavailable"
            is_healthy = False

        status_code = 200 if is_healthy else 503
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "healthy" if is_healthy else "unhealthy",
                "app": settings.APP_NAME,
                "environment": settings.ENVIRONMENT,
                "database": db_status,
            },
        )

    # API Routers
    api_prefix = "/api/v1"
    application.include_router(auth_router, prefix=api_prefix)
    application.include_router(business_router, prefix=api_prefix)
    application.include_router(users_router, prefix=api_prefix)
    application.include_router(settings_router, prefix=api_prefix)
    application.include_router(catalogue_router, prefix=api_prefix)
    application.include_router(stock_router, prefix=api_prefix)

    return application


app = create_app()
