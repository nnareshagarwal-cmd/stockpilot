"""add mobile PIN access, tile permissions, and lockout fields to business_users

Revision ID: 008_mobile_pin_access
Revises: 007_dimensions_and_category_attr
Create Date: 2026-11-27 07:45:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '008_mobile_pin_access'
down_revision: Union[str, None] = '007_dimensions_and_category_attr'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE business_users
        ADD COLUMN IF NOT EXISTS mobile_access BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS mobile_pin_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS mobile_pages JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE business_users
        DROP COLUMN IF EXISTS pin_locked_until,
        DROP COLUMN IF EXISTS pin_failed_attempts,
        DROP COLUMN IF EXISTS mobile_pages,
        DROP COLUMN IF EXISTS mobile_pin_hash,
        DROP COLUMN IF EXISTS mobile_access
    """)
