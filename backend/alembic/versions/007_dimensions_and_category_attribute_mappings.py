"""add dimensions to products and variants, and create category_attribute_mappings table

Revision ID: 007_dimensions_and_category_attr
Revises: 006_seed_lov_defaults
Create Date: 2026-11-23 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '007_dimensions_and_category_attr'
down_revision: Union[str, None] = '006_seed_lov_defaults'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add dimension columns to products table if not exists
    op.execute("""
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS height_mm NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS width_mm NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS height_inches NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS width_inches NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS depth_inches NUMERIC(10, 2)
    """)

    # 2. Add dimension columns to product_variants table if not exists
    op.execute("""
        ALTER TABLE product_variants
        ADD COLUMN IF NOT EXISTS height_mm NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS width_mm NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS depth_mm NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS height_inches NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS width_inches NUMERIC(10, 2),
        ADD COLUMN IF NOT EXISTS depth_inches NUMERIC(10, 2)
    """)

    # 3. Create category_attribute_mappings table if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS category_attribute_mappings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            attribute_id UUID NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_category_attribute_mappings_tenant_id ON category_attribute_mappings(tenant_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_category_attribute_mappings_category_id ON category_attribute_mappings(category_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_category_attribute_mappings_attribute_id ON category_attribute_mappings(attribute_id)
    """)

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_cat_attr_tenant_cat_attr'
            ) THEN
                ALTER TABLE category_attribute_mappings
                ADD CONSTRAINT uq_cat_attr_tenant_cat_attr UNIQUE (tenant_id, category_id, attribute_id);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS category_attribute_mappings CASCADE")

    op.execute("""
        ALTER TABLE product_variants
        DROP COLUMN IF EXISTS height_mm,
        DROP COLUMN IF EXISTS width_mm,
        DROP COLUMN IF EXISTS depth_mm,
        DROP COLUMN IF EXISTS height_inches,
        DROP COLUMN IF EXISTS width_inches,
        DROP COLUMN IF EXISTS depth_inches
    """)

    op.execute("""
        ALTER TABLE products
        DROP COLUMN IF EXISTS height_mm,
        DROP COLUMN IF EXISTS width_mm,
        DROP COLUMN IF EXISTS depth_mm,
        DROP COLUMN IF EXISTS height_inches,
        DROP COLUMN IF EXISTS width_inches,
        DROP COLUMN IF EXISTS depth_inches
    """)
