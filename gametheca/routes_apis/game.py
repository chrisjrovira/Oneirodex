# /gametheca/routes_apis/game.py
from datetime import datetime, timezone

from flask import current_app, jsonify, request, url_for
from flask_login import login_required, current_user
from gametheca import db
from gametheca.models import (
    Image,
    Game,
    GameRequest,
    Library,
    Genre,
    GameMode,
    PlayerPerspective,
    Theme,
    get_status_info,
    user_favorites,
    user_game_status,
)
from gametheca.utils.api_response import api_error, api_ok
from gametheca.utils.background import run_in_background
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.game_core import get_game_by_uuid
from gametheca.utils.game_details_payload import build_game_details_payload
from gametheca.utils.image_kinds import (
    IMAGE_KIND_ORDER,
    image_kinds_error_message,
    parse_image_kind,
)
from gametheca.utils.rbac import can_request_games, librarian_required
from gametheca.utils.library_acl import apply_game_access_filters, user_can_access_game, user_can_access_library
from gametheca.utils.scanning import refresh_images_in_background
from sqlalchemy import and_, delete, func, select
from . import apis_bp

# Member Library multi-select caps (honest limits — not DRM queues).
BATCH_FAVORITE_MAX = 100
BATCH_STATUS_MAX = 100
BATCH_FRESHNESS_MAX = 50
BATCH_WISHLIST_MAX = 50
BATCH_REFRESH_IMAGES_MAX = 20
FRESHNESS_STALE_SECONDS = 86400
BATCH_STATUS_VALUES = frozenset({'unplayed', 'unfinished', 'beaten', 'completed', ''})


def _refuse_inaccessible_game(game):
    """Refusal for a game the caller may not see, or ``None`` when they may.

    Five handlers spelled these four lines out, and they had already drifted:
    `game_details_api` answered 'Access denied' where the other four answered
    'Forbidden', for the identical check. Takes an already-loaded game because
    the call sites disagree on how to load it — one goes through
    `get_game_by_uuid` for its logging, the rest use a plain select.
    """
    if not game:
        return api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return api_error('You do not have access to that game', code='forbidden')
    return None


def _normalize_batch_uuids(raw, *, max_size: int) -> tuple[list[str] | None, dict | None, int]:
    """Return (uuids, error_response_dict, http_status). Dedupes, preserves order."""
    if not isinstance(raw, list):
        return None, {'ok': False, 'error': 'uuids must be a list', 'updated': [], 'skipped': [], 'errors': []}, 400
    if len(raw) > max_size:
        return None, {
            'ok': False,
            'error': f'uuids exceeds limit of {max_size}',
            'limit': max_size,
            'requested': len(raw),
            'updated': [],
            'skipped': [],
            'errors': [],
        }, 400
    seen: set[str] = set()
    uuids: list[str] = []
    for item in raw:
        uid = (str(item) if item is not None else '').strip()
        if not uid or uid in seen:
            continue
        seen.add(uid)
        uuids.append(uid)
    return uuids, None, 200

@apis_bp.route('/search')
@login_required
def search():
    query = request.args.get('query', '').strip()
    results = []
    if query:
        # Sanitize input - limit length and escape special characters
        if len(query) > 100:  # Reasonable search term length limit
            return api_error('Search term too long', code='bad_request')

        # Build query with name search
        search_term = f'%{query}%'
        search_query = apply_game_access_filters(
            select(Game).filter(Game.name.ilike(search_term)),
            current_user,
        )

        # Apply active filters from request parameters
        library_uuid = request.args.get('library_uuid')
        genre = request.args.get('genre')
        rating = request.args.get('rating', type=int)
        game_mode = request.args.get('game_mode')
        player_perspective = request.args.get('player_perspective')
        theme = request.args.get('theme')

        # Apply filter logic matching routes_library.py:get_games()
        if library_uuid:
            if not user_can_access_library(current_user, library_uuid):
                return jsonify([])
            search_query = search_query.filter(Game.library_uuid == library_uuid)
        if genre:
            search_query = search_query.filter(Game.genres.any(Genre.name == genre))
        if rating is not None:
            search_query = search_query.filter(Game.rating >= rating)
        if game_mode:
            search_query = search_query.filter(Game.game_modes.any(GameMode.name == game_mode))
        if player_perspective:
            search_query = search_query.filter(Game.player_perspectives.any(PlayerPerspective.name == player_perspective))
        if theme:
            search_query = search_query.filter(Game.themes.any(Theme.name == theme))

        # Execute query and build results
        games = db.session.execute(search_query).scalars().all()
        results = [{'id': game.id, 'uuid': game.uuid, 'name': game.name} for game in games]
    return jsonify(results)


