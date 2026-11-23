"""seed_lov_defaults

Revision ID: 006_seed_lov_defaults
Revises: 005_company_stock_feed
Create Date: 2026-11-22 20:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_seed_lov_defaults'
down_revision: Union[str, None] = '005_company_stock_feed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Seed location_type and adjustment_reason for all businesses
    op.execute(
        """
        INSERT INTO list_of_values (id, tenant_id, category, value, label, sort_order, is_active, is_system, description, created_at, updated_at)
        SELECT 
            gen_random_uuid(),
            b.id,
            v.category,
            v.value,
            v.label,
            v.sort_order,
            true,
            true,
            v.description,
            now(),
            now()
        FROM businesses b
        CROSS JOIN (
            VALUES 
                ('location_type', 'store', 'Store (Retail Shop)', 1, 'Retail store location'),
                ('location_type', 'showroom', 'Showroom', 2, 'Display showroom'),
                ('location_type', 'warehouse', 'Warehouse', 3, 'Central or regional warehouse'),
                ('location_type', 'godown', 'Godown', 4, 'Storage godown facility'),
                ('location_type', 'floor', 'Floor', 5, 'Floor level within a building'),
                ('location_type', 'section', 'Section / Zone', 6, 'Designated section or zone'),
                ('location_type', 'rack', 'Rack', 7, 'Storage rack'),
                ('location_type', 'shelf', 'Shelf', 8, 'Storage shelf'),
                ('location_type', 'bin', 'Bin', 9, 'Storage bin or slot'),
                ('location_type', 'other', 'Other', 10, 'Other general location type'),
                ('adjustment_reason', 'PHYSICAL_COUNT', 'Physical Stock Count / Audit', 1, 'Periodic physical count or annual audit reconciliation'),
                ('adjustment_reason', 'DAMAGE', 'Damage / Broken Goods Write-off', 2, 'Damaged, broken, or spoiled inventory write-off'),
                ('adjustment_reason', 'THEFT_LOSS', 'Theft / Shrinkage Loss', 3, 'Inventory shrinkage, loss, or theft write-off'),
                ('adjustment_reason', 'FOUND_STOCK', 'Found Unrecorded Stock', 4, 'Discovered unrecorded units during inspection'),
                ('adjustment_reason', 'DAMAGED_IN_STORE', 'Damaged in Store / Display', 5, 'Items damaged on showroom floor or during handling'),
                ('adjustment_reason', 'CLERICAL_ERROR', 'Clerical Correction', 6, 'Correction for data entry or bookkeeping error'),
                ('adjustment_reason', 'SAMPLE', 'Display Sample Conversion', 7, 'Stock allocated or written off for floor demo/sample'),
                ('adjustment_reason', 'OTHER', 'Other Operational Adjustment', 8, 'Other miscellaneous inventory adjustment')
        ) AS v(category, value, label, sort_order, description)
        ON CONFLICT (tenant_id, category, value) DO UPDATE
        SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, description = EXCLUDED.description;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM list_of_values
        WHERE category IN ('location_type', 'adjustment_reason') AND is_system = true;
        """
    )
