import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    ForeignKey,
    Text,
    Integer,
    Numeric,
    Date,
    DateTime,
    func,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.common.base_model import Base, TimestampMixin, TenantMixin


class Product(Base, TimestampMixin, TenantMixin):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    subcategory_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    brand_id = Column(UUID(as_uuid=True), ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True)
    model = Column(String(255), nullable=True)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey("tax_rates.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    category = relationship("Category", foreign_keys=[category_id])
    subcategory = relationship("Category", foreign_keys=[subcategory_id])
    brand = relationship("Brand")
    tax_rate = relationship("TaxRate")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan", order_by="ProductVariant.created_at")
    attribute_values = relationship("ProductAttributeValue", back_populates="product", cascade="all, delete-orphan", foreign_keys="ProductAttributeValue.product_id")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan", foreign_keys="ProductImage.product_id", order_by="ProductImage.sort_order")


class ProductVariant(Base, TimestampMixin, TenantMixin):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    sku = Column(String(100), nullable=False)
    variant_name = Column(String(255), nullable=True)
    barcode = Column(String(100), nullable=True, index=True)
    barcode_type = Column(String(20), nullable=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True)
    purchase_price = Column(Numeric(15, 2), default=0, nullable=False)
    selling_price = Column(Numeric(15, 2), default=0, nullable=False)
    mrp = Column(Numeric(15, 2), nullable=True)
    reorder_point = Column(Numeric(15, 3), default=0)
    reorder_quantity = Column(Numeric(15, 3), default=0)
    weight_kg = Column(Numeric(10, 3), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "sku", name="uq_product_variants_tenant_sku"),
        CheckConstraint("purchase_price >= 0", name="ck_variant_purchase_price"),
        CheckConstraint("selling_price >= 0", name="ck_variant_selling_price"),
        CheckConstraint("mrp IS NULL OR mrp >= 0", name="ck_variant_mrp"),
    )

    product = relationship("Product", back_populates="variants")
    unit = relationship("UnitOfMeasure")
    attribute_values = relationship("ProductAttributeValue", back_populates="variant", cascade="all, delete-orphan", foreign_keys="ProductAttributeValue.variant_id")
    images = relationship("ProductImage", back_populates="variant", cascade="all, delete-orphan", foreign_keys="ProductImage.variant_id")
    price_history = relationship("PriceHistory", back_populates="variant", cascade="all, delete-orphan", order_by="PriceHistory.created_at.desc()")


class ProductAttributeValue(Base, TenantMixin):
    __tablename__ = "product_attribute_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    attribute_id = Column(UUID(as_uuid=True), ForeignKey("attribute_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    text_value = Column(Text, nullable=True)
    numeric_value = Column(Numeric(15, 3), nullable=True)
    decimal_value = Column(Numeric(15, 5), nullable=True)
    boolean_value = Column(Boolean, nullable=True)
    date_value = Column(Date, nullable=True)
    option_id = Column(UUID(as_uuid=True), ForeignKey("attribute_options.id", ondelete="SET NULL"), nullable=True)
    option_ids = Column(JSONB, nullable=True)

    __table_args__ = (
        CheckConstraint("product_id IS NOT NULL OR variant_id IS NOT NULL", name="ck_pav_product_or_variant"),
    )

    product = relationship("Product", back_populates="attribute_values", foreign_keys=[product_id])
    variant = relationship("ProductVariant", back_populates="attribute_values", foreign_keys=[variant_id])
    attribute = relationship("AttributeDefinition")
    option = relationship("AttributeOption")


class ProductImage(Base, TenantMixin):
    __tablename__ = "product_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    caption = Column(String(500), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("product_id IS NOT NULL OR variant_id IS NOT NULL", name="ck_pi_product_or_variant"),
    )

    product = relationship("Product", back_populates="images", foreign_keys=[product_id])
    variant = relationship("ProductVariant", back_populates="images", foreign_keys=[variant_id])


class PriceHistory(Base, TenantMixin):
    __tablename__ = "price_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    price_type = Column(String(20), nullable=False)  # 'purchase', 'selling', 'mrp'
    old_price = Column(Numeric(15, 2), nullable=True)
    new_price = Column(Numeric(15, 2), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    effective_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("price_type IN ('purchase', 'selling', 'mrp')", name="ck_price_history_type"),
    )

    variant = relationship("ProductVariant", back_populates="price_history")
