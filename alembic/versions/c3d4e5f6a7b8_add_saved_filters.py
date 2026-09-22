"""add saved_filters

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-22 19:00:00.000000

INSP-3 (v11 H-I): a member's named filter, stored as the nested AND/OR tree
``utils/filter_tree.py`` compiles. Per-member, because one person narrowing
their own view should not change anyone else's. ``is_collection`` is what makes
the same row a smart collection (INSP-29) rather than a second table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'saved_filters' in inspector.get_table_names():
        return
    op.create_table(
        'saved_filters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('tree', sa.Text(), nullable=False),
        # No server_default: the model declares a Python-side default and
        # `alembic check` compares the two, so a default here that the model
        # does not carry reads as pending schema drift on every run.
        sa.Column('is_collection', sa.Boolean(), nullable=False),
        sa.Column('created', sa.DateTime(), nullable=True),
        sa.Column('updated', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_saved_filter_user_name'),
    )
    op.create_index('ix_saved_filters_user_id', 'saved_filters', ['user_id'])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'saved_filters' not in inspector.get_table_names():
        return
    op.drop_index('ix_saved_filters_user_id', table_name='saved_filters')
    op.drop_table('saved_filters')
