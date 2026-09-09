"""Ownership domain: linked external store accounts and register-only records
of titles a member owns elsewhere (browse-badge matching; never downloads)."""
from datetime import datetime, timezone

from oneirodex import db

class StoreAccount(db.Model):
    """Linked external store account for register-only ownership sync (no downloads)."""

    __tablename__ = 'store_accounts'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'store', name='uq_store_account_user_store'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    store = db.Column(db.String(16), nullable=False)  # steam|gog|epic|amazon|playnite
    external_account_id = db.Column(db.String(64), nullable=True)
    # Refresh / device-auth secret for live GOG/Epic/Amazon sync. Never returned in to_dict.
    credential = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship(
        'User',
        backref=db.backref('store_accounts', lazy='dynamic', cascade='all, delete-orphan'),
    )

    def to_dict(self):
        return {
            'store': self.store,
            'external_account_id': self.external_account_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

class UserOwnedTitle(db.Model):
    """
    Register-only record of a title the user owns on an external store.
    Never triggers downloads or DRM retrieval — used for browse badge matching only.
    """

    __tablename__ = 'user_owned_titles'
    __table_args__ = (
        db.UniqueConstraint(
            'user_id', 'store', 'external_app_id',
            name='uq_user_owned_title',
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    store = db.Column(db.String(16), nullable=False)
    external_app_id = db.Column(db.String(32), nullable=False)
    name = db.Column(db.String(255), nullable=True)
    matched_game_uuid = db.Column(
        db.String(36),
        db.ForeignKey('games.uuid', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    last_synced_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship(
        'User',
        backref=db.backref('owned_titles', lazy='dynamic', cascade='all, delete-orphan'),
    )
    matched_game = db.relationship('Game')

    def to_dict(self):
        return {
            'store': self.store,
            'external_app_id': self.external_app_id,
            'name': self.name,
            'matched_game_uuid': self.matched_game_uuid,
            'last_synced_at': (
                self.last_synced_at.isoformat() if self.last_synced_at else None
            ),
        }


__all__ = [
    "StoreAccount",
    "UserOwnedTitle",
]
