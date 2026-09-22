"""add games.vr_compat

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-09-21 16:00:00.000000

Rider R3 (v11 H-T, P3): how a title is played in VR, beside the derived
``is_vr``. NULL = unknown; ``native_vr`` / ``injector_profile`` / ``flat``.
Catalogue data only -- nothing here ships, installs or injects anything.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: create_all on a fresh boot may already have created the
    # column from the SQLAlchemy model before Alembic runs.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('games')}
    if 'vr_compat' not in existing:
        op.add_column('games', sa.Column('vr_compat', sa.String(length=24), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('games')}
    if 'vr_compat' in existing:
        op.drop_column('games', 'vr_compat')
