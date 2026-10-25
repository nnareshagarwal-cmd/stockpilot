"""subcategory_and_lov

Revision ID: 004_subcategory_and_lov
Revises: 003_phase2_stock
Create Date: 2026-10-24 22:45:00.000000

"""
from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '004_subcategory_and_lov'
down_revision: Union[str, None] = '003_phase2_stock'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add subcategory_id to products table
    op.add_column(
        'products',
        sa.Column(
            'subcategory_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('categories.id', ondelete='SET NULL'),
            nullable=True,
        )
    )
    op.create_index('ix_products_subcategory', 'products', ['tenant_id', 'subcategory_id'])

    # 2. Create list_of_values table
    op.create_table(
        'list_of_values',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(100), nullable=False), # e.g. color_finish, primary_material, storage_included, unit
        sa.Column('label', sa.String(255), nullable=False),    # display name e.g. 'Walnut Polish'
        sa.Column('value', sa.String(255), nullable=False),    # code / identifier e.g. 'walnut_polish'
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_system', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'category', 'value', name='uq_lov_tenant_category_value')
    )
    op.create_index('ix_lov_tenant_category', 'list_of_values', ['tenant_id', 'category'])

    # 3. Deactivate all units except PCS and SET in units_of_measure
    op.execute(
        """
        UPDATE units_of_measure 
        SET is_active = false 
        WHERE code NOT IN ('PCS', 'SET');
        """
    )


def downgrade() -> None:
    op.drop_index('ix_lov_tenant_category', table_name='list_of_values')
    op.drop_table('list_of_values')
    op.drop_index('ix_products_subcategory', table_name='products')
    op.drop_column('products', 'subcategory_id')
