import uuid
from sqlalchemy import (
    Column,
    String,
    ForeignKey,
    Text,
    Integer,
    Date,
    DateTime,
    func,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.base_model import Base, TimestampMixin, TenantMixin


class CompanyStockBatch(Base, TenantMixin):
    __tablename__ = "company_stock_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    brand_name = Column(String(100), default="Crystal", nullable=False)
    report_date = Column(Date, nullable=True)
    total_items = Column(Integer, default=0, nullable=False)
    total_company_stock = Column(Integer, default=0, nullable=False)
    new_products_created = Column(Integer, default=0, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User")
    items = relationship("CompanyStockItem", back_populates="batch", cascade="all, delete-orphan")


class CompanyStockItem(Base, TimestampMixin, TenantMixin):
    __tablename__ = "company_stock_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("company_stock_batches.id", ondelete="SET NULL"), nullable=True)
    brand_name = Column(String(100), default="Crystal", nullable=False)
    supplier_item_code = Column(String(255), nullable=False)
    item_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_raw = Column(String(100), nullable=True)
    size = Column(String(100), nullable=True)
    color = Column(String(100), nullable=True)
    company_stock = Column(Integer, default=0, nullable=False)
    report_date = Column(Date, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "supplier_item_code", name="uq_company_stock_tenant_code"),
    )

    # Relationships
    product = relationship("Product")
    batch = relationship("CompanyStockBatch", back_populates="items")

