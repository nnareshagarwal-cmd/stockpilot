import uuid
from decimal import Decimal
from sqlalchemy import (
    Column,
    String,
    Boolean,
    ForeignKey,
    Text,
    Integer,
    Numeric,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.common.base_model import Base, TimestampMixin, TenantMixin


class Category(Base, TimestampMixin, TenantMixin):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "parent_id", name="uq_categories_tenant_name_parent"),
    )

    # Self-referential relationship
    parent = relationship("Category", remote_side=[id], backref="children")


class Brand(Base, TimestampMixin, TenantMixin):
    __tablename__ = "brands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    website = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_brands_tenant_name"),
    )


class UnitOfMeasure(Base, TimestampMixin, TenantMixin):
    __tablename__ = "units_of_measure"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    decimal_places = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_uom_tenant_code"),
    )


class Location(Base, TimestampMixin, TenantMixin):
    __tablename__ = "locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    location_type = Column(String(50), nullable=False, default="other")
    description = Column(Text, nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    contact_person = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "location_type IN ('store', 'showroom', 'warehouse', 'godown', 'floor', 'section', 'rack', 'shelf', 'bin', 'other')",
            name="ck_locations_type",
        ),
        UniqueConstraint("tenant_id", "code", name="uq_locations_tenant_code"),
    )

    parent = relationship("Location", remote_side=[id], backref="children")


class StockCondition(Base, TimestampMixin, TenantMixin):
    __tablename__ = "stock_conditions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    is_sellable = Column(Boolean, default=True, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_stock_conditions_tenant_code"),
    )


class TaxRate(Base, TimestampMixin, TenantMixin):
    __tablename__ = "tax_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    rate = Column(Numeric(5, 2), nullable=False)
    hsn_code = Column(String(20), nullable=True)
    sac_code = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tax_rates_tenant_name"),
        CheckConstraint("rate >= 0 AND rate <= 100", name="ck_tax_rates_rate"),
    )


class AttributeDefinition(Base, TimestampMixin, TenantMixin):
    __tablename__ = "attribute_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False)
    data_type = Column(String(20), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    is_required = Column(Boolean, default=False, nullable=False)
    is_searchable = Column(Boolean, default=False, nullable=False)
    is_filterable = Column(Boolean, default=False, nullable=False)
    unit_label = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "data_type IN ('text', 'number', 'decimal', 'boolean', 'date', 'single_choice', 'multiple_choice')",
            name="ck_attr_def_data_type",
        ),
        UniqueConstraint("tenant_id", "code", name="uq_attr_def_tenant_code"),
    )

    category = relationship("Category")
    options = relationship("AttributeOption", back_populates="attribute", cascade="all, delete-orphan", order_by="AttributeOption.sort_order")


class AttributeOption(Base):
    __tablename__ = "attribute_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attribute_id = Column(UUID(as_uuid=True), ForeignKey("attribute_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    value = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("attribute_id", "value", name="uq_attr_options_attr_value"),
    )

    attribute = relationship("AttributeDefinition", back_populates="options")


class ListOfValues(Base, TimestampMixin, TenantMixin):
    __tablename__ = "list_of_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String(100), nullable=False)
    label = Column(String(255), nullable=False)
    value = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    description = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "category", "value", name="uq_lov_tenant_category_value"),
    )

