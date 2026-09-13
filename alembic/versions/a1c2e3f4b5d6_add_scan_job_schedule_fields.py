"""add scan_job schedule fields (kind, interval, cron)

Revision ID: a1c2e3f4b5d6
Revises: b9ab856b09ff
Create Date: 2026-09-13 01:56:00.000000

Additive schedule columns for Auto scan jobs: interval (minutes) and
5-field cron. Legacy ``schedule`` enum stays for 8/24/48 hour presets.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, Sequence[str], None] = 'b9ab856b09ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: create_all on a fresh boot may already have created these
    # columns from the SQLAlchemy model before Alembic runs.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('scan_jobs')}
    if 'schedule_kind' not in existing:
        op.add_column(
            'scan_jobs',
            sa.Column('schedule_kind', sa.String(length=16), nullable=True),
        )
    if 'schedule_interval_minutes' not in existing:
        op.add_column(
            'scan_jobs',
            sa.Column('schedule_interval_minutes', sa.Integer(), nullable=True),
        )
    if 'schedule_cron' not in existing:
        op.add_column(
            'scan_jobs',
            sa.Column('schedule_cron', sa.String(length=64), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('scan_jobs', 'schedule_cron')
    op.drop_column('scan_jobs', 'schedule_interval_minutes')
    op.drop_column('scan_jobs', 'schedule_kind')
