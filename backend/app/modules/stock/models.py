import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import (
    Column,
    String,
    Boolean,
    ForeignKey,
    Text,
    Numeric,
    Date,
    DateTime,
    func,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.base_model import Base, TimestampMixin, TenantMixin


class StockBalance(Base, TimestampMixin, TenantMixin):
    __tablename__ = "stock_balances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    condition_id = Column(UUID(as_uuid=True), ForeignKey("stock_conditions.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    reserved_quantity = Column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "variant_id", "location_id", "condition_id", name="uq_stock_balance_item"),
        CheckConstraint("quantity >= 0", name="ck_stock_balance_positive_qty"),
        CheckConstraint("reserved_quantity >= 0 AND reserved_quantity <= quantity", name="ck_stock_balance_reserved_qty"),
    )

    # Relationships
    variant = relationship("ProductVariant")
    location = relationship("Location")
    condition = relationship("StockCondition")


class StockMovement(Base, TenantMixin):
    __tablename__ = "stock_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    movement_type = Column(String(50), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    condition_id = Column(UUID(as_uuid=True), ForeignKey("stock_conditions.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    balance_after = Column(Numeric(12, 3), nullable=False)
    unit_cost = Column(Numeric(15, 2), nullable=True)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    variant = relationship("ProductVariant")
    location = relationship("Location")
    condition = relationship("StockCondition")
    creator = relationship("User", foreign_keys=[created_by])


class StockLayer(Base, TimestampMixin, TenantMixin):
    __tablename__ = "stock_layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False)
    condition_id = Column(UUID(as_uuid=True), ForeignKey("stock_conditions.id", ondelete="RESTRICT"), nullable=False)
    initial_quantity = Column(Numeric(12, 3), nullable=False)
    remaining_quantity = Column(Numeric(12, 3), nullable=False, index=True)
    unit_cost = Column(Numeric(15, 2), nullable=False)
    received_date = Column(Date, nullable=False, index=True)
    movement_id = Column(UUID(as_uuid=True), ForeignKey("stock_movements.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        CheckConstraint("remaining_quantity >= 0 AND remaining_quantity <= initial_quantity", name="ck_stock_layers_qty"),
    )

    # Relationships
    variant = relationship("ProductVariant")
    location = relationship("Location")
    condition = relationship("StockCondition")
    movement = relationship("StockMovement")


class StockTransfer(Base, TimestampMixin, TenantMixin):
    __tablename__ = "stock_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_number = Column(String(50), nullable=False)
    source_location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    destination_location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), default="DRAFT", nullable=False, index=True)  # DRAFT, DISPATCHED, RECEIVED, CANCELLED
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    dispatched_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "transfer_number", name="uq_stock_transfers_number"),
        CheckConstraint("status IN ('DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED')", name="ck_stock_transfers_status"),
    )

    # Relationships
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    items = relationship("StockTransferItem", back_populates="transfer", cascade="all, delete-orphan")
    dispatcher = relationship("User", foreign_keys=[dispatched_by])
    receiver = relationship("User", foreign_keys=[received_by])
    creator = relationship("User", foreign_keys=[created_by])


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_id = Column(UUID(as_uuid=True), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False)
    condition_id = Column(UUID(as_uuid=True), ForeignKey("stock_conditions.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    received_quantity = Column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_transfer_item_qty"),
    )

    # Relationships
    transfer = relationship("StockTransfer", back_populates="items")
    variant = relationship("ProductVariant")
    condition = relationship("StockCondition")


class StockAdjustment(Base, TenantMixin):
    __tablename__ = "stock_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    adjustment_number = Column(String(50), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False)
    condition_id = Column(UUID(as_uuid=True), ForeignKey("stock_conditions.id", ondelete="RESTRICT"), nullable=False)
    quantity_delta = Column(Numeric(12, 3), nullable=False)
    reason_code = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "adjustment_number", name="uq_stock_adjustments_number"),
    )

    # Relationships
    variant = relationship("ProductVariant")
    location = relationship("Location")
    condition = relationship("StockCondition")
    creator = relationship("User", foreign_keys=[created_by])
