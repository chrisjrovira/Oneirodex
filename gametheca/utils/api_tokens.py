"""API token helpers: create, verify, and Flask-Login request loader."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from functools import wraps

from flask import g, jsonify, request
from flask_login import current_user
from sqlalchemy import select

from gametheca import db, login_manager
from gametheca.models import ApiToken, User

VALID_SCOPES = frozenset({
    'read:library',
    'write:download',
    'write:library',
    'admin',
})

TOKEN_PREFIX = 'gt_'


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode('utf-8')).hexdigest()


def generate_api_token(
    user: User,
    name: str,
    scopes: list[str] | None = None,
) -> tuple[ApiToken, str]:
    """Create a token row and return (model, raw_token). Raw shown once."""
    cleaned = []
    for scope in scopes or ['read:library']:
        scope = (scope or '').strip()
        if scope in VALID_SCOPES and scope not in cleaned:
            cleaned.append(scope)
    if not cleaned:
        cleaned = ['read:library']

    prefix = secrets.token_hex(4)
    secret = secrets.token_urlsafe(32)
    raw = f'{TOKEN_PREFIX}{prefix}_{secret}'

    row = ApiToken(
        user_id=user.id,
        name=(name or 'API token').strip()[:100],
        token_prefix=prefix,
        token_hash=_hash_secret(secret),
        scopes=cleaned,
    )
    db.session.add(row)
    db.session.commit()
    return row, raw


def revoke_api_token(token_id: int, user_id: int | None = None) -> bool:
    query = select(ApiToken).filter_by(id=token_id)
    if user_id is not None:
        query = query.filter_by(user_id=user_id)
    row = db.session.execute(query).scalars().first()
    if not row or row.revoked_at:
        return False
    row.revoked_at = datetime.now(timezone.utc)
    db.session.commit()
    return True


def verify_bearer_token(raw: str, *, touch: bool = True) -> tuple[User | None, ApiToken | None]:
    if not raw or not raw.startswith(TOKEN_PREFIX):
        return None, None
    body = raw[len(TOKEN_PREFIX):]
    if '_' not in body:
        return None, None
    prefix, secret = body.split('_', 1)
    if not prefix or not secret:
        return None, None

    row = db.session.execute(
        select(ApiToken).filter_by(token_prefix=prefix, revoked_at=None)
    ).scalars().first()
    if not row:
        return None, None
    if not secrets.compare_digest(row.token_hash, _hash_secret(secret)):
        return None, None

    user = db.session.get(User, row.user_id)
    if not user or not user.state:
        return None, None

    if touch:
        row.last_used_at = datetime.now(timezone.utc)
        db.session.commit()
    return user, row


@login_manager.request_loader
def load_user_from_request(req):
    """Authenticate via Authorization: Bearer gt_… for API clients."""
    auth = req.headers.get('Authorization', '')
    if not auth.lower().startswith('bearer '):
        g.api_token = None
        return None
    raw = auth.split(' ', 1)[1].strip()
    user, token = verify_bearer_token(raw)
    g.api_token = token
    return user


def user_has_scope(scope: str) -> bool:
    if not current_user.is_authenticated:
        return False
    token = getattr(g, 'api_token', None)
    if token is None:
        # Session cookie: admins get all scopes; members get non-admin
        if current_user.role == 'admin':
            return True
        return scope != 'admin'
    return token.has_scope(scope)


def require_api_scope(scope: str):
    """Require an authenticated user with the given API scope."""

    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({'error': 'Unauthorized'}), 401
            if not user_has_scope(scope):
                return jsonify({'error': f'Missing scope: {scope}'}), 403
            return fn(*args, **kwargs)

        return wrapped

    return decorator
