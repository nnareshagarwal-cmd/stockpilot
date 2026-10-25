"""phase2_stock_tables

Revision ID: 003_phase2_stock
Revises: 002_phase1_catalogue
Create Date: 2026-10-24 21:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_phase2_stock'
down_revision: Union[str, None] = '002_phase1_catalogue'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. stock_balances
    op.create_table(
        'stock_balances',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('condition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_conditions.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('quantity', sa.Numeric(12, 3), server_default='0', nullable=False),
        sa.Column('reserved_quantity', sa.Numeric(12, 3), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'variant_id', 'location_id', 'condition_id', name='uq_stock_balance_item'),
        sa.CheckConstraint('quantity >= 0', name='ck_stock_balance_positive_qty'),
        sa.CheckConstraint('reserved_quantity >= 0 AND reserved_quantity <= quantity', name='ck_stock_balance_reserved_qty')
    )
    op.create_index('ix_stock_balances_tenant', 'stock_balances', ['tenant_id'])
    op.create_index('ix_stock_balances_variant', 'stock_balances', ['tenant_id', 'variant_id'])
    op.create_index('ix_stock_balances_location', 'stock_balances', ['tenant_id', 'location_id'])
    op.create_index('ix_stock_balances_condition', 'stock_balances', ['tenant_id', 'condition_id'])

    # 2. stock_movements
    op.create_table(
        'stock_movements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('movement_type', sa.String(50), nullable=False),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('condition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_conditions.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('balance_after', sa.Numeric(12, 3), nullable=False),
        sa.Column('unit_cost', sa.Numeric(15, 2), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    )
    op.create_index('ix_stock_movements_tenant', 'stock_movements', ['tenant_id'])
    op.create_index('ix_stock_movements_variant', 'stock_movements', ['tenant_id', 'variant_id'])
    op.create_index('ix_stock_movements_location', 'stock_movements', ['tenant_id', 'location_id'])
    op.create_index('ix_stock_movements_created_at', 'stock_movements', ['tenant_id', 'created_at'])
    op.create_index('ix_stock_movements_type', 'stock_movements', ['tenant_id', 'movement_type'])

    # 3. stock_layers (FIFO receipt layers)
    op.create_table(
        'stock_layers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('condition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_conditions.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('initial_quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('remaining_quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('unit_cost', sa.Numeric(15, 2), nullable=False),
        sa.Column('received_date', sa.Date(), nullable=False),
        sa.Column('movement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_movements.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint('remaining_quantity >= 0 AND remaining_quantity <= initial_quantity', name='ck_stock_layers_qty')
    )
    op.create_index('ix_stock_layers_tenant', 'stock_layers', ['tenant_id'])
    op.create_index('ix_stock_layers_variant', 'stock_layers', ['tenant_id', 'variant_id'])
    op.create_index('ix_stock_layers_date', 'stock_layers', ['tenant_id', 'received_date'])
    op.create_index('ix_stock_layers_remaining', 'stock_layers', ['tenant_id', 'remaining_quantity'])

    # 4. stock_transfers
    op.create_table(
        'stock_transfers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('transfer_number', sa.String(50), nullable=False),
        sa.Column('source_location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('destination_location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.String(20), server_default='DRAFT', nullable=False),
        sa.Column('dispatched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispatched_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('received_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'transfer_number', name='uq_stock_transfers_number'),
        sa.CheckConstraint("status IN ('DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED')", name='ck_stock_transfers_status')
    )
    op.create_index('ix_stock_transfers_tenant', 'stock_transfers', ['tenant_id'])
    op.create_index('ix_stock_transfers_status', 'stock_transfers', ['tenant_id', 'status'])
    op.create_index('ix_stock_transfers_src', 'stock_transfers', ['tenant_id', 'source_location_id'])
    op.create_index('ix_stock_transfers_dst', 'stock_transfers', ['tenant_id', 'destination_location_id'])

    # 5. stock_transfer_items
    op.create_table(
        'stock_transfer_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transfer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_transfers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('condition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_conditions.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('quantity', sa.Numeric(12, 3), nullable=False),
        sa.Column('received_quantity', sa.Numeric(12, 3), server_default='0', nullable=False),
        sa.CheckConstraint('quantity > 0', name='ck_transfer_item_qty')
    )
    op.create_index('ix_stock_transfer_items_transfer', 'stock_transfer_items', ['transfer_id'])

    # 6. stock_adjustments
    op.create_table(
        'stock_adjustments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('adjustment_number', sa.String(50), nullable=False),
        sa.Column('variant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('locations.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('condition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('stock_conditions.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('quantity_delta', sa.Numeric(12, 3), nullable=False),
        sa.Column('reason_code', sa.String(50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('tenant_id', 'adjustment_number', name='uq_stock_adjustments_number')
    )
    op.create_index('ix_stock_adjustments_tenant', 'stock_adjustments', ['tenant_id'])
    op.create_index('ix_stock_adjustments_variant', 'stock_adjustments', ['tenant_id', 'variant_id'])
    op.create_index('ix_stock_adjustments_date', 'stock_adjustments', ['tenant_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('stock_adjustments')
    op.drop_table('stock_transfer_items')
    op.drop_table('stock_transfers')
    op.drop_table('stock_layers')
    op.drop_table('stock_movements')
    op.drop_table('stock_balances')
