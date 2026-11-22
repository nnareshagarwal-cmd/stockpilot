"""company_stock_feed

Revision ID: 005_company_stock_feed
Revises: 004_subcategory_and_lov
Create Date: 2026-11-01 21:50:00.000000

"""
from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '005_company_stock_feed'
down_revision: Union[str, None] = '004_subcategory_and_lov'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create company_stock_batches table
    op.create_table(
        'company_stock_batches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('brand_name', sa.String(100), server_default='Crystal', nullable=False),
        sa.Column('report_date', sa.Date(), nullable=True),
        sa.Column('total_items', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_company_stock', sa.Integer(), server_default='0', nullable=False),
        sa.Column('new_products_created', sa.Integer(), server_default='0', nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_company_stock_batches_tenant', 'company_stock_batches', ['tenant_id', 'created_at'])

    # 2. Create company_stock_items table
    op.create_table(
        'company_stock_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('company_stock_batches.id', ondelete='SET NULL'), nullable=True),
        sa.Column('brand_name', sa.String(100), server_default='Crystal', nullable=False),
        sa.Column('supplier_item_code', sa.String(255), nullable=False),
        sa.Column('item_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category_raw', sa.String(100), nullable=True),
        sa.Column('size', sa.String(100), nullable=True),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('company_stock', sa.Integer(), server_default='0', nullable=False),
        sa.Column('report_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'supplier_item_code', name='uq_company_stock_tenant_code'),
    )
    op.create_index('ix_company_stock_tenant_product', 'company_stock_items', ['tenant_id', 'product_id'])
    op.create_index('ix_company_stock_tenant_qty', 'company_stock_items', ['tenant_id', 'company_stock'])


def downgrade() -> None:
    op.drop_table('company_stock_items')
    op.drop_table('company_stock_batches')

