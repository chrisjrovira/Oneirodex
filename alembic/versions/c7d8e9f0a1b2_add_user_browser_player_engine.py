"""add user_preferences.browser_player_engine

Revision ID: c7d8e9f0a1b2
Revises: a1c2e3f4b5d6
Create Date: 2026-09-17 12:00:00.000000

Member choice of browser play engine (BP-2 member half). NULL = admin default.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'a1c2e3f4b5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: create_all on a fresh boot may already have created the
    # column from the SQLAlchemy model before Alembic runs.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('user_preferences')}
    if 'browser_player_engine' not in existing:
        op.add_column(
            'user_preferences',
            sa.Column('browser_player_engine', sa.String(length=16), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('user_preferences')}
    if 'browser_player_engine' in existing:
        op.drop_column('user_preferences', 'browser_player_engine')
