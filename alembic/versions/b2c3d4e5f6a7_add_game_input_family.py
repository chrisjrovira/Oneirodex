"""add games.input_family

Revision ID: b2c3d4e5f6a7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-22 09:00:00.000000

INSP-43 (v11 H4b): how a cabinet was driven -- joystick / spinner / lightgun /
trackball -- so the desktop companion can pick the matching RetroArch input
remap. NULL = unknown, which is most of the library.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('games')}
    if 'input_family' not in existing:
        op.add_column('games', sa.Column('input_family', sa.String(length=16), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('games')}
    if 'input_family' in existing:
        op.drop_column('games', 'input_family')