@apis_bp.route('/games/batch/favorite', methods=['POST'])
@login_required
def games_batch_favorite():
    """Set favorite on/off for many library titles (member multi-select).

    Body JSON:
      uuids (list[str], required, max 100)
      favorite (bool, required) — true = add, false = remove

    Partial success: ``{ ok, updated, skipped, errors, limit }``.
    Skips not-found / forbidden / already-set; does not invent download queues.
    """
    data = request.get_json(silent=True) or {}
    uuids, err, status = _normalize_batch_uuids(data.get('uuids'), max_size=BATCH_FAVORITE_MAX)
    if err is not None:
        return jsonify(err), status
    if 'favorite' not in data:
        return api_error(
            'favorite boolean required', code='bad_request',
            updated=[], skipped=[], errors=[], limit=BATCH_FAVORITE_MAX,
        )
    favorite = bool(data.get('favorite'))

    if not uuids:
        return api_ok({
            'updated': [],
            'skipped': [],
            'errors': [],
            'limit': BATCH_FAVORITE_MAX,
            'favorite': favorite,
            'requested': 0,
        })

    games = {
        g.uuid: g
        for g in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all()
    }
    already = set(
        db.session.execute(
            select(user_favorites.c.game_uuid).where(
                user_favorites.c.user_id == current_user.id,
                user_favorites.c.game_uuid.in_(uuids),
            )
        ).scalars().all()
    )

    updated = []
    skipped = []
    errors = []
    for uid in uuids:
        game = games.get(uid)
        if not game:
            skipped.append({'uuid': uid, 'reason': 'not_found'})
            continue
        if not user_can_access_game(current_user, game):
            skipped.append({'uuid': uid, 'reason': 'forbidden'})
            continue
        is_fav = uid in already
        if favorite and is_fav:
            skipped.append({'uuid': uid, 'reason': 'already_set'})
            continue
        if not favorite and not is_fav:
            skipped.append({'uuid': uid, 'reason': 'already_set'})
            continue
        try:
            if favorite:
                current_user.favorites.append(game)
                already.add(uid)
            else:
                current_user.favorites.remove(game)
                already.discard(uid)
            updated.append({'uuid': uid, 'favorite': favorite})
        except Exception as exc:
            errors.append({'uuid': uid, 'error': str(exc)})

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('batch commit failed: %s', exc)
        return api_error(
            'Could not save the change', code='internal',
            updated=[], skipped=skipped, errors=errors, limit=BATCH_FAVORITE_MAX,
        )

    # Deliberately not api_ok: `ok` here answers "did every item succeed",
    # not "did the request succeed". The SPA reads `data.ok !== false`
    # (api/batchActions.js) to flag a partial batch, and api_ok would stamp it
    # True and hide the failures. Recorded in the envelope baseline on purpose.
    return jsonify({
        'ok': len(errors) == 0,
        'updated': updated,
        'skipped': skipped,
        'errors': errors,
        'limit': BATCH_FAVORITE_MAX,
        'favorite': favorite,
        'requested': len(uuids),
        'count': len(updated),
    })


