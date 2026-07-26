"""Chat channels + DMs API (Wave 15)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import ChatChannel, User
from gametheca.utils.chat import (
    create_household_channel,
    list_channels_for_user,
    list_messages,
    mark_channel_read,
    open_or_create_dm,
    post_message,
    user_can_access_channel,
)

from . import apis_bp


@apis_bp.route('/chat/channels', methods=['GET'])
@login_required
def chat_channels_list():
    return jsonify({'channels': list_channels_for_user(current_user)})


@apis_bp.route('/chat/channels', methods=['POST'])
@login_required
def chat_channels_create():
    data = request.get_json(silent=True) or {}
    try:
        ch = create_household_channel(
            current_user,
            name=(data.get('name') or '').strip(),
            slug=(data.get('slug') or '').strip(),
            is_child_safe=bool(data.get('is_child_safe', True)),
        )
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'ok': True, 'channel': ch.to_dict()}), 201


@apis_bp.route('/chat/dm', methods=['POST'])
@login_required
def chat_open_dm():
    data = request.get_json(silent=True) or {}
    other = None
    if data.get('user_id') is not None:
        try:
            other = db.session.get(User, int(data['user_id']))
        except (TypeError, ValueError):
            other = None
    elif data.get('username'):
        other = db.session.execute(
            select(User).where(User.name == str(data['username']).strip()),
        ).scalars().first()
    if not other or not other.state:
        return jsonify({'error': 'User not found'}), 404
    try:
        ch = open_or_create_dm(current_user, other)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'ok': True, 'channel': ch.to_dict()})


@apis_bp.route('/chat/channels/<int:channel_id>/messages', methods=['GET'])
@login_required
def chat_messages_list(channel_id: int):
    ch = db.session.get(ChatChannel, channel_id)
    if not ch or not user_can_access_channel(current_user, ch):
        return jsonify({'error': 'Not found'}), 404
    limit = min(100, max(1, int(request.args.get('limit') or 50)))
    before = request.args.get('before')
    before_id = int(before) if before and str(before).isdigit() else None
    messages = list_messages(channel_id, limit=limit, before_id=before_id)
    if messages:
        mark_channel_read(channel_id, current_user.id, messages[-1]['id'])
    return jsonify({'messages': messages, 'channel': ch.to_dict()})


@apis_bp.route('/chat/channels/<int:channel_id>/messages', methods=['POST'])
@login_required
def chat_messages_post(channel_id: int):
    ch = db.session.get(ChatChannel, channel_id)
    if not ch or not user_can_access_channel(current_user, ch):
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json(silent=True) or {}
    try:
        msg = post_message(ch, current_user, data.get('body') or '')
    except (ValueError, PermissionError) as exc:
        code = 403 if isinstance(exc, PermissionError) else 400
        return jsonify({'error': str(exc)}), code
    return jsonify({
        'ok': True,
        'message': msg.to_dict(author_name=current_user.name),
    }), 201
