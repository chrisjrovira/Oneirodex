"""add game_vr_profiles

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-09-22 03:00:00.000000

INSP-40 (v11 H3a): one row per (game, kind) saying how a title plays in a
headset -- native / injector (a community profile *page*) / flat -- with the
runtime side when known. Catalogue data and a deep link; never a shim.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('game_vr_profiles'):
        return
    op.create_table(
        'game_vr_profiles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('game_uuid', sa.String(length=36), sa.ForeignKey('games.uuid', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(length=16), nullable=False),
        sa.Column('runtime', sa.String(length=16), nullable=True),
        sa.Column('profile_url', sa.String(length=2048), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=32), nullable=False, server_default='librarian'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('game_uuid', 'kind', name='uq_game_vr_profiles_game_kind'),
    )
    op.create_index('ix_game_vr_profiles_game_uuid', 'game_vr_profiles', ['game_uuid'])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('game_vr_profiles'):
        op.drop_index('ix_game_vr_profiles_game_uuid', table_name='game_vr_profiles')
        op.drop_table('game_vr_profiles')