@apis_bp.route('/games/batch/status', methods=['POST'])
@login_required
def games_batch_status():
    """Set or clear play status for many library titles (member multi-select).

    Body JSON:
      uuids (list[str], required, max 100)
      status (str, required) — ``unplayed`` | ``unfinished`` | ``beaten`` |
        ``completed`` | ``''`` (empty clears, same as ``set_game_status``)

    AuthZ: ``user_can_access_game`` per title. Partial success shape matches
    batch favorite. Not a DRM download queue.
    """
    data = request.get_json(silent=True) or {}
    uuids, err, status_code = _normalize_batch_uuids(data.get('uuids'), max_size=BATCH_STATUS_MAX)
    if err is not None:
        return jsonify(err), status_code
    if 'status' not in data:
        return api_error(
            'status required', code='bad_request',
            updated=[], skipped=[], errors=[], limit=BATCH_STATUS_MAX,
        )
    status = data.get('status')
    if status is None:
        status = ''
    if not isinstance(status, str):
        return api_error(
            'status must be a string', code='bad_request',
            updated=[], skipped=[], errors=[], limit=BATCH_STATUS_MAX,
        )
    status = status.strip()
    if status not in BATCH_STATUS_VALUES:
        return api_error(
            'Invalid status value', code='bad_request',
            updated=[], skipped=[], errors=[], limit=BATCH_STATUS_MAX,
        )

    clear = status == ''
    status_out = None if clear else status
    status_info = get_status_info(status_out)

    if not uuids:
        return api_ok({
            'updated': [],
            'skipped': [],
            'errors': [],
            'limit': BATCH_STATUS_MAX,
            'status': status_out,
            'status_info': status_info,
            'requested': 0,
            'count': 0,
        })

    games = {
        g.uuid: g
        for g in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all()
    }
    existing_rows = {
        row[0]: row[1]
        for row in db.session.execute(
            select(user_game_status.c.game_uuid, user_game_status.c.status).where(
                and_(
                    user_game_status.c.user_id == current_user.id,
                    user_game_status.c.game_uuid.in_(uuids),
                )
            )
        ).all()
    }

    updated = []
    skipped = []
    errors = []
    now = datetime.now(timezone.utc)

    for uid in uuids:
        game = games.get(uid)
        if not game:
            skipped.append({'uuid': uid, 'reason': 'not_found'})
            continue
        if not user_can_access_game(current_user, game):
            skipped.append({'uuid': uid, 'reason': 'forbidden'})
            continue
        current = existing_rows.get(uid)
        if clear and current is None:
            skipped.append({'uuid': uid, 'reason': 'already_set'})
            continue
        if not clear and current == status:
            skipped.append({'uuid': uid, 'reason': 'already_set'})
            continue
        try:
            if clear:
                db.session.execute(
                    delete(user_game_status).where(
                        and_(
                            user_game_status.c.user_id == current_user.id,
                            user_game_status.c.game_uuid == uid,
                        )
                    )
                )
                existing_rows.pop(uid, None)
            elif current is not None:
                db.session.execute(
                    user_game_status.update().where(
                        and_(
                            user_game_status.c.user_id == current_user.id,
                            user_game_status.c.game_uuid == uid,
                        )
                    ).values(status=status, updated_at=now)
                )
                existing_rows[uid] = status
            else:
                db.session.execute(
                    user_game_status.insert().values(
                        user_id=current_user.id,
                        game_uuid=uid,
                        status=status,
                        updated_at=now,
                    )
                )
                existing_rows[uid] = status
            updated.append({'uuid': uid, 'status': status_out})
        except Exception as exc:
            errors.append({'uuid': uid, 'error': str(exc)})

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('batch status commit failed: %s', exc)
        return api_error(
            'Could not save the play status', code='internal',
            updated=[], skipped=skipped, errors=errors,
            limit=BATCH_STATUS_MAX, status=status_out,
        )

    # Deliberately not api_ok: `ok` here answers "did every item succeed",
    # not "did the request succeed". The SPA reads `data.ok !== false`
    # (api/batchActions.js) to flag a partial batch, and api_ok would stamp it
    # True and hide the failures. Recorded in the envelope baseline on purpose.
    return jsonify({
        'ok': len(errors) == 0,
        'updated': updated,
        'skipped': skipped,
        'errors': errors,
        'limit': BATCH_STATUS_MAX,
        'status': status_out,
        'status_info': status_info,
        'requested': len(uuids),
        'count': len(updated),
    })


