"""LiveKit RTC token mint + room ACL (Wave 16)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from gametheca.utils.rbac import normalize_role


def livekit_enabled() -> bool:
    try:
        from flask import current_app

        return bool(current_app.config.get('ENABLE_LIVEKIT', True))
    except RuntimeError:
        return os.getenv('ENABLE_LIVEKIT', 'true').lower() in ('1', 'true', 'yes')


def livekit_config() -> dict[str, str]:
    return {
        'url': (os.getenv('LIVEKIT_URL') or '').strip(),
        'api_key': (os.getenv('LIVEKIT_API_KEY') or '').strip(),
        'api_secret': (os.getenv('LIVEKIT_API_SECRET') or '').strip(),
    }


def normalize_room_name(raw: str) -> str:
    """Opaque household room id — no game titles in SFU metadata by default."""
    cleaned = ''.join(ch if ch.isalnum() or ch in '-_:' else '-' for ch in (raw or '').strip())[:96]
    return cleaned or 'lobby'


def user_may_join_room(user, room: str) -> bool:
    role = normalize_role(getattr(user, 'role', None))
    room_l = (room or '').lower()
    if role == 'child' and ('adult' in room_l or room_l.startswith('admin')):
        return False
    return True


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def mint_livekit_token(
    *,
    identity: str,
    name: str,
    room: str,
    ttl_seconds: int = 3600,
    can_publish: bool = True,
    can_subscribe: bool = True,
    can_publish_data: bool = True,
) -> str:
    """HS256 JWT compatible with LiveKit access tokens (no extra package required)."""
    cfg = livekit_config()
    if not cfg['api_key'] or not cfg['api_secret']:
        raise RuntimeError('LIVEKIT_API_KEY/SECRET not configured')

    now = int(time.time())
    video: dict[str, Any] = {
        'roomJoin': True,
        'room': room,
        'canPublish': bool(can_publish),
        'canSubscribe': bool(can_subscribe),
        'canPublishData': bool(can_publish_data),
    }
    payload = {
        'iss': cfg['api_key'],
        'sub': identity,
        'name': name,
        'nbf': now - 10,
        'exp': now + max(60, min(ttl_seconds, 3600)),
        'video': video,
    }
    header = {'alg': 'HS256', 'typ': 'JWT'}
    segments = [
        _b64url(json.dumps(header, separators=(',', ':')).encode('utf-8')),
        _b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8')),
    ]
    signing_input = '.'.join(segments).encode('ascii')
    sig = hmac.new(cfg['api_secret'].encode('utf-8'), signing_input, hashlib.sha256).digest()
    return f'{segments[0]}.{segments[1]}.{_b64url(sig)}'
