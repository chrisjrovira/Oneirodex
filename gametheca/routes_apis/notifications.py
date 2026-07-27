"""Notification center API (Wave 14c)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca import db
from gametheca.models import UserPreference
from gametheca.utils.notifications import list_notifications, mark_read, unread_count

from . import apis_bp


@apis_bp.route('/notifications', methods=['GET'])
@login_required
def notifications_list():
    unread_only = str(request.args.get('unread') or '').lower() in ('1', 'true', 'yes')
    limit = min(100, max(1, int(request.args.get('limit') or 40)))
    return jsonify({
        'notifications': list_notifications(
            current_user.id, limit=limit, unread_only=unread_only,
        ),
        'unread_count': unread_count(current_user.id),
    })


@apis_bp.route('/notifications/read', methods=['POST'])
@login_required
def notifications_read():
    data = request.get_json(silent=True) or {}
    all_read = bool(data.get('all'))
    ids = data.get('ids') if isinstance(data.get('ids'), list) else []
    cleaned = []
    for value in ids:
        try:
            cleaned.append(int(value))
        except (TypeError, ValueError):
            continue
    count = mark_read(current_user.id, cleaned, all_read=all_read)
    return jsonify({'ok': True, 'marked': count, 'unread_count': unread_count(current_user.id)})


@apis_bp.route('/notifications/preferences', methods=['GET', 'POST'])
@login_required
def notifications_preferences():
    prefs = current_user.preferences
    if prefs is None:
        prefs = UserPreference(user_id=current_user.id)
        db.session.add(prefs)
        db.session.commit()
    if request.method == 'GET':
        return jsonify({
            'notify_friend_requests': bool(getattr(prefs, 'notify_friend_requests', True)),
            'notify_activity': bool(getattr(prefs, 'notify_activity', True)),
            'notify_mentions': bool(getattr(prefs, 'notify_mentions', True)),
            'notify_chat': bool(getattr(prefs, 'notify_chat', True)),
            'notify_free_games': bool(getattr(prefs, 'notify_free_games', True)),
            'email_notify_social': bool(getattr(prefs, 'email_notify_social', True)),
            'email_digest_daily': bool(getattr(prefs, 'email_digest_daily', False)),
        })
    data = request.get_json(silent=True) or {}
    for key in (
        'notify_friend_requests',
        'notify_activity',
        'notify_mentions',
        'notify_chat',
        'notify_free_games',
        'email_notify_social',
        'email_digest_daily',
    ):
        if key in data:
            setattr(prefs, key, bool(data[key]))
    db.session.commit()
    return jsonify({'ok': True})