@apis_bp.route('/games/batch/wishlist', methods=['POST'])
@login_required
def games_batch_wishlist():
    """Queue wishlist / request rows for selected library titles (by UUID).

    Body JSON:
      uuids (list[str], required, max 50)

    Creates ``GameRequest`` rows with ``title`` from ``Game.name`` and
    ``linked_game_uuid`` set to the source title. Honors ``can_request_games``
    (403 for child / unavailable accounts). Skips pending duplicates by title
    or linked UUID. Cap 50 — not a DRM download queue.

    Canonical path: ``POST /api/games/batch/wishlist`` (not ``/api/requests/batch``).
    """
    if not can_request_games(current_user):
        # Same refusal as `POST /api/requests` (routes_apis/wishlist.py), so it
        # has to read the same on the wire — a member hitting this from Library
        # multi-select and from a game page is being told one thing.
        return api_error(
            'Wishlist requests are not available for this account',
            code='forbidden',
            updated=[],
            skipped=[],
            errors=[],
            limit=BATCH_WISHLIST_MAX,
        )

    data = request.get_json(silent=True) or {}
    uuids, err, status_code = _normalize_batch_uuids(data.get('uuids'), max_size=BATCH_WISHLIST_MAX)
    if err is not None:
        return jsonify(err), status_code

    if not uuids:
        return api_ok({
            'updated': [],
            'skipped': [],
            'errors': [],
            'limit': BATCH_WISHLIST_MAX,
            'requested': 0,
            'count': 0,
        })

    games = {
        g.uuid: g
        for g in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all()
    }
    pending_rows = db.session.execute(
        select(GameRequest).filter_by(user_id=current_user.id, status='pending')
    ).scalars().all()
    pending_titles = {(r.title or '').strip().lower() for r in pending_rows if r.title}
    pending_linked = {r.linked_game_uuid for r in pending_rows if r.linked_game_uuid}

    updated = []
    skipped = []
    errors = []

    for uid in uuids:
        game = games.get(uid)
        if not game:
            skipped.append({'uuid': uid, 'reason': 'not_found'})
            continue
        if not user_can_access_game(current_user, game):
            skipped.append({'uuid': uid, 'reason': 'forbidden'})
            continue
        title = (game.name or '').strip()
        if not title:
            skipped.append({'uuid': uid, 'reason': 'unavailable'})
            continue
        title_key = title.lower()
        if uid in pending_linked or title_key in pending_titles:
            skipped.append({'uuid': uid, 'reason': 'already_pending'})
            continue
        try:
            row = GameRequest(
                user_id=current_user.id,
                title=title[:255],
                notes=None,
                status='pending',
                linked_game_uuid=uid,
            )
            db.session.add(row)
            db.session.flush()
            pending_titles.add(title_key)
            pending_linked.add(uid)
            updated.append({
                'uuid': uid,
                'request_id': row.id,
                'title': row.title,
                'status': row.status,
            })
        except Exception as exc:
            errors.append({'uuid': uid, 'error': str(exc)})

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('batch commit failed: %s', exc)
        return api_error(
            'Could not save the change', code='internal',
            updated=[], skipped=skipped, errors=errors, limit=BATCH_WISHLIST_MAX,
        )

    if updated:
        try:
            log_system_event(
                f'Wishlist batch: {len(updated)} request(s) created',
                event_type='game',
                event_level='information',
            )
        except Exception:
            pass

    # Deliberately not api_ok: `ok` here answers "did every item succeed",
    # not "did the request succeed". The SPA reads `data.ok !== false`
    # (api/batchActions.js) to flag a partial batch, and api_ok would stamp it
    # True and hide the failures. Recorded in the envelope baseline on purpose.
    return jsonify({
        'ok': len(errors) == 0,
        'updated': updated,
        'skipped': skipped,
        'errors': errors,
        'limit': BATCH_WISHLIST_MAX,
        'requested': len(uuids),
        'count': len(updated),
    })


