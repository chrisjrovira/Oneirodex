"""Wishlist / game request queue APIs."""

from datetime import datetime, timezone

from flask import jsonify, request

from gametheca.utils.api_response import api_error, api_ok
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, GameRequest, User
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.notifications import notify_admins
from gametheca.utils.rbac import can_request_games, is_librarian

from . import apis_bp

VALID_RESOLVE_STATUSES = frozenset({'approved', 'rejected', 'fulfilled', 'pending'})


@apis_bp.route('/requests', methods=['GET'])
@login_required
def list_requests():
    if is_librarian(current_user) and request.args.get('all') == '1':
        rows = db.session.execute(
            select(GameRequest).order_by(GameRequest.created_at.desc()).limit(200)
        ).scalars().all()
    else:
        rows = db.session.execute(
            select(GameRequest)
            .filter_by(user_id=current_user.id)
            .order_by(GameRequest.created_at.desc())
            .limit(100)
        ).scalars().all()
    return jsonify({'requests': [r.to_dict() for r in rows]})


@apis_bp.route('/requests', methods=['POST'])
@login_required
def create_request():
    if not can_request_games(current_user):
        return api_error(
            'Wishlist requests are not available for this account',
            code='forbidden',
        )
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return api_error('A title is required', code='bad_request')
    existing = db.session.execute(
        select(GameRequest).filter_by(user_id=current_user.id, title=title, status='pending')
    ).scalars().first()
    if existing:
        return jsonify(existing.to_dict())
    row = GameRequest(
        user_id=current_user.id,
        title=title[:255],
        notes=(data.get('notes') or '')[:4000] or None,
        status='pending',
    )
    db.session.add(row)
    db.session.commit()
    log_system_event(
        f'Wishlist request created: {row.title}',
        event_type='game',
        event_level='information',
    )
    return jsonify(row.to_dict()), 201


@apis_bp.route('/requests/<int:request_id>', methods=['DELETE'])
@login_required
def cancel_request(request_id: int):
    """Owner may cancel their own pending request."""
    row = db.session.get(GameRequest, request_id)
    if not row:
        return api_error('Request not found', code='not_found')
    if row.user_id != current_user.id and not is_librarian(current_user):
        return api_error('That request belongs to someone else', code='forbidden')
    if row.status != 'pending' and not is_librarian(current_user):
        return api_error(
            'Only pending requests can be cancelled',
            code='bad_request',
        )
    db.session.delete(row)
    db.session.commit()
    return api_ok({'id': request_id})


@apis_bp.route('/requests/<int:request_id>', methods=['PATCH'])
@login_required
def resolve_request(request_id: int):
    if not is_librarian(current_user):
        return api_error('Librarian or admin required', code='forbidden')
    row = db.session.get(GameRequest, request_id)
    if not row:
        return api_error('Request not found', code='not_found')
    data = request.get_json(silent=True) or {}
    status = (data.get('status') or '').strip()
    if status not in VALID_RESOLVE_STATUSES:
        return api_error('That status is not one this request can move to', code='bad_request')

    linked = (data.get('linked_game_uuid') or '').strip() or None
    if linked:
        game = db.session.execute(select(Game).filter_by(uuid=linked)).scalars().first()
        if not game:
            return api_error('linked_game_uuid does not match a game', code='not_found')
        row.linked_game_uuid = linked
        if status == 'pending':
            status = 'fulfilled'

    row.status = status
    row.resolved_at = datetime.now(timezone.utc)
    row.resolved_by_user_id = current_user.id
    if data.get('notes') is not None:
        # Librarian resolution note appended into notes field (lightweight)
        note = (data.get('notes') or '').strip()
        if note:
            existing = row.notes or ''
            suffix = f'\n[staff] {note}'
            row.notes = (existing + suffix).strip()[:4000]
    db.session.commit()
    log_system_event(
        f'Wishlist request {row.id} → {status}',
        event_type='game',
        event_level='information',
    )
    if status == 'fulfilled':
        requester = db.session.get(User, row.user_id)
        try:
            notify_admins(
                kind='wishlist',
                title=f'Wishlist fulfilled: {row.title}',
                body=(
                    f'Fulfilled for {requester.name}.'
                    if requester else 'A wishlist request was fulfilled.'
                ),
                link=f'/game_details/{row.linked_game_uuid}' if row.linked_game_uuid else '/wishlist',
                payload={
                    'request_id': row.id,
                    'linked_game_uuid': row.linked_game_uuid,
                    'requester_name': requester.name if requester else None,
                },
            )
        except Exception:
            pass
    return jsonify(row.to_dict())
