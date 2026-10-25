import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List, Tuple
from sqlalchemy import select, func, and_, or_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import ValidationException, NotFoundException
from app.modules.stock.models import (
    StockBalance,
    StockMovement,
    StockLayer,
    StockTransfer,
    StockTransferItem,
    StockAdjustment,
)
from app.modules.catalogue.models import ProductVariant, Product
from app.modules.settings.models import Location, StockCondition, Category
from app.modules.auth.models import User
from app.modules.stock.schemas import (
    OpeningStockBatchRequest,
    StockTransferCreate,
    StockTransferReceiveRequest,
    ConditionChangeRequest,
    StockAdjustmentCreate,
    AgeingSummaryResponse,
    AgeingItemResponse,
    ReconciliationResponse,
    ReconciliationMismatch,
    LowStockItemResponse,
)


class StockService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _get_or_create_balance(
        self,
        tenant_id: uuid.UUID,
        variant_id: uuid.UUID,
        location_id: uuid.UUID,
        condition_id: uuid.UUID,
        for_update: bool = True,
    ) -> StockBalance:
        """Finds or initializes a stock balance row with row-level locking."""
        stmt = select(StockBalance).where(
            StockBalance.tenant_id == tenant_id,
            StockBalance.variant_id == variant_id,
            StockBalance.location_id == location_id,
            StockBalance.condition_id == condition_id,
        )
        if for_update:
            stmt = stmt.with_for_update()

        result = await self.session.execute(stmt)
        balance = result.scalar_one_or_none()

        if not balance:
            balance = StockBalance(
                tenant_id=tenant_id,
                variant_id=variant_id,
                location_id=location_id,
                condition_id=condition_id,
                quantity=Decimal("0.000"),
                reserved_quantity=Decimal("0.000"),
            )
            self.session.add(balance)
            await self.session.flush()

        return balance

    async def record_movement(
        self,
        tenant_id: uuid.UUID,
        movement_type: str,
        variant_id: uuid.UUID,
        location_id: uuid.UUID,
        condition_id: uuid.UUID,
        quantity: Decimal,
        user_id: Optional[uuid.UUID] = None,
        unit_cost: Optional[Decimal] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[uuid.UUID] = None,
        reference_number: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Tuple[StockMovement, StockBalance]:
        """
        The single atomic primitive for altering stock.
        Guarantees zero-negative-stock and appends an immutable movement record.
        """
        balance = await self._get_or_create_balance(
            tenant_id=tenant_id,
            variant_id=variant_id,
            location_id=location_id,
            condition_id=condition_id,
            for_update=True,
        )

        new_quantity = balance.quantity + quantity
        if new_quantity < Decimal("0.000"):
            raise ValidationException(
                f"Insufficient stock. Available on hand is {balance.quantity}, but tried to deduct {abs(quantity)}."
            )

        # Ensure reserved stock does not exceed remaining quantity
        if balance.reserved_quantity > new_quantity:
            raise ValidationException(
                f"Cannot reduce stock to {new_quantity} because {balance.reserved_quantity} is currently reserved."
            )

        balance.quantity = new_quantity

        movement = StockMovement(
            tenant_id=tenant_id,
            movement_type=movement_type,
            variant_id=variant_id,
            location_id=location_id,
            condition_id=condition_id,
            quantity=quantity,
            balance_after=new_quantity,
            unit_cost=unit_cost,
            reference_type=reference_type,
            reference_id=reference_id,
            reference_number=reference_number,
            notes=notes,
            created_by=user_id,
        )
        self.session.add(movement)
        await self.session.flush()

        return movement, balance

    async def record_opening_stock_batch(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        batch_req: OpeningStockBatchRequest,
    ) -> List[StockMovement]:
        """Batch intake of opening inventory balances and FIFO receipt layers."""
        movements = []
        ref_num = batch_req.batch_reference or f"OPN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        for item in batch_req.items:
            rec_date = item.received_date or date.today()
            movement, _ = await self.record_movement(
                tenant_id=tenant_id,
                movement_type="OPENING_STOCK",
                variant_id=item.variant_id,
                location_id=item.location_id,
                condition_id=item.condition_id,
                quantity=item.quantity,
                user_id=user_id,
                unit_cost=item.unit_cost,
                reference_type="opening_entry",
                reference_number=ref_num,
                notes=item.notes or "Opening stock entry",
            )
            movements.append(movement)

            # Create FIFO receipt layer
            layer = StockLayer(
                tenant_id=tenant_id,
                variant_id=item.variant_id,
                location_id=item.location_id,
                condition_id=item.condition_id,
                initial_quantity=item.quantity,
                remaining_quantity=item.quantity,
                unit_cost=item.unit_cost,
                received_date=rec_date,
                movement_id=movement.id,
            )
            self.session.add(layer)

        await self.session.commit()
        return movements

    async def create_transfer(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        transfer_data: StockTransferCreate,
        dispatch_immediately: bool = True,
    ) -> StockTransfer:
        """Creates an inter-location stock transfer and optionally dispatches it immediately."""
        if transfer_data.source_location_id == transfer_data.destination_location_id:
            raise ValidationException("Source and destination locations cannot be identical.")

        if not transfer_data.items:
            raise ValidationException("At least one item is required for a stock transfer.")

        # Generate transfer number
        count_stmt = select(func.count(StockTransfer.id)).where(StockTransfer.tenant_id == tenant_id)
        count_res = await self.session.execute(count_stmt)
        seq = (count_res.scalar() or 0) + 1
        transfer_num = f"TRF-{seq:05d}"

        transfer = StockTransfer(
            tenant_id=tenant_id,
            transfer_number=transfer_num,
            source_location_id=transfer_data.source_location_id,
            destination_location_id=transfer_data.destination_location_id,
            status="DRAFT",
            notes=transfer_data.notes,
            created_by=user_id,
        )
        self.session.add(transfer)
        await self.session.flush()

        for it in transfer_data.items:
            t_item = StockTransferItem(
                transfer_id=transfer.id,
                variant_id=it.variant_id,
                condition_id=it.condition_id,
                quantity=it.quantity,
                received_quantity=Decimal("0.000"),
            )
            self.session.add(t_item)
        await self.session.flush()

        if dispatch_immediately:
            await self.dispatch_transfer(tenant_id, user_id, transfer.id)

        await self.session.commit()
        return await self.get_transfer(tenant_id, transfer.id)

    async def dispatch_transfer(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        transfer_id: uuid.UUID,
    ) -> StockTransfer:
        """Dispatches transfer: decrements source location stock and logs TRANSFER_OUT."""
        stmt = (
            select(StockTransfer)
            .where(StockTransfer.id == transfer_id, StockTransfer.tenant_id == tenant_id)
            .options(selectinload(StockTransfer.items))
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        transfer = result.scalar_one_or_none()
        if not transfer:
            raise NotFoundException("Transfer", str(transfer_id))

        if transfer.status != "DRAFT":
            raise ValidationException(f"Cannot dispatch transfer with status '{transfer.status}'.")

        for item in transfer.items:
            await self.record_movement(
                tenant_id=tenant_id,
                movement_type="TRANSFER_OUT",
                variant_id=item.variant_id,
                location_id=transfer.source_location_id,
                condition_id=item.condition_id,
                quantity=-item.quantity,
                user_id=user_id,
                reference_type="transfer",
                reference_id=transfer.id,
                reference_number=transfer.transfer_number,
                notes=f"Dispatched via transfer {transfer.transfer_number}",
            )

        transfer.status = "DISPATCHED"
        transfer.dispatched_at = datetime.now(timezone.utc)
        transfer.dispatched_by = user_id
        await self.session.flush()
        return transfer

    async def receive_transfer(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        transfer_id: uuid.UUID,
        receive_req: Optional[StockTransferReceiveRequest] = None,
    ) -> StockTransfer:
        """Receives transfer: increments destination location stock and logs TRANSFER_IN."""
        stmt = (
            select(StockTransfer)
            .where(StockTransfer.id == transfer_id, StockTransfer.tenant_id == tenant_id)
            .options(selectinload(StockTransfer.items))
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        transfer = result.scalar_one_or_none()
        if not transfer:
            raise NotFoundException("Transfer", str(transfer_id))

        if transfer.status != "DISPATCHED":
            raise ValidationException(f"Cannot receive transfer with status '{transfer.status}'. Must be DISPATCHED.")

        rcv_map = {}
        if receive_req and receive_req.items:
            rcv_map = {item.item_id: item.received_quantity for item in receive_req.items}

        for item in transfer.items:
            qty_to_receive = rcv_map.get(item.id, item.quantity)
            item.received_quantity = qty_to_receive

            await self.record_movement(
                tenant_id=tenant_id,
                movement_type="TRANSFER_IN",
                variant_id=item.variant_id,
                location_id=transfer.destination_location_id,
                condition_id=item.condition_id,
                quantity=qty_to_receive,
                user_id=user_id,
                reference_type="transfer",
                reference_id=transfer.id,
                reference_number=transfer.transfer_number,
                notes=f"Received via transfer {transfer.transfer_number}",
            )

        transfer.status = "RECEIVED"
        transfer.received_at = datetime.now(timezone.utc)
        transfer.received_by = user_id
        if receive_req and receive_req.notes:
            transfer.notes = f"{transfer.notes or ''}\n[Receipt Note]: {receive_req.notes}".strip()

        await self.session.commit()
        return await self.get_transfer(tenant_id, transfer.id)

    async def change_condition(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        req: ConditionChangeRequest,
    ) -> Tuple[StockMovement, StockMovement]:
        """Moves stock between conditions (e.g. Good to Damaged/Display) with zero net change to physical count."""
        if req.from_condition_id == req.to_condition_id:
            raise ValidationException("Source and target condition cannot be identical.")

        # 1. Deduct from source condition
        m_out, _ = await self.record_movement(
            tenant_id=tenant_id,
            movement_type="CONDITION_CHANGE",
            variant_id=req.variant_id,
            location_id=req.location_id,
            condition_id=req.from_condition_id,
            quantity=-req.quantity,
            user_id=user_id,
            reference_type="condition_change",
            notes=f"Condition change out: {req.notes or 'No reason provided'}",
        )

        # 2. Add to target condition
        m_in, _ = await self.record_movement(
            tenant_id=tenant_id,
            movement_type="CONDITION_CHANGE",
            variant_id=req.variant_id,
            location_id=req.location_id,
            condition_id=req.to_condition_id,
            quantity=req.quantity,
            user_id=user_id,
            reference_type="condition_change",
            notes=f"Condition change in: {req.notes or 'No reason provided'}",
        )

        await self.session.commit()
        return m_out, m_in

    async def record_adjustment(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        adj_data: StockAdjustmentCreate,
    ) -> StockAdjustment:
        """Records an audited stock adjustment for clerical/physical count discrepancy."""
        if adj_data.quantity_delta == Decimal("0"):
            raise ValidationException("Adjustment quantity delta must be non-zero.")

        count_stmt = select(func.count(StockAdjustment.id)).where(StockAdjustment.tenant_id == tenant_id)
        count_res = await self.session.execute(count_stmt)
        seq = (count_res.scalar() or 0) + 1
        adj_num = f"ADJ-{seq:05d}"

        adjustment = StockAdjustment(
            tenant_id=tenant_id,
            adjustment_number=adj_num,
            variant_id=adj_data.variant_id,
            location_id=adj_data.location_id,
            condition_id=adj_data.condition_id,
            quantity_delta=adj_data.quantity_delta,
            reason_code=adj_data.reason_code,
            notes=adj_data.notes,
            created_by=user_id,
        )
        self.session.add(adjustment)
        await self.session.flush()

        await self.record_movement(
            tenant_id=tenant_id,
            movement_type="ADJUSTMENT",
            variant_id=adj_data.variant_id,
            location_id=adj_data.location_id,
            condition_id=adj_data.condition_id,
            quantity=adj_data.quantity_delta,
            user_id=user_id,
            reference_type="adjustment",
            reference_id=adjustment.id,
            reference_number=adj_num,
            notes=f"Reason: {adj_data.reason_code} - {adj_data.notes or ''}",
        )

        await self.session.commit()
        return adjustment

    async def get_transfer(self, tenant_id: uuid.UUID, transfer_id: uuid.UUID) -> StockTransfer:
        stmt = (
            select(StockTransfer)
            .where(StockTransfer.id == transfer_id, StockTransfer.tenant_id == tenant_id)
            .options(
                selectinload(StockTransfer.source_location),
                selectinload(StockTransfer.destination_location),
                selectinload(StockTransfer.items).selectinload(StockTransferItem.variant).selectinload(ProductVariant.product),
                selectinload(StockTransfer.items).selectinload(StockTransferItem.condition),
            )
        )
        result = await self.session.execute(stmt)
        transfer = result.scalar_one_or_none()
        if not transfer:
            raise NotFoundException("Transfer", str(transfer_id))
        return transfer

    async def list_transfers(
        self,
        tenant_id: uuid.UUID,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[StockTransfer], int]:
        query = select(StockTransfer).where(StockTransfer.tenant_id == tenant_id)
        if status:
            query = query.where(StockTransfer.status == status)

        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0

        query = (
            query.options(
                selectinload(StockTransfer.source_location),
                selectinload(StockTransfer.destination_location),
                selectinload(StockTransfer.items).selectinload(StockTransferItem.variant).selectinload(ProductVariant.product),
                selectinload(StockTransfer.items).selectinload(StockTransferItem.condition),
            )
            .order_by(StockTransfer.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def _resolve_descendant_location_ids(
        self, tenant_id: uuid.UUID, location_id: uuid.UUID
    ) -> List[uuid.UUID]:
        """Resolves location_id and all its child/grandchild locations within the tenant."""
        loc_stmt = select(Location.id, Location.parent_id).where(Location.tenant_id == tenant_id)
        loc_rows = (await self.session.execute(loc_stmt)).all()

        target_ids = {location_id}
        added = True
        while added:
            added = False
            for lid, pid in loc_rows:
                if pid in target_ids and lid not in target_ids:
                    target_ids.add(lid)
                    added = True
        return list(target_ids)

    async def list_balances(
        self,
        tenant_id: uuid.UUID,
        variant_id: Optional[uuid.UUID] = None,
        location_id: Optional[uuid.UUID] = None,
        condition_id: Optional[uuid.UUID] = None,
        is_sellable: Optional[bool] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[dict], int, dict]:
        """Lists stock balances with product, location, and condition details."""
        query = (
            select(
                StockBalance,
                ProductVariant.sku.label("sku"),
                ProductVariant.variant_name.label("variant_name"),
                Product.id.label("product_id"),
                Product.name.label("product_name"),
                Location.name.label("location_name"),
                StockCondition.name.label("condition_name"),
                StockCondition.is_sellable.label("is_sellable"),
            )
            .join(ProductVariant, StockBalance.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .join(Location, StockBalance.location_id == Location.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(StockBalance.tenant_id == tenant_id)
        )

        if variant_id:
            query = query.where(StockBalance.variant_id == variant_id)
        if location_id:
            loc_ids = await self._resolve_descendant_location_ids(tenant_id, location_id)
            query = query.where(StockBalance.location_id.in_(loc_ids))
        if condition_id:
            query = query.where(StockBalance.condition_id == condition_id)
        if is_sellable is not None:
            query = query.where(StockCondition.is_sellable == is_sellable)
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Product.name).like(s),
                    func.lower(ProductVariant.sku).like(s),
                    func.lower(ProductVariant.variant_name).like(s),
                    func.lower(Location.name).like(s),
                )
            )

        # Overall aggregates across the full dataset (not limited by is_sellable or page size)
        agg_stmt = (
            select(
                func.count().label("total_rows"),
                func.coalesce(func.sum(StockBalance.quantity), Decimal("0.000")).label("total_on_hand"),
                func.coalesce(
                    func.sum(
                        case(
                            (StockCondition.is_sellable == True, StockBalance.quantity - StockBalance.reserved_quantity),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ).label("sellable_units"),
                func.coalesce(
                    func.sum(
                        case(
                            (StockCondition.is_sellable == False, StockBalance.quantity),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ).label("display_damaged_units"),
                func.coalesce(func.sum(StockBalance.reserved_quantity), Decimal("0.000")).label("reserved_units"),
            )
            .join(ProductVariant, StockBalance.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .join(Location, StockBalance.location_id == Location.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(StockBalance.tenant_id == tenant_id)
        )

        if variant_id:
            agg_stmt = agg_stmt.where(StockBalance.variant_id == variant_id)
        if location_id:
            agg_stmt = agg_stmt.where(StockBalance.location_id.in_(loc_ids))
        if condition_id:
            agg_stmt = agg_stmt.where(StockBalance.condition_id == condition_id)
        if search:
            agg_stmt = agg_stmt.where(
                or_(
                    func.lower(Product.name).like(s),
                    func.lower(ProductVariant.sku).like(s),
                    func.lower(ProductVariant.variant_name).like(s),
                    func.lower(Location.name).like(s),
                )
            )

        agg_row = (await self.session.execute(agg_stmt)).one()
        if is_sellable is not None:
            count_stmt = (
                select(func.count(StockBalance.id))
                .join(StockCondition, StockBalance.condition_id == StockCondition.id)
                .join(ProductVariant, StockBalance.variant_id == ProductVariant.id)
                .join(Product, ProductVariant.product_id == Product.id)
                .join(Location, StockBalance.location_id == Location.id)
                .where(
                    StockBalance.tenant_id == tenant_id,
                    StockCondition.is_sellable == is_sellable,
                )
            )
            if variant_id:
                count_stmt = count_stmt.where(StockBalance.variant_id == variant_id)
            if location_id:
                count_stmt = count_stmt.where(StockBalance.location_id.in_(loc_ids))
            if condition_id:
                count_stmt = count_stmt.where(StockBalance.condition_id == condition_id)
            if search:
                count_stmt = count_stmt.where(
                    or_(
                        func.lower(Product.name).like(s),
                        func.lower(ProductVariant.sku).like(s),
                        func.lower(ProductVariant.variant_name).like(s),
                        func.lower(Location.name).like(s),
                    )
                )
            total = (await self.session.execute(count_stmt)).scalar() or 0
        else:
            total = agg_row.total_rows or 0
        summary = {
            "total_on_hand": float(agg_row.total_on_hand or 0),
            "sellable_units": float(agg_row.sellable_units or 0),
            "display_damaged_units": float(agg_row.display_damaged_units or 0),
            "reserved_units": float(agg_row.reserved_units or 0),
            "total_rows": total,
        }

        query = query.order_by(Product.name.asc(), Location.name.asc()).limit(limit).offset(offset)
        res = await self.session.execute(query)

        rows = []
        for b, sku, v_name, p_id, p_name, loc_name, cond_name, is_sellable in res.all():
            available = b.quantity - b.reserved_quantity
            rows.append({
                "id": b.id,
                "variant_id": b.variant_id,
                "product_id": p_id,
                "product_name": p_name,
                "variant_name": v_name,
                "sku": sku,
                "location_id": b.location_id,
                "location_name": loc_name,
                "condition_id": b.condition_id,
                "condition_name": cond_name,
                "is_sellable": is_sellable,
                "quantity": b.quantity,
                "reserved_quantity": b.reserved_quantity,
                "available_quantity": available,
                "updated_at": b.updated_at,
            })
        return rows, total, summary

    async def list_movements(
        self,
        tenant_id: uuid.UUID,
        variant_id: Optional[uuid.UUID] = None,
        location_id: Optional[uuid.UUID] = None,
        movement_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[dict], int]:
        query = (
            select(
                StockMovement,
                ProductVariant.sku.label("sku"),
                ProductVariant.variant_name.label("variant_name"),
                Product.name.label("product_name"),
                Location.name.label("location_name"),
                StockCondition.name.label("condition_name"),
                User.full_name.label("creator_name"),
            )
            .join(ProductVariant, StockMovement.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .join(Location, StockMovement.location_id == Location.id)
            .join(StockCondition, StockMovement.condition_id == StockCondition.id)
            .outerjoin(User, StockMovement.created_by == User.id)
            .where(StockMovement.tenant_id == tenant_id)
        )

        if variant_id:
            query = query.where(StockMovement.variant_id == variant_id)
        if location_id:
            loc_ids = await self._resolve_descendant_location_ids(tenant_id, location_id)
            query = query.where(StockMovement.location_id.in_(loc_ids))
        if movement_type:
            query = query.where(StockMovement.movement_type == movement_type)

        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0

        query = query.order_by(StockMovement.created_at.desc()).limit(limit).offset(offset)
        res = await self.session.execute(query)

        rows = []
        for m, sku, v_name, p_name, loc_name, cond_name, creator_name in res.all():
            rows.append({
                "id": m.id,
                "movement_type": m.movement_type,
                "variant_id": m.variant_id,
                "product_name": p_name,
                "variant_name": v_name,
                "sku": sku,
                "location_id": m.location_id,
                "location_name": loc_name,
                "condition_id": m.condition_id,
                "condition_name": cond_name,
                "quantity": m.quantity,
                "balance_after": m.balance_after,
                "unit_cost": m.unit_cost,
                "reference_type": m.reference_type,
                "reference_id": m.reference_id,
                "reference_number": m.reference_number,
                "notes": m.notes,
                "created_by_name": creator_name,
                "created_at": m.created_at,
            })
        return rows, total

    async def get_ageing_report(self, tenant_id: uuid.UUID) -> AgeingSummaryResponse:
        """Computes stock ageing bands (0-30, 31-60, 61-90, 91-180, 180+) using FIFO receipt layers."""
        today = date.today()
        stmt = (
            select(
                StockLayer,
                ProductVariant.sku.label("sku"),
                Product.name.label("product_name"),
                Category.name.label("category_name"),
            )
            .join(ProductVariant, StockLayer.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .where(StockLayer.tenant_id == tenant_id, StockLayer.remaining_quantity > 0)
        )
        res = await self.session.execute(stmt)
        layers = res.all()

        band_totals = {
            "0-30 days": Decimal("0.000"),
            "31-60 days": Decimal("0.000"),
            "61-90 days": Decimal("0.000"),
            "91-180 days": Decimal("0.000"),
            "180+ days": Decimal("0.000"),
        }
        total_val = Decimal("0.00")
        total_qty = Decimal("0.000")

        item_map = {}
        for layer, sku, p_name, cat_name in layers:
            age_days = (today - layer.received_date).days
            if age_days <= 30:
                band = "0-30 days"
            elif age_days <= 60:
                band = "31-60 days"
            elif age_days <= 90:
                band = "61-90 days"
            elif age_days <= 180:
                band = "91-180 days"
            else:
                band = "180+ days"

            qty = layer.remaining_quantity
            val = qty * layer.unit_cost

            band_totals[band] += qty
            total_qty += qty
            total_val += val

            v_id = layer.variant_id
            if v_id not in item_map:
                item_map[v_id] = {
                    "variant_id": v_id,
                    "sku": sku,
                    "product_name": p_name,
                    "category_name": cat_name,
                    "total_quantity": Decimal("0.000"),
                    "total_valuation": Decimal("0.00"),
                    "bands": {k: Decimal("0.000") for k in band_totals.keys()},
                }
            item_map[v_id]["total_quantity"] += qty
            item_map[v_id]["total_valuation"] += val
            item_map[v_id]["bands"][band] += qty

        items = [AgeingItemResponse(**data) for data in item_map.values()]
        return AgeingSummaryResponse(
            total_valuation=total_val,
            total_quantity=total_qty,
            bands=band_totals,
            items=items,
        )

    async def get_reconciliation(self, tenant_id: uuid.UUID) -> ReconciliationResponse:
        """Verifies mathematical equality between the movement ledger and current stock balance running totals."""
        m_stmt = (
            select(
                StockMovement.variant_id,
                StockMovement.location_id,
                StockMovement.condition_id,
                func.sum(StockMovement.quantity).label("movement_sum"),
            )
            .where(StockMovement.tenant_id == tenant_id)
            .group_by(StockMovement.variant_id, StockMovement.location_id, StockMovement.condition_id)
        )
        m_res = await self.session.execute(m_stmt)
        m_sums = {
            (r.variant_id, r.location_id, r.condition_id): r.movement_sum or Decimal("0")
            for r in m_res.all()
        }

        b_stmt = (
            select(
                StockBalance,
                ProductVariant.sku.label("sku"),
                Product.name.label("product_name"),
                Location.name.label("location_name"),
                StockCondition.name.label("condition_name"),
            )
            .join(ProductVariant, StockBalance.variant_id == ProductVariant.id)
            .join(Product, ProductVariant.product_id == Product.id)
            .join(Location, StockBalance.location_id == Location.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(StockBalance.tenant_id == tenant_id)
        )
        b_res = await self.session.execute(b_stmt)
        balances = b_res.all()

        mismatches = []
        for b, sku, p_name, loc_name, cond_name in balances:
            key = (b.variant_id, b.location_id, b.condition_id)
            mov_sum = m_sums.get(key, Decimal("0.000"))
            if mov_sum != b.quantity:
                mismatches.append(
                    ReconciliationMismatch(
                        variant_id=b.variant_id,
                        sku=sku,
                        product_name=p_name,
                        location_id=b.location_id,
                        location_name=loc_name,
                        condition_id=b.condition_id,
                        condition_name=cond_name,
                        movement_sum=mov_sum,
                        balance_recorded=b.quantity,
                        difference=b.quantity - mov_sum,
                    )
                )

        return ReconciliationResponse(
            is_balanced=len(mismatches) == 0,
            total_checked=len(balances),
            mismatches=mismatches,
        )

    async def get_low_stock(self, tenant_id: uuid.UUID) -> List[LowStockItemResponse]:
        """Identifies variants whose available sellable stock is below reorder thresholds."""
        stmt = (
            select(
                ProductVariant.id.label("variant_id"),
                ProductVariant.product_id.label("product_id"),
                ProductVariant.sku.label("sku"),
                Product.name.label("product_name"),
                Category.name.label("category_name"),
                ProductVariant.reorder_point.label("reorder_point"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                StockCondition.is_sellable.is_(True),
                                StockBalance.quantity - StockBalance.reserved_quantity,
                            ),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ).label("available_qty"),
            )
            .join(Product, ProductVariant.product_id == Product.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .outerjoin(
                StockBalance,
                and_(
                    StockBalance.variant_id == ProductVariant.id,
                    StockBalance.tenant_id == tenant_id,
                ),
            )
            .outerjoin(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                ProductVariant.tenant_id == tenant_id,
                ProductVariant.is_active.is_(True),
                ProductVariant.reorder_point > 0,
            )
            .group_by(
                ProductVariant.id,
                ProductVariant.product_id,
                ProductVariant.sku,
                Product.name,
                Category.name,
                ProductVariant.reorder_point,
            )
        )
        res = await self.session.execute(stmt)
        low_stock_items = []
        for row in res.all():
            reorder = row.reorder_point or Decimal("0")
            avail = row.available_qty or Decimal("0")
            if avail <= reorder:
                low_stock_items.append(
                    LowStockItemResponse(
                        variant_id=row.variant_id,
                        product_id=row.product_id,
                        sku=row.sku,
                        product_name=row.product_name,
                        category_name=row.category_name,
                        reorder_point=reorder,
                        available_quantity=avail,
                        shortfall=reorder - avail,
                    )
                )
        return low_stock_items

    async def get_product_stock_mapping(self, tenant_id: uuid.UUID, product_id: uuid.UUID) -> dict:
        prod_res = await self.session.execute(
            select(Product)
            .options(
                selectinload(Product.variants),
                selectinload(Product.category),
                selectinload(Product.brand),
            )
            .where(Product.id == product_id, Product.tenant_id == tenant_id)
        )
        product = prod_res.scalar_one_or_none()
        if not product:
            raise NotFoundException("Product", str(product_id))

        variant_ids = [v.id for v in product.variants]
        if not variant_ids:
            return {
                "product": {
                    "id": str(product.id),
                    "name": product.name,
                    "model": product.model,
                    "category_name": product.category.name if product.category else None,
                    "brand_name": product.brand.name if product.brand else None,
                    "variants": [],
                },
                "summary": {
                    "total_stock": 0.0,
                    "available_to_sell": 0.0,
                    "total_sold": 0.0,
                },
                "locations": [],
            }

        # 1. Total stock across all locations
        stock_stmt = (
            select(
                func.coalesce(func.sum(StockBalance.quantity), Decimal("0.000")).label("total_stock"),
                func.coalesce(
                    func.sum(
                        case(
                            (StockCondition.is_sellable == True, StockBalance.quantity),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                ).label("available_to_sell"),
            )
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                StockBalance.tenant_id == tenant_id,
                StockBalance.variant_id.in_(variant_ids),
            )
        )
        stock_row = (await self.session.execute(stock_stmt)).one()

        # 2. Total sold
        sold_stmt = (
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (StockMovement.movement_type.in_(["SALE", "OUTWARD_SALE", "DISPATCH", "CUSTOMER_ORDER", "INVOICE"]), func.abs(StockMovement.quantity)),
                            else_=Decimal("0.000"),
                        )
                    ),
                    Decimal("0.000"),
                )
            ).where(
                StockMovement.tenant_id == tenant_id,
                StockMovement.variant_id.in_(variant_ids),
            )
        )
        total_sold = (await self.session.execute(sold_stmt)).scalar() or Decimal("0.000")

        # 3. Locations that currently hold stock (strictly quantity > 0)
        loc_stmt = (
            select(
                StockBalance,
                ProductVariant.sku,
                ProductVariant.variant_name,
                Location.name.label("location_name"),
                Location.code.label("location_code"),
                StockCondition.name.label("condition_name"),
                StockCondition.is_sellable.label("is_sellable"),
            )
            .join(ProductVariant, StockBalance.variant_id == ProductVariant.id)
            .join(Location, StockBalance.location_id == Location.id)
            .join(StockCondition, StockBalance.condition_id == StockCondition.id)
            .where(
                StockBalance.tenant_id == tenant_id,
                StockBalance.variant_id.in_(variant_ids),
                StockBalance.quantity > 0,
            )
            .order_by(Location.sort_order, Location.name)
        )
        loc_res = await self.session.execute(loc_stmt)
        locations_list = []
        for b, sku, v_name, loc_name, loc_code, cond_name, is_sellable in loc_res.all():
            locations_list.append({
                "balance_id": str(b.id),
                "variant_id": str(b.variant_id),
                "sku": sku,
                "variant_name": v_name,
                "location_id": str(b.location_id),
                "location_name": loc_name,
                "location_code": loc_code,
                "condition_id": str(b.condition_id),
                "condition_name": cond_name,
                "is_sellable": is_sellable,
                "quantity": float(b.quantity),
            })

        variants_data = [
            {
                "id": str(v.id),
                "sku": v.sku,
                "variant_name": v.variant_name,
                "purchase_price": float(v.purchase_price) if v.purchase_price else 0,
                "selling_price": float(v.selling_price) if v.selling_price else 0,
                "mrp": float(v.mrp) if v.mrp else None,
            }
            for v in product.variants
        ]

        return {
            "product": {
                "id": str(product.id),
                "name": product.name,
                "model": product.model,
                "category_name": product.category.name if product.category else None,
                "brand_name": product.brand.name if product.brand else None,
                "variants": variants_data,
            },
            "summary": {
                "total_stock": float(stock_row.total_stock or 0),
                "available_to_sell": float(stock_row.available_to_sell or 0),
                "total_sold": float(total_sold or 0),
            },
            "locations": locations_list,
        }

    async def allocate_product_stock(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID],
        product_id: uuid.UUID,
        variant_id: uuid.UUID,
        location_id: uuid.UUID,
        quantity: Decimal,
        condition_id: Optional[uuid.UUID] = None,
        mode: str = "set_total",
        notes: Optional[str] = None,
    ) -> dict:
        # Validate variant belongs to product & tenant
        var_res = await self.session.execute(
            select(ProductVariant).where(
                ProductVariant.id == variant_id,
                ProductVariant.product_id == product_id,
                ProductVariant.tenant_id == tenant_id,
            )
        )
        variant = var_res.scalar_one_or_none()
        if not variant:
            raise NotFoundException("ProductVariant", str(variant_id))

        # Validate location
        loc_res = await self.session.execute(
            select(Location).where(Location.id == location_id, Location.tenant_id == tenant_id)
        )
        if not loc_res.scalar_one_or_none():
            raise NotFoundException("Location", str(location_id))

        # Default condition if not provided
        if not condition_id:
            cond_res = await self.session.execute(
                select(StockCondition).where(
                    StockCondition.tenant_id == tenant_id,
                    StockCondition.is_sellable == True,
                ).order_by(StockCondition.sort_order)
            )
            cond = cond_res.scalars().first()
            if not cond:
                cond_any = await self.session.execute(
                    select(StockCondition).where(StockCondition.tenant_id == tenant_id)
                )
                cond = cond_any.scalars().first()
            if not cond:
                raise NotFoundException("StockCondition", "default")
            condition_id = cond.id
        else:
            cond_res = await self.session.execute(
                select(StockCondition).where(StockCondition.id == condition_id, StockCondition.tenant_id == tenant_id)
            )
            if not cond_res.scalar_one_or_none():
                raise NotFoundException("StockCondition", str(condition_id))

        balance = await self._get_or_create_balance(
            tenant_id=tenant_id,
            variant_id=variant_id,
            location_id=location_id,
            condition_id=condition_id,
            for_update=True,
        )

        diff = Decimal("0.000")
        if mode == "set_total":
            diff = quantity - balance.quantity
        else:  # mode == "add"
            diff = quantity

        if diff != Decimal("0.000"):
            await self.record_movement(
                tenant_id=tenant_id,
                movement_type="STOCK_MAPPING",
                variant_id=variant_id,
                location_id=location_id,
                condition_id=condition_id,
                quantity=diff,
                user_id=user_id,
                notes=notes or f"Stock mapping allocation ({mode})",
            )
            await self.session.commit()

        return await self.get_product_stock_mapping(tenant_id, product_id)