@apis_bp.route('/games/batch/freshness/check', methods=['POST'])
@login_required
def games_batch_freshness_check():
    """On-demand freshness re-probe for selected titles (member multi-select).

    Body JSON:
      uuids (list[str], required, max 50)
      only_stale (bool, default true) — skip games checked in the last 24h
        (same semantics as admin ``POST /api/admin/freshness/refresh``)

    AuthZ: only titles the caller can see. Does not replace admin bulk refresh.
    Partial success: ``{ ok, updated, skipped, errors, limit }``.
    """
    from gametheca.utils.freshness import check_and_store_freshness

    data = request.get_json(silent=True) or {}
    uuids, err, status = _normalize_batch_uuids(data.get('uuids'), max_size=BATCH_FRESHNESS_MAX)
    if err is not None:
        return jsonify(err), status
    only_stale = bool(data.get('only_stale', True))

    if not uuids:
        return api_ok({
            'updated': [],
            'skipped': [],
            'errors': [],
            'limit': BATCH_FRESHNESS_MAX,
            'only_stale': only_stale,
            'requested': 0,
        })

    games = {
        g.uuid: g
        for g in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all()
    }
    updated = []
    skipped = []
    errors = []
    now = datetime.now(timezone.utc)

    for uid in uuids:
        game = games.get(uid)
        if not game:
            skipped.append({'uuid': uid, 'reason': 'not_found'})
            continue
        if not user_can_access_game(current_user, game):
            skipped.append({'uuid': uid, 'reason': 'forbidden'})
            continue
        if only_stale and game.freshness_checked_at and game.freshness_status:
            checked = game.freshness_checked_at
            if checked.tzinfo is None:
                checked = checked.replace(tzinfo=timezone.utc)
            if (now - checked).total_seconds() < FRESHNESS_STALE_SECONDS:
                skipped.append({'uuid': uid, 'reason': 'fresh'})
                continue
        try:
            _ = list(game.updates or [])
            _ = list(game.extras or [])
            _ = list(game.urls or [])
            public = check_and_store_freshness(game, commit=False, db_session=db.session)
            updated.append({
                'uuid': uid,
                'name': game.name,
                'status': public.get('status'),
                'confidence': public.get('confidence'),
            })
        except Exception as exc:
            errors.append({'uuid': uid, 'name': getattr(game, 'name', None), 'error': str(exc)})

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('batch commit failed: %s', exc)
        return api_error(
            'Could not save the change', code='internal',
            updated=[], skipped=skipped, errors=errors, limit=BATCH_FRESHNESS_MAX,
        )

    # Deliberately not api_ok: `ok` here answers "did every item succeed",
    # not "did the request succeed". The SPA reads `data.ok !== false`
    # (api/batchActions.js) to flag a partial batch, and api_ok would stamp it
    # True and hide the failures. Recorded in the envelope baseline on purpose.
    return jsonify({
        'ok': len(errors) == 0,
        'updated': updated,
        'skipped': skipped,
        'errors': errors,
        'limit': BATCH_FRESHNESS_MAX,
        'only_stale': only_stale,
        'requested': len(uuids),
        'count': len(updated),
    })


