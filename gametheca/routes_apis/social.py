"""Lite social API — friends + BYO community chat link (Wave 13)."""

from __future__ import annotations

from datetime import datetime, timezone

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import or_, select

from gametheca import db
from gametheca.models import GlobalSettings, User, UserFriendship
from gametheca.utils.activity_feed import list_now_playing
from gametheca.utils.rbac import normalize_role

from . import apis_bp


def _community_settings() -> dict:
    row = db.session.execute(select(GlobalSettings).order_by(GlobalSettings.id).limit(1)).scalars().first()
    url = (getattr(row, 'community_chat_url', None) or '').strip() if row else ''
    label = (getattr(row, 'community_chat_label', None) or '').strip() if row else ''
    return {
        'community_chat_url': url or None,
        'community_chat_label': label or ('Open community' if url else None),
    }


def _user_public(user: User) -> dict:
    return {
        'id': user.id,
        'name': user.name,
        'role': normalize_role(getattr(user, 'role', None) or 'user'),
    }


@apis_bp.route('/social/status', methods=['GET'])
@login_required
def social_status():
    community = _community_settings()
    friends = (
        db.session.execute(
            select(UserFriendship).where(
                or_(
                    UserFriendship.user_id == current_user.id,
                    UserFriendship.friend_user_id == current_user.id,
                ),
                UserFriendship.status == 'accepted',
            )
        )
        .scalars()
        .all()
    )
    pending_in = (
        db.session.execute(
            select(UserFriendship).where(
                UserFriendship.friend_user_id == current_user.id,
                UserFriendship.status == 'pending',
            )
        )
        .scalars()
        .all()
    )
    return jsonify({
        **community,
        'friend_count': len(friends),
        'pending_incoming': len(pending_in),
        'now_playing': list_now_playing(viewer=current_user),
    })


@apis_bp.route('/social/friends', methods=['GET'])
@login_required
def social_friends_list():
    rows = (
        db.session.execute(
            select(UserFriendship).where(
                or_(
                    UserFriendship.user_id == current_user.id,
                    UserFriendship.friend_user_id == current_user.id,
                )
            )
        )
        .scalars()
        .all()
    )
    out = []
    for row in rows:
        other_id = row.friend_user_id if row.user_id == current_user.id else row.user_id
        other = db.session.get(User, other_id)
        if not other:
            continue
        direction = 'outgoing' if row.user_id == current_user.id else 'incoming'
        out.append({
            **row.to_dict(),
            'direction': direction,
            'user': _user_public(other),
        })
    return jsonify({'friends': out})


@apis_bp.route('/social/friends', methods=['POST'])
@login_required
def social_friends_request():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or data.get('name') or '').strip()
    friend_id = data.get('user_id')
    target = None
    if friend_id is not None:
        try:
            target = db.session.get(User, int(friend_id))
        except (TypeError, ValueError):
            target = None
    elif username:
        target = db.session.execute(
            select(User).where(User.name == username),
        ).scalars().first()
    if not target:
        return jsonify({'error': 'User not found'}), 404
    if target.id == current_user.id:
        return jsonify({'error': 'Cannot friend yourself'}), 400
    existing = db.session.execute(
        select(UserFriendship).where(
            or_(
                (UserFriendship.user_id == current_user.id) & (UserFriendship.friend_user_id == target.id),
                (UserFriendship.user_id == target.id) & (UserFriendship.friend_user_id == current_user.id),
            )
        )
    ).scalars().first()
    if existing:
        return jsonify({'ok': True, 'friendship': existing.to_dict(), 'existing': True})
    row = UserFriendship(
        user_id=current_user.id,
        friend_user_id=target.id,
        status='pending',
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({'ok': True, 'friendship': row.to_dict()}), 201


@apis_bp.route('/social/friends/<int:friendship_id>/accept', methods=['POST'])
@login_required
def social_friends_accept(friendship_id: int):
    row = db.session.get(UserFriendship, friendship_id)
    if not row or row.friend_user_id != current_user.id:
        return jsonify({'error': 'Not found'}), 404
    row.status = 'accepted'
    row.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'ok': True, 'friendship': row.to_dict()})


@apis_bp.route('/social/friends/<int:friendship_id>', methods=['DELETE'])
@login_required
def social_friends_delete(friendship_id: int):
    row = db.session.get(UserFriendship, friendship_id)
    if not row or (row.user_id != current_user.id and row.friend_user_id != current_user.id):
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({'ok': True})
