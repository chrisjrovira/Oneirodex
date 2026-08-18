"""Admin APIs for operator-owned translation patch catalogs."""

from __future__ import annotations

from flask import current_app, jsonify, request

from gametheca.utils.api_response import api_error, api_ok
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.auth import admin_required
from gametheca.utils.library_acl import user_can_access_game
from gametheca.utils.patch_catalog.attach import attach_patch_guide
from gametheca.utils.patch_catalog.registry import (
    list_patch_providers,
    search_all_patch_providers,
)

from . import apis_bp


def _catalog_module_enabled() -> bool:
    return str(current_app.config.get('ENABLE_PATCH_CATALOG', '')).lower() in (
        '1',
        'true',
        'yes',
        'on',
    )


def _module_disabled_response(**extra):
    """The 403 both catalog routes answer with when the module is switched off.

    Carried in one place so the two copies cannot drift again — they already had,
    and both were missed when the rest of the file moved onto the envelope.
    """
    return api_error(
        'Patch catalog is disabled. Set ENABLE_PATCH_CATALOG=true.',
        code='forbidden',
        **extra,
    )


@apis_bp.route('/patch-catalog/providers', methods=['GET'])
@login_required
@admin_required
def patch_catalog_providers():
    return jsonify(
        {
            'module_enabled': _catalog_module_enabled(),
            'catalog_path': (current_app.config.get('PATCH_CATALOG_PATH') or '') or None,
            'providers': list_patch_providers(),
        }
    )


@apis_bp.route('/patch-catalog/search', methods=['GET'])
@login_required
@admin_required
def patch_catalog_search():
    if not _catalog_module_enabled():
        return _module_disabled_response(hits=[])

    query = (request.args.get('q') or request.args.get('query') or '').strip()
    game_uuid = (request.args.get('game_uuid') or '').strip()
    platform = (request.args.get('platform') or '').strip() or None
    region = (request.args.get('region') or '').strip() or None
    target_lang = (request.args.get('target_lang') or '').strip() or None

    if game_uuid and not query:
        game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
        if game:
            query = game.name or ''
            if not region:
                region = getattr(game, 'rom_region', None)
            if not platform and game.library is not None and game.library.platform is not None:
                platform = getattr(game.library.platform, 'name', None)

    if not query:
        return api_error('Query parameter q (or game_uuid) is required', code='bad_request')

    try:
        limit = min(int(request.args.get('limit') or 20), 50)
    except (TypeError, ValueError):
        limit = 20

    hits = search_all_patch_providers(
        query,
        platform=platform,
        region=region,
        target_lang=target_lang,
        limit=limit,
    )
    return jsonify(
        {
            'query': query,
            'platform': platform,
            'region': region,
            'target_lang': target_lang,
            'hits': [hit.to_dict() for hit in hits],
        }
    )


@apis_bp.route('/patch-catalog/attach', methods=['POST'])
@login_required
@admin_required
def patch_catalog_attach():
    if not _catalog_module_enabled():
        return _module_disabled_response()

    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return api_error('You do not have access to that game', code='forbidden')

    try:
        result = attach_patch_guide(
            game,
            source_url=data.get('source_url') or '',
            notes=(data.get('notes') or None),
            target_language=(data.get('target_language') or None),
            patch_format=(data.get('patch_format') or None),
        )
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    # `result` carries its own `ok: True`; api_ok drops it and re-stamps the
    # envelope so this success reads like every other one. The lint cannot see
    # a `jsonify(<name>)`, so nothing else would have caught the divergence.
    return api_ok(result, status=201)