@apis_bp.route('/games/batch/refresh_images', methods=['POST'])
@login_required
@librarian_required
def games_batch_refresh_images():
    """Enqueue IGDB image refresh for selected titles (multi-select).

    Body JSON:
      uuids (list[str], required, max 20)

    Queues the same ``refresh_images_in_background`` path as
    ``POST /refresh_game_images/<uuid>``. AuthZ: librarian+ and
    ``user_can_access_game`` per title. Partial success shape matches
    other batch routes.
    """
    data = request.get_json(silent=True) or {}
    uuids, err, status = _normalize_batch_uuids(data.get('uuids'), max_size=BATCH_REFRESH_IMAGES_MAX)
    if err is not None:
        return jsonify(err), status

    if not uuids:
        return api_ok({
            'queued': [],
            'skipped': [],
            'errors': [],
            'limit': BATCH_REFRESH_IMAGES_MAX,
            'requested': 0,
            'count': 0,
        })

    games = {
        g.uuid: g
        for g in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all()
    }
    queued = []
    skipped = []
    errors = []

    for uid in uuids:
        game = games.get(uid)
        if not game:
            skipped.append({'uuid': uid, 'reason': 'not_found'})
            continue
        if not user_can_access_game(current_user, game):
            skipped.append({'uuid': uid, 'reason': 'forbidden'})
            continue
        if not getattr(game, 'igdb_id', None):
            skipped.append({'uuid': uid, 'reason': 'no_igdb_id', 'name': game.name})
            continue
        try:
            # One worker per game, each with its own app context and session
            # (utils/background.py). Sharing the request's session here was the
            # worst of the six sites: a batch queues up to
            # BATCH_REFRESH_IMAGES_MAX threads onto one Session at once.
            run_in_background(
                current_app._get_current_object(),
                refresh_images_in_background,
                uid,
                name=f'gametheca-refresh-images-{str(uid)[:8]}',
            )
            queued.append({'uuid': uid, 'name': game.name, 'status': 'queued'})
        except Exception as exc:
            errors.append({'uuid': uid, 'name': getattr(game, 'name', None), 'error': str(exc)})

    # Deliberately not api_ok: `ok` here answers "did every item succeed",
    # not "did the request succeed". The SPA reads `data.ok !== false`
    # (api/batchActions.js) to flag a partial batch, and api_ok would stamp it
    # True and hide the failures. Recorded in the envelope baseline on purpose.
    return jsonify({
        'ok': len(errors) == 0,
        'queued': queued,
        'skipped': skipped,
        'errors': errors,
        'limit': BATCH_REFRESH_IMAGES_MAX,
        'requested': len(uuids),
        'count': len(queued),
    }), 202


@apis_bp.route('/games/<game_uuid>/details', methods=['GET'])
@login_required
def game_details_api(game_uuid):
    """Full game details JSON for the member SPA details page."""
    game = get_game_by_uuid(game_uuid)
    refusal = _refuse_inaccessible_game(game)
    if refusal is not None:
        return refusal
    return jsonify(build_game_details_payload(game, current_user))


@apis_bp.route('/games/<game_uuid>/editions', methods=['GET'])
@login_required
def game_editions_api(game_uuid):
    """Every system this title exists on in the library, with per-core launchers.

    The tile grid shows one row per library, so a household holding the same
    game on two systems sees two unrelated tiles and no way to tell they are the
    same game — let alone to choose which one to play. The preview popup asks
    this and renders the answer as a launch menu.

    Read-only, and access-filtered the same way browse is: a member only sees
    copies in libraries they can already see.
    """
    game = db.session.execute(
        select(Game).filter_by(uuid=game_uuid)
    ).scalars().first()
    refusal = _refuse_inaccessible_game(game)
    if refusal:
        return refusal

    from gametheca.utils.game_editions import editions_for_game

    editions = editions_for_game(game, current_user)
    return api_ok({
        'uuid': game.uuid,
        'name': game.name,
        'editions': editions,
        # Distinct systems rather than distinct rows: two copies of one game in
        # two SNES libraries is one system, and the preview says "SNES" once.
        'system_count': len({
            row['library_platform'] for row in editions if row['library_platform']
        }),
    })


