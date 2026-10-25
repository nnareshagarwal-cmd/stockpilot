"""phase1_catalogue_tables

Revision ID: 002_phase1_catalogue
Revises: 001_phase0_foundation
Create Date: 2026-10-23 00:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_phase1_catalogue'
down_revision: Union[str, None] = '001_phase0_foundation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. categories
    op.create_table(
        'categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'name', 'parent_id', name='uq_categories_tenant_name_parent')
    )
    op.create_index('ix_categories_tenant', 'categories', ['tenant_id'])
    op.create_index('ix_categories_parent', 'categories', ['parent_id'])

    # 2. brands
    op.create_table(
        'brands',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_brands_tenant_name')
    )
    op.create_index('ix_brands_tenant', 'brands', ['tenant_id'])

    # 3. units_of_measure
    op.create_table(
        'units_of_measure',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('decimal_places', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_uom_tenant_code')
    )
    op.create_index('ix_uom_tenant', 'units_of_measure', ['tenant_id'])

    # 4. locations
    op.create_table(
        'locations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50), nullable=True),
        sa.Column('location_type', sa.String(50), server_default='other', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('address_line1', sa.String(255), nullable=True),
        sa.Column('address_line2', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=True),
        sa.Column('contact_person', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "location_type IN ('store', 'showroom', 'warehouse', 'godown', 'floor', 'section', 'rack', 'shelf', 'bin', 'other')",
            name='ck_locations_type'
        ),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_locations_tenant_code')
    )
    op.create_index('ix_locations_tenant', 'locations', ['tenant_id'])
    op.create_index('ix_locations_parent', 'locations', ['parent_id'])
    op.create_index('ix_locations_type', 'locations', ['tenant_id', 'location_type'])

    # 5. stock_conditions
    op.create_table(
        'stock_conditions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('is_sellable', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_stock_conditions_tenant_code')
    )
    op.create_index('ix_stock_conditions_tenant', 'stock_conditions', ['tenant_id'])

    # 6. tax_rates
    op.create_table(
        'tax_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('rate', sa.Numeric(5, 2), nullable=False),
        sa.Column('hsn_code', sa.String(20), nullable=True),
        sa.Column('sac_code', sa.String(20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_tax_rates_tenant_name'),
        sa.CheckConstraint('rate >= 0 AND rate <= 100', name='ck_tax_rates_rate')
    )
    op.create_index('ix_tax_rates_tenant', 'tax_rates', ['tenant_id'])

    # 7. attribute_definitions
    op.create_table(
        'attribute_definitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('data_type', sa.String(20), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_required', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_searchable', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_filterable', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('unit_label', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "data_type IN ('text', 'number', 'decimal', 'boolean', 'date', 'single_choice', 'multiple_choice')",
            name='ck_attr_def_data_type'
        ),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_attr_def_tenant_code')
    )
    op.create_index('ix_attr_def_tenant', 'attribute_definitions', ['tenant_id'])
    op.create_index('ix_attr_def_category', 'attribute_definitions', ['category_id'])

    # 8. attribute_options
    op.create_table(
        'attribute_options',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('attribute_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('attribute_definitions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('value', sa.String(255), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.UniqueConstraint('attribute_id', 'value', name='uq_attr_options_attr_value')
    )
    op.create_index('ix_attr_options_attr', 'attribute_options', ['attribute_id'])

    # 9. products
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('brand_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('brands.id', ondelete='SET NULL'), nullable=True),
        sa.Column('model', sa.String(255), nullable=True),
        sa.Column('tax_rate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tax_rates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('search_vector', postgresql.TSVECTOR(), nullable=True)
    )
    op.create_index('ix_products_tenant', 'products', ['tenant_id'])
    op.create_index('ix_products_category', 'products', ['tenant_id', 'category_id'])
    op.create_index('ix_products_brand', 'products', ['tenant_id', 'brand_id'])
    op.create_index('ix_products_name', 'products', ['tenant_id', 'name'])
    op.create_index('ix_products_active', 'products', ['tenant_id', 'is_active'])
    op.create_index('ix_products_search', 'products', ['search_vector'], postgresql_using='gin')

    # 10. product_variants
    op.create_table(
        'product_variants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sku', sa.String(100), nullable=False),
        sa.Column('variant_name', sa.String(255), nullable=True),
        sa.Column('barcode', sa.String(100), nullable=True),
        sa.Column('barcode_type', sa.String(20), nullable=True),
        sa.Column('unit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('units_of_measure.id', ondelete='SET NULL'), nullable=True),
        sa.Column('purchase_price', sa.Numeric(15, 2), server_default='0', nullable=False),
        sa.Column('selling_price', sa.Numeric(15, 2), server_default='0', nullable=False),
        sa.Column('mrp', sa.Numeric(15, 2), nullable=True),
        sa.Column('reorder_point', sa.Numeric(15, 3), server_default='0', nullable=True),
        sa.Column('reorder_quantity', sa.Numeric(15, 3), server_default='0', nullable=True),
        sa.Column('weight_kg', sa.Numeric(10, 3), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.UniqueConstraint('tenant_id', 'sku', name='uq_product_variants_tenant_sku'),
        sa.CheckConstraint('purchase_price >= 0', name='ck_variant_purchase_price'),
        sa.CheckConstraint('selling_price >= 0', name='ck_variant_selling_price'),
        sa.CheckConstraint('mrp IS NULL OR mrp >= 0', name='ck_variant_mrp')
    )
    op.create_index('ix_variants_tenant', 'product_variants', ['tenant_id'])
    op.create_index('ix_variants_product', 'product_variants', ['product_id'])
    op.create_index('ix_variants_sku', 'product_variants', ['tenant_id', 'sku'])
    op.create_index('ix_variants_barcode', 'product_variants', ['tenant_id', 'barcode'])
    op.create_index('ix_variants_active', 'product_variants', ['tenant_id', 'is_active'])

    # 11. product_attribute_values
    op.create_table(
        'product_attribute_values',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('attribute_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('attribute_definitions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('text_value', sa.Text(), nullable=True),
        sa.Column('numeric_value', sa.Numeric(15, 3), nullable=True),
        sa.Column('decimal_value', sa.Numeric(15, 5), nullable=True),
        sa.Column('boolean_value', sa.Boolean(), nullable=True),
        sa.Column('date_value', sa.Date(), nullable=True),
        sa.Column('option_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('attribute_options.id', ondelete='SET NULL'), nullable=True),
        sa.Column('option_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.CheckConstraint('product_id IS NOT NULL OR variant_id IS NOT NULL', name='ck_pav_product_or_variant')
    )
    op.create_index('ix_pav_tenant', 'product_attribute_values', ['tenant_id'])
    op.create_index('ix_pav_product', 'product_attribute_values', ['product_id'])
    op.create_index('ix_pav_variant', 'product_attribute_values', ['variant_id'])
    op.create_index('ix_pav_attribute', 'product_attribute_values', ['attribute_id'])
    op.create_index('ix_pav_text_val', 'product_attribute_values', ['tenant_id', 'text_value'])
    op.create_index('ix_pav_num_val', 'product_attribute_values', ['tenant_id', 'numeric_value'])

    # 12. product_images
    op.create_table(
        'product_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('caption', sa.String(500), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('product_id IS NOT NULL OR variant_id IS NOT NULL', name='ck_pi_product_or_variant')
    )
    op.create_index('ix_product_images_product', 'product_images', ['product_id'])
    op.create_index('ix_product_images_variant', 'product_images', ['variant_id'])

    # 13. price_history
    op.create_table(
        'price_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('price_type', sa.String(20), nullable=False),
        sa.Column('old_price', sa.Numeric(15, 2), nullable=True),
        sa.Column('new_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('effective_date', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("price_type IN ('purchase', 'selling', 'mrp')", name='ck_price_history_type')
    )
    op.create_index('ix_price_history_variant', 'price_history', ['variant_id'])
    op.create_index('ix_price_history_date', 'price_history', ['tenant_id', 'effective_date'])

    # Triggers & Extensions for full-text and trigram search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute("""
    CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
    BEGIN
        NEW.search_vector := to_tsvector('english', 
            coalesce(NEW.name, '') || ' ' || 
            coalesce(NEW.description, '') || ' ' ||
            coalesce(NEW.model, '')
        );
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;")
    op.execute("""
    CREATE TRIGGER products_search_vector_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_products_name_trgm ON products USING gin(name gin_trgm_ops);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_variants_sku_trgm ON product_variants USING gin(sku gin_trgm_ops);")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;")
    op.execute("DROP FUNCTION IF EXISTS products_search_vector_update();")
    op.drop_table('price_history')
    op.drop_table('product_images')
    op.drop_table('product_attribute_values')
    op.drop_table('product_variants')
    op.drop_table('products')
    op.drop_table('attribute_options')
    op.drop_table('attribute_definitions')
    op.drop_table('tax_rates')
    op.drop_table('stock_conditions')
    op.drop_table('locations')
    op.drop_table('units_of_measure')
    op.drop_table('brands')
    op.drop_table('categories')
