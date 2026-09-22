"""add reference_set_entries.parent_name

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-09-21 22:00:00.000000

INSP-5 / 1G1R (v11 H1c): a DAT entry that is a clone of another names its
parent (MAME ``cloneof``, No-Intro parent/clone ``cloneof``). NULL = a parent
or a set without clone data. The one-game-one-ROM view is "entries with no
parent"; a clone whose parent is owned is advisory for the duplicate check.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('reference_set_entries')}
    if 'parent_name' not in existing:
        op.add_column(
            'reference_set_entries',
            sa.Column('parent_name', sa.String(length=512), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('reference_set_entries')}
    if 'parent_name' in existing:
        op.drop_column('reference_set_entries', 'parent_name')
