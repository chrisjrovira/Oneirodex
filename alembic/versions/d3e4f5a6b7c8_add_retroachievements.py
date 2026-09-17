"""add RetroAchievements hash index + game/set match + member ra_username

Revision ID: d3e4f5a6b7c8
Revises: c7d8e9f0a1b2
Create Date: 2026-09-17 18:00:00.000000

R1/R2 riders: `retroachievements_index` (console, hash -> set), `games.ra_hash`
/ `ra_game_id` / `ra_achievements`, `user_preferences.ra_username`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, Sequence[str], None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: create_all on a fresh boot may already have created these.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if 'retroachievements_index' not in tables:
        op.create_table(
            'retroachievements_index',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('console_id', sa.Integer(), nullable=False),
            sa.Column('ra_game_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False, server_default=''),
            sa.Column('image_icon', sa.String(length=255), nullable=True),
            sa.Column('num_achievements', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('points', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('md5', sa.String(length=32), nullable=False),
            sa.Column('fetched_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_retroachievements_index_console_id', 'retroachievements_index', ['console_id'])
        op.create_index('ix_retroachievements_index_ra_game_id', 'retroachievements_index', ['ra_game_id'])
        op.create_index('ix_ra_index_console_md5', 'retroachievements_index', ['console_id', 'md5'])

    games = {col['name'] for col in inspector.get_columns('games')}
    if 'ra_hash' not in games:
        op.add_column('games', sa.Column('ra_hash', sa.String(length=32), nullable=True))
    if 'ra_game_id' not in games:
        op.add_column('games', sa.Column('ra_game_id', sa.Integer(), nullable=True))
        op.create_index('ix_games_ra_game_id', 'games', ['ra_game_id'])
    if 'ra_achievements' not in games:
        op.add_column('games', sa.Column('ra_achievements', sa.Integer(), nullable=True))

    prefs = {col['name'] for col in inspector.get_columns('user_preferences')}
    if 'ra_username' not in prefs:
        op.add_column('user_preferences', sa.Column('ra_username', sa.String(length=64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    prefs = {col['name'] for col in inspector.get_columns('user_preferences')}
    if 'ra_username' in prefs:
        op.drop_column('user_preferences', 'ra_username')
    games = {col['name'] for col in inspector.get_columns('games')}
    if 'ra_achievements' in games:
        op.drop_column('games', 'ra_achievements')
    if 'ra_game_id' in games:
        op.drop_index('ix_games_ra_game_id', table_name='games')
        op.drop_column('games', 'ra_game_id')
    if 'ra_hash' in games:
        op.drop_column('games', 'ra_hash')
    if 'retroachievements_index' in set(inspector.get_table_names()):
        op.drop_table('retroachievements_index')
