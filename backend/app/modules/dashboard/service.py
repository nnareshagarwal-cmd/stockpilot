import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalogue.models import Product, ProductVariant
from app.modules.stock.models import StockBalance, StockLayer, StockTransfer
from app.modules.settings.models import StockCondition
from app.modules.stock.service import StockService
from app.modules.auth.models import User, Business
from app.modules.dashboard.schemas import (
    InventorySummarySchema,
    StockHealthSchema,
    AgeingBandSchema,
    DashboardAgeingSchema,
    ActionRequiredSchema,
    RecentStockActivitySchema,
    DashboardSummaryResponse,
)


def _format_activity_label(movement_type: str, quantity: Decimal) -> str:
    mt = (movement_type or "").upper()
    if mt == "OPENING_STOCK":
        return "Opening Stock"
    elif mt == "CONDITION_CHANGE":
        return "Condition Change"
    elif mt == "TRANSFER_IN":
        return "Stock Transfer (In)"
    elif mt == "TRANSFER_OUT":
        return "Stock Transfer (Out)"
    elif mt == "TRANSFER":
        return "Stock Transfer"
    elif mt in ("ADJUSTMENT", "STOCK_MAPPING"):
        return "Stock Adjustment"
    elif mt in ("STOCK_IN", "PURCHASE_RECEIPT", "RECEIPT"):
        return "Stock Received"
    elif mt in ("STOCK_OUT", "ISSUE", "SALE", "DISPATCH"):
        return "Stock Issued"
    else:
        if quantity > Decimal("0.000"):
            return "Stock Received"
        elif quantity < Decimal("0.000"):
            return "Stock Issued"
        return mt.replace("_", " ").title()


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.stock_service = StockService(session)

    async def get_summary(
        self,
        tenant_id: uuid.UUID,
        user: User,
    ) -> DashboardSummaryResponse:
        """
        Consolidated inventory dashboard summary adhering to all Stage 1 & 2 business rules:
        - Product count: Active products in tenant catalog.
        - Total stock: Total physical quantity on hand across all locations/conditions.
        - Available stock: Sellable quantity available after deducting reservations.
        - Reserved stock: Currently allocated/reserved stock.
        - Inventory valuation & ageing: FIFO cost basis derived from remaining FIFO stock layers.
        - Stock Health:
          * Low Stock: Distinct products having variants with available stock <= positive reorder point.
          * Out of Stock: Active products with zero available sellable quantity after reservations.
          * Damaged / Non-sellable: Total physical stock in non-sellable conditions.
          * Products with stock: Active products with physical sellable stock > 0.
        - Action Required:
          * Replenishment: Distinct products below reorder point.
          * Out of stock: Products with 0 sellable units.
          * Pending transfers: Transfers awaiting receipt (DISPATCHED).
          * Stock reconciliation: Discrepancy check between ledger and balance totals.
        - Recent Stock Activity:
          * Latest 10 inventory transactions ordered by created_at DESC with readable activity labels.
        """
        # 1. Total active products
        total_prod_stmt = select(func.count(Product.id)).where(
            Product.tenant_id == tenant_id,
            Product.is_active == True,
        )
        total_products = (await self.session.execute(total_prod_stmt)).scalar() or 0

        # 2. Aggregated stock quantities from StockBalance
        agg_stmt = (
            select(
                func.coalesce(func.sum(StockBalance.quantity), Decimal("0.000")).label("total_stock"),
                func.coalesce(func.sum(StockBalance.reserved_quantity), Decimal("0.000")).label("reserved_stock"),
                func.coalesce(
                    func.sum(
                        case(
                            (StockCondition.is_sellable == True, StockBalance.quantity - StockBalance.reserved_quantity),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ).label("available_stock"),
                func.coalesce(
                    func.sum(
                        case(
                            (StockCondition.is_sellable == False, StockBalance.quantity),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ).label("damaged_stock"),
            )
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(StockBalance.tenant_id == tenant_id)
        )
        agg_row = (await self.session.execute(agg_stmt)).one()

        total_stock = agg_row.total_stock or Decimal("0.000")
        reserved_stock = agg_row.reserved_stock or Decimal("0.000")
        available_stock = agg_row.available_stock or Decimal("0.000")
        damaged_stock = agg_row.damaged_stock or Decimal("0.000")

        # 3. Products with available sellable stock vs Out of stock products
        sellable_stock_subq = (
            select(ProductVariant.product_id)
            .join(StockBalance, StockBalance.variant_id == ProductVariant.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                StockBalance.tenant_id == tenant_id,
                StockCondition.is_sellable == True,
                (StockBalance.quantity - StockBalance.reserved_quantity) > Decimal("0.000"),
            )
            .group_by(ProductVariant.product_id)
        )
        stocked_prod_stmt = select(func.count(Product.id)).where(
            Product.tenant_id == tenant_id,
            Product.is_active == True,
            Product.id.in_(sellable_stock_subq),
        )
        products_with_stock = (await self.session.execute(stocked_prod_stmt)).scalar() or 0
        out_of_stock_products = max(0, total_products - products_with_stock)

        # 4. Low stock products (distinct products, deduplicated from variant-level alerts)
        low_stock_items = await self.stock_service.get_low_stock(tenant_id)
        distinct_low_stock_product_ids = {item.product_id for item in low_stock_items if item.product_id}
        low_stock_count = len(distinct_low_stock_product_ids)

        # 5. Inventory Valuation & Ageing (Single Pass on FIFO Stock Layers)
        can_view_valuation = getattr(user, "is_active", True)
        today = date.today()

        layer_stmt = select(StockLayer).where(
            StockLayer.tenant_id == tenant_id,
            StockLayer.remaining_quantity > Decimal("0.000"),
        )
        layer_res = await self.session.execute(layer_stmt)
        layers = layer_res.scalars().all()

        bands_data = {
            "Fresh": {"category": "Fresh", "period": "0–30 days", "qty": Decimal("0.000"), "val": Decimal("0.00")},
            "Moderate": {"category": "Moderate", "period": "31–60 days", "qty": Decimal("0.000"), "val": Decimal("0.00")},
            "Ageing": {"category": "Ageing", "period": "61–90 days", "qty": Decimal("0.000"), "val": Decimal("0.00")},
            "Old": {"category": "Old", "period": "91–180 days", "qty": Decimal("0.000"), "val": Decimal("0.00")},
            "Very Old": {"category": "Very Old", "period": "180+ days", "qty": Decimal("0.000"), "val": Decimal("0.00")},
        }

        total_valuation = Decimal("0.00")
        total_layer_qty = Decimal("0.000")

        for layer in layers:
            age_days = (today - layer.received_date).days
            if age_days <= 30:
                band_key = "Fresh"
            elif age_days <= 60:
                band_key = "Moderate"
            elif age_days <= 90:
                band_key = "Ageing"
            elif age_days <= 180:
                band_key = "Old"
            else:
                band_key = "Very Old"

            qty = layer.remaining_quantity
            val = qty * layer.unit_cost

            bands_data[band_key]["qty"] += qty
            bands_data[band_key]["val"] += val
            total_layer_qty += qty
            total_valuation += val

        ageing_bands = []
        for key in ["Fresh", "Moderate", "Ageing", "Old", "Very Old"]:
            b = bands_data[key]
            pct = round(float(b["val"] / total_valuation * 100), 1) if total_valuation > Decimal("0.00") else 0.0
            ageing_bands.append(
                AgeingBandSchema(
                    category=b["category"],
                    period=b["period"],
                    quantity=b["qty"],
                    valuation=b["val"],
                    percentage=pct,
                )
            )

        dashboard_ageing = DashboardAgeingSchema(
            total_valuation=total_valuation,
            total_quantity=total_layer_qty,
            bands=ageing_bands,
        )

        # 6. Action Required
        # Pending transfers: genuinely awaiting receipt (status == 'DISPATCHED')
        pending_trf_stmt = select(func.count(StockTransfer.id)).where(
            StockTransfer.tenant_id == tenant_id,
            StockTransfer.status == "DISPATCHED",
        )
        pending_transfers = (await self.session.execute(pending_trf_stmt)).scalar() or 0

        # Stock reconciliation: check mathematical equality of movement sum and recorded balance
        reconciliation_res = await self.stock_service.get_reconciliation(tenant_id)
        action_required = ActionRequiredSchema(
            replenishment_products=low_stock_count,
            out_of_stock_products=out_of_stock_products,
            pending_transfers=pending_transfers,
            reconciliation_balanced=reconciliation_res.is_balanced,
            reconciliation_discrepancies=len(reconciliation_res.mismatches),
        )

        # 7. Recent Stock Activity (latest 10 movements)
        movements_raw, _ = await self.stock_service.list_movements(
            tenant_id=tenant_id,
            limit=10,
            offset=0,
        )
        recent_activity = [
            RecentStockActivitySchema(
                id=m["id"],
                created_at=m["created_at"],
                product_name=m["product_name"] or "Unnamed Product",
                variant_name=m["variant_name"],
                sku=m["sku"] or "—",
                movement_type=m["movement_type"],
                activity=_format_activity_label(m["movement_type"], m["quantity"]),
                quantity=m["quantity"],
                location_name=m["location_name"] or "Unknown Location",
                reference_number=m["reference_number"],
            )
            for m in movements_raw
        ]

        # 8. Business details
        biz_stmt = select(Business.name).where(Business.id == tenant_id)
        biz_name = (await self.session.execute(biz_stmt)).scalar_one_or_none()

        return DashboardSummaryResponse(
            inventory=InventorySummarySchema(
                total_products=total_products,
                total_stock=total_stock,
                available_stock=available_stock,
                reserved_stock=reserved_stock,
                inventory_valuation=total_valuation if can_view_valuation else None,
                valuation_basis="FIFO Cost Basis",
                can_view_valuation=can_view_valuation,
            ),
            stock_health=StockHealthSchema(
                low_stock_products=low_stock_count,
                out_of_stock_products=out_of_stock_products,
                damaged_stock=damaged_stock,
                products_with_stock=products_with_stock,
            ),
            ageing=dashboard_ageing if can_view_valuation else None,
            action_required=action_required,
            recent_activity=recent_activity,
            business_id=tenant_id,
            business_name=biz_name,
            user_role=getattr(user, "current_role", "staff"),
        )
