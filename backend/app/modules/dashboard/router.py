import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_tenant_id
from app.modules.auth.models import User
from app.modules.dashboard.service import DashboardService
from app.modules.dashboard.schemas import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stage 1 Consolidated Dashboard Summary:
    Provides primary KPI cards (Total Products, Total Stock, Available Stock, FIFO Valuation)
    and compact Stock Health section (Low Stock, Out of Stock, Damaged/Non-sellable, In-Stock Products).
    """
    service = DashboardService(db)
    return await service.get_summary(tenant_id=tenant_id, user=current_user)
