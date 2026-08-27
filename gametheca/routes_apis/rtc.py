"""RTC / LiveKit token API (Wave 16)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.api_response import api_error
from gametheca.utils.livekit_rtc import (
    livekit_config,
    livekit_enabled,
    mint_livekit_token,
    normalize_room_name,
    user_may_join_room,
)
from gametheca.utils.rbac import normalize_role

from . import apis_bp


@apis_bp.route('/rtc/status', methods=['GET'])
@login_required
def rtc_status():
    cfg = livekit_config()
    return jsonify({
        'enabled': livekit_enabled() and bool(cfg['url'] and cfg['api_key'] and cfg['api_secret']),
        'url': cfg['url'] if livekit_enabled() else None,
    })


@apis_bp.route('/rtc/token', methods=['POST'])
@login_required
def rtc_token():
    if not livekit_enabled():
        return api_error('LiveKit is disabled', code='forbidden')
    cfg = livekit_config()
    if not (cfg['url'] and cfg['api_key'] and cfg['api_secret']):
        return api_error('LiveKit is not configured', code='unavailable')

    data = request.get_json(silent=True) or {}
    room = normalize_room_name(data.get('room') or 'household:lobby')
    if not user_may_join_room(current_user, room):
        return api_error('Forbidden for this room', code='forbidden')

    role = normalize_role(getattr(current_user, 'role', None))
    spectator = bool(data.get('spectator'))
    # Children: audio subscribe/publish OK; no camera by default (screenshare/video off).
    can_publish = not spectator
    if role == 'child' and bool(data.get('video') or data.get('screenshare')):
        return api_error('Camera/screenshare disabled for child accounts', code='forbidden')

    try:
        token = mint_livekit_token(
            identity=f'user-{current_user.id}',
            name=current_user.name or f'user-{current_user.id}',
            room=room,
            ttl_seconds=int(data.get('ttl') or 3600),
            can_publish=can_publish,
            can_subscribe=True,
        )
    except RuntimeError:
        return api_error('LiveKit is not configured', code='unavailable')

    return jsonify({
        'token': token,
        'url': cfg['url'],
        'room': room,
        'identity': f'user-{current_user.id}',
        'spectator': spectator,
        'can_publish': can_publish,
    })