@apis_bp.route('/game_screenshots/<game_uuid>')
@login_required
def game_screenshots(game_uuid):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    refusal = _refuse_inaccessible_game(game)
    if refusal is not None:
        return refusal
    screenshots = db.session.execute(select(Image).filter_by(game_uuid=game_uuid, image_type='screenshot')).scalars().all()
    screenshot_urls = [url_for('static', filename=f'library/images/{screenshot.url}') for screenshot in screenshots]
    return jsonify(screenshot_urls)


@apis_bp.route('/game_images/<game_uuid>')
@login_required
def game_images(game_uuid):
    """List persisted images for a game; optional kind/type filter (BE-DET-10)."""
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    refusal = _refuse_inaccessible_game(game)
    if refusal is not None:
        return refusal

    raw_kind = request.args.get('kind') or request.args.get('type') or request.args.get('image_type') or 'all'
    try:
        kind_filter = parse_image_kind(raw_kind, default=None, allow_all=True)
    except ValueError:
        return api_error(image_kinds_error_message(), code='bad_request')

    query = select(Image).filter_by(game_uuid=game_uuid)
    if kind_filter != 'all':
        query = query.filter(Image.image_type == kind_filter)
    query = query.order_by(Image.image_type.asc(), Image.created_at.desc())
    rows = db.session.execute(query).scalars().all()

    images = []
    for img in rows:
        local_url = None
        if img.url:
            if img.url.startswith(('http://', 'https://', '/')):
                local_url = img.url
            else:
                local_url = url_for('static', filename=f'library/images/{img.url}')
        images.append({
            'id': img.id,
            'image_type': img.image_type,
            'kind': img.image_type,
            'url': local_url,
            'download_url': img.download_url,
            'is_downloaded': bool(img.is_downloaded),
        })

    return jsonify({
        'game_uuid': game_uuid,
        'kind_filter': kind_filter,
        'allowed_kinds': list(IMAGE_KIND_ORDER),
        'images': images,
        'count': len(images),
    })


