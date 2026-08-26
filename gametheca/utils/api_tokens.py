"""API token helpers: create, verify, and Flask-Login request loader."""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import current_app, g, has_app_context
from flask_login import current_user
from sqlalchemy import select

from gametheca import db, login_manager
from gametheca.models import ApiToken, User
from gametheca.utils.api_response import api_error

VALID_SCOPES = frozenset({
    'read:library',
    'read:social',
    'write:presence',
    'write:download',
    'write:library',
    'admin',
})

TOKEN_SCOPE_PRESETS: dict[str, dict] = {
    'companion': {
        'label': 'Desktop companion',
        'scopes': ['read:library', 'write:download'],
    },
    'thin': {
        'label': 'Thin client',
        'scopes': ['read:library', 'read:social', 'write:presence'],
    },
}

TOKEN_PREFIX = 'gt_'
# Public prefix is secrets.token_hex(4); secret is secrets.token_urlsafe(32).
_RAW_TOKEN_RE = re.compile(r'^gt_[0-9a-f]{8}_[A-Za-z0-9_-]+$')
_logger = logging.getLogger(__name__)


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode('utf-8')).hexdigest()


def is_raw_api_token(raw: str) -> bool:
    """True when *raw* is exactly one generated token string (no labels/junk)."""
    return bool(raw) and bool(_RAW_TOKEN_RE.fullmatch(raw))


def scrub_token_prefix_for_log(raw: str) -> str:
    """Return a log-safe prefix label — never the secret."""
    if not raw or not raw.startswith(TOKEN_PREFIX):
        return 'none'
    body = raw[len(TOKEN_PREFIX):]
    if '_' not in body:
        return 'malformed'
    prefix, _secret = body.split('_', 1)
    if prefix and re.fullmatch(r'[0-9a-fA-F]{1,16}', prefix):
        return prefix.lower()
    return 'invalid'


def generate_api_token(
    user: User,
    name: str,
    scopes: list[str] | None = None,
    expires_in_days: int | None = None,
) -> tuple[ApiToken, str]:
    """Create a token row and return (model, raw_token). Raw shown once.

    ``expires_in_days=None`` keeps the historical behaviour — a token that lives
    until it is revoked. Callers that can afford an expiry should set one.
    """
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
    if not is_raw_api_token(raw):
        # Defensive: urlsafe alphabet is already A-Za-z0-9_-, so this should not fire.
        raise RuntimeError('generated api token failed purity check')

    expires_at = None
    if expires_in_days is not None:
        if expires_in_days <= 0:
            raise ValueError('expires_in_days must be positive')
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    row = ApiToken(
        user_id=user.id,
        name=(name or 'API token').strip()[:100],
        token_prefix=prefix,
        token_hash=_hash_secret(secret),
        scopes=cleaned,
        expires_at=expires_at,
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


def verify_bearer_token(
    raw: str,
    *,
    touch: bool = True,
) -> tuple[User | None, ApiToken | None]:
    """Verify a raw Bearer secret. Returns (user, token) or (None, None)."""
    user, token, _reason = verify_bearer_token_detailed(raw, touch=touch)
    return user, token


def verify_bearer_token_detailed(
    raw: str,
    *,
    touch: bool = True,
) -> tuple[User | None, ApiToken | None, str | None]:
    """Like verify_bearer_token, but returns a scrubbed failure reason.

    Reasons (never include the secret): malformed | unknown_prefix | bad_hash |
    expired | inactive_user. Success returns reason=None.
    """
    if not raw or not raw.startswith(TOKEN_PREFIX):
        return None, None, 'malformed'
    body = raw[len(TOKEN_PREFIX):]
    if '_' not in body:
        return None, None, 'malformed'
    prefix, secret = body.split('_', 1)
    if not prefix or not secret:
        return None, None, 'malformed'

    row = db.session.execute(
        select(ApiToken).filter_by(token_prefix=prefix, revoked_at=None)
    ).scalars().first()
    if not row:
        return None, None, 'unknown_prefix'
    if not secrets.compare_digest(row.token_hash, _hash_secret(secret)):
        return None, None, 'bad_hash'
    # Checked after the hash so an expired token cannot be distinguished from a
    # wrong one without knowing the secret.
    if row.is_expired():
        return None, None, 'expired'

    user = db.session.get(User, row.user_id)
    if not user or not user.state:
        return None, None, 'inactive_user'

    if touch:
        row.last_used_at = datetime.now(timezone.utc)
        db.session.commit()
    return user, row, None


def _log_api_token_auth_failed(reason: str, raw: str) -> None:
    """WARNING line for operators — never logs the secret."""
    prefix = scrub_token_prefix_for_log(raw)
    message = f'api_token_auth_failed reason={reason} prefix={prefix}'
    # Module logger always (pytest-friendly); mirror to Flask app logger for ops.
    _logger.warning(message)
    if has_app_context():
        current_app.logger.warning(message)


@login_manager.request_loader
def load_user_from_request(req):
    """Authenticate via Authorization: Bearer gt_… for API clients."""
    auth = req.headers.get('Authorization', '')
    if not auth.lower().startswith('bearer '):
        g.api_token = None
        return None
    raw = auth.split(' ', 1)[1].strip()
    user, token, reason = verify_bearer_token_detailed(raw)
    if user is None:
        # Bearer presented but rejected — surface for companion connect debugging.
        _log_api_token_auth_failed(reason or 'malformed', raw)
        g.api_token = None
        return None
    g.api_token = token
    return user


# Scopes a session-cookie caller gets purely by being signed in, per role.
# Everything a `child` may do is gated by the library ACL and per-route role
# checks anyway — this stops `require_api_scope` from being the *only* gate and
# silently handing a child write scopes it never needs.
_SESSION_SCOPE_DENY = {
    'child': frozenset({'admin', 'write:library', 'write:download'}),
}


def user_has_scope(scope: str) -> bool:
    if not current_user.is_authenticated:
        return False
    token = getattr(g, 'api_token', None)
    if token is not None:
        return token.has_scope(scope)

    # Session cookie: admins get every scope; everyone else gets the non-admin
    # set, minus whatever their role is explicitly denied.
    from gametheca.utils.rbac import normalize_role

    role = normalize_role(getattr(current_user, 'role', None))
    if role == 'admin':
        return True
    if scope == 'admin':
        return False
    return scope not in _SESSION_SCOPE_DENY.get(role, frozenset())


def require_api_scope(scope: str):
    """Require an authenticated user with the given API scope."""

    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if not current_user.is_authenticated:
                # api_error, not a bare jsonify: the frontend branches on
                # error_code, and these two were the only auth failures in the
                # tree that shipped without one.
                return api_error('Unauthorized', code='unauthorized')
            if not user_has_scope(scope):
                return api_error(
                    f'Missing scope: {scope}',
                    code='forbidden',
                    detail={'required_scope': scope},
                )
            return fn(*args, **kwargs)

        return wrapped

    return decorator