@apis_bp.route('/move_game_to_library', methods=['POST'])
@login_required
@librarian_required
def move_game_to_library():
    try:
        data = request.get_json()
        game_uuid = data.get('game_uuid')
        target_library_uuid = data.get('target_library_uuid')
        
        if not game_uuid or not target_library_uuid:
            return api_error('game_uuid and target_library_uuid are required',
                             code='bad_request')
            
        game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
        target_library = db.session.execute(select(Library).filter_by(uuid=target_library_uuid)).scalars().first()
        
        if not game or not target_library:
            return api_error('Game or target library not found', code='not_found')

        if not user_can_access_game(current_user, game):
            return api_error('You do not have access to that game', code='forbidden')
        if not user_can_access_library(current_user, target_library):
            return api_error('You do not have access to that library', code='forbidden')
            
        # Update the game's library
        game.library_uuid = target_library_uuid
        db.session.commit()
        
        log_system_event(f"Game {game.name} moved to library {target_library.name} by user {current_user.name}", event_type='game', event_level='information')
        
        return api_ok({'message': f'Game moved to {target_library.name}'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.warning('move_game_to_library failed: %s', e)
        return api_error('Could not move the game', code='internal')

@apis_bp.route('/get_next_custom_igdb_id', methods=['GET'])
@login_required
def get_next_custom_igdb_id():
    """Return the next available custom IGDB ID (above 2000000420)"""
    try:
        # Find the highest custom IGDB ID currently in use
        base_custom_id = 2000000420
        highest_custom_id = db.session.execute(
            select(func.max(Game.igdb_id)).filter(Game.igdb_id >= base_custom_id)
        ).scalar()
        
        # If no custom IDs exist yet, return the base value, otherwise return the next available ID
        next_id = base_custom_id if highest_custom_id is None else highest_custom_id + 1
        return jsonify({'next_id': next_id})
    except Exception as e:
        current_app.logger.warning('next custom IGDB id failed: %s', e)
        return api_error('Could not work out the next custom IGDB id', code='internal')


@apis_bp.route('/games/<game_uuid>/freshness', methods=['GET'])
@login_required
def game_freshness_get(game_uuid):
    """Return cached freshness snapshot for a game."""
    from gametheca.utils.freshness import freshness_public_view

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    refusal = _refuse_inaccessible_game(game)
    if refusal is not None:
        return refusal
    return jsonify(freshness_public_view(game))


@apis_bp.route('/games/<game_uuid>/freshness/check', methods=['POST'])
@login_required
def game_freshness_check(game_uuid):
    """On-demand local vs store freshness check."""
    from gametheca.utils.freshness import check_and_store_freshness

    game = db.session.execute(
        select(Game).filter_by(uuid=game_uuid)
    ).scalars().first()
    refusal = _refuse_inaccessible_game(game)
    if refusal is not None:
        return refusal

    try:
        # Eager-load relationships used by local/update hints
        _ = list(game.updates or [])
        _ = list(game.extras or [])
        _ = list(game.urls or [])
        result = check_and_store_freshness(game, commit=True, db_session=db.session)
        log_system_event(
            f"Freshness check for {game.name}: {result.get('status')}",
            event_type='game',
            event_level='information',
        )
        return jsonify(result)
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('freshness check failed: %s', exc)
        return api_error('Freshness check failed', code='internal')


@apis_bp.route('/admin/freshness/refresh', methods=['POST'])
@login_required
def admin_freshness_refresh():
    """Bulk refresh freshness for library badges (admin).

    Body JSON:
      limit (int, default 25, max 500) — use a large value for whole-library runs
      only_stale (bool, default true) — skip games checked in the last 24h
      library_uuid (str, optional) — restrict to one library
      entire_library (bool) — when true with a library_uuid, ignore limit cap soft-stop
    """
    from gametheca.utils.freshness import check_and_store_freshness

    if not current_user.is_authenticated or current_user.role != 'admin':
        return api_error('Admin required', code='forbidden')

    data = request.get_json(silent=True) or {}
    entire = bool(data.get('entire_library') or data.get('all'))
    limit_raw = data.get('limit')
    if entire and limit_raw is None:
        limit = 500
    else:
        limit = min(int(limit_raw or 25), 500)
    only_stale = bool(data.get('only_stale', True))
    library_uuid = (data.get('library_uuid') or '').strip() or None

    query = select(Game).order_by(Game.name.asc())
    if library_uuid:
        query = query.filter(Game.library_uuid == library_uuid)
    # Over-fetch when skipping stale so we still fill the batch
    fetch_n = limit * 5 if only_stale else limit
    games = db.session.execute(query.limit(fetch_n)).scalars().all()
    updated = []
    errors = []
    skipped = 0
    now = datetime.now(timezone.utc)
    for game in games:
        if len(updated) >= limit:
            break
        if only_stale and game.freshness_checked_at and game.freshness_status:
            checked = game.freshness_checked_at
            if checked.tzinfo is None:
                checked = checked.replace(tzinfo=timezone.utc)
            if (now - checked).total_seconds() < 86400:
                skipped += 1
                continue
        try:
            _ = list(game.updates or [])
            _ = list(game.extras or [])
            _ = list(game.urls or [])
            public = check_and_store_freshness(game, commit=False)
            updated.append({'uuid': game.uuid, 'name': game.name, 'status': public.get('status')})
        except Exception as exc:
            errors.append({'uuid': game.uuid, 'name': game.name, 'error': str(exc)})
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('freshness check failed: %s', exc)
        return api_error('Freshness check failed', code='internal')

    return jsonify({
        'updated': updated,
        'errors': errors,
        'count': len(updated),
        'skipped_fresh': skipped,
        'library_uuid': library_uuid,
        'limit': limit,
    })
