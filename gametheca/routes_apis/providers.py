"""Artwork provider API routes (search + apply cover — no game downloads)."""

from flask import jsonify, request
from flask_login import login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.artwork_apply import apply_cover_from_url
from gametheca.utils.auth import admin_required
from gametheca.utils.providers import ProviderDisabledError, get_provider, list_providers
from gametheca.utils.providers.giantbomb import pcgamingwiki_enrichment

from . import apis_bp


@apis_bp.route('/providers', methods=['GET'])
@login_required
@admin_required
def providers_list():
    """List registered artwork providers and whether each is enabled."""
    return jsonify({'providers': list_providers()})


@apis_bp.route('/providers/steamgriddb/search', methods=['GET'])
@login_required
@admin_required
def steamgriddb_search():
    """Search SteamGridDB artwork by game title (cover/logo/hero)."""
    query = (request.args.get('q') or request.args.get('query') or '').strip()
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400

    try:
        limit = min(int(request.args.get('limit') or 20), 50)
    except (TypeError, ValueError):
        limit = 20

    art_kind = (request.args.get('image_type') or request.args.get('art_kind') or 'cover').strip().lower()
    if art_kind not in ('cover', 'logo', 'hero'):
        return jsonify({'error': 'image_type must be cover, logo, or hero'}), 400

    provider = get_provider('steamgriddb')
    if not provider.is_enabled():
        return jsonify({
            'error': 'SteamGridDB is not configured. Set STEAMGRIDDB_API_KEY.',
            'provider': provider.id,
        }), 503

    try:
        results = provider.search_artwork(query, limit=limit, art_kind=art_kind)
    except ProviderDisabledError as exc:
        return jsonify({'error': exc.message, 'provider': exc.provider_id}), 503
    except RuntimeError as exc:
        return jsonify({'error': str(exc), 'provider': provider.id}), 502

    return jsonify({
        'provider': provider.id,
        'query': query,
        'image_type': art_kind,
        'results': [item.to_dict() for item in results],
    })


@apis_bp.route('/providers/igdb/search', methods=['GET'])
@login_required
@admin_required
def igdb_cover_search():
    """Search IGDB covers by game title (existing IGDB credentials)."""
    query = (request.args.get('q') or request.args.get('query') or '').strip()
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400

    try:
        limit = min(int(request.args.get('limit') or 20), 50)
    except (TypeError, ValueError):
        limit = 20

    provider = get_provider('igdb')
    if not provider.is_enabled():
        return jsonify({
            'error': 'IGDB is not configured. Set IGDB client ID/secret in Integrations.',
            'provider': provider.id,
        }), 503

    try:
        results = provider.search_covers(query, limit=limit)
    except ProviderDisabledError as exc:
        return jsonify({'error': exc.message, 'provider': exc.provider_id}), 503
    except RuntimeError as exc:
        return jsonify({'error': str(exc), 'provider': provider.id}), 502

    return jsonify({
        'provider': provider.id,
        'query': query,
        'results': [item.to_dict() for item in results],
    })


@apis_bp.route('/games/<game_uuid>/artwork/steamgriddb', methods=['POST'])
@login_required
@admin_required
def steamgriddb_apply_artwork(game_uuid):
    """Download a SteamGridDB (or IGDB) image URL and set it as cover/logo/hero."""
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found', 'game_uuid': game_uuid}), 404

    data = request.get_json(silent=True) or {}
    image_url = (data.get('url') or '').strip()
    image_type = (data.get('image_type') or 'cover').strip().lower()
    provider_id = (data.get('provider') or 'steamgriddb').strip().lower() or 'steamgriddb'
    if image_type not in ('cover', 'logo', 'hero'):
        return jsonify({'error': 'image_type must be cover, logo, or hero'}), 400
    if provider_id not in ('steamgriddb', 'igdb'):
        return jsonify({'error': 'provider must be steamgriddb or igdb'}), 400
    if provider_id == 'igdb' and image_type != 'cover':
        return jsonify({'error': 'IGDB only supports image_type=cover'}), 400

    try:
        result = apply_cover_from_url(
            game_uuid,
            image_url,
            provider_id=provider_id,
            image_type=image_type,
        )
    except ValueError as exc:
        return jsonify({'error': str(exc), 'game_uuid': game_uuid}), 400
    except LookupError as exc:
        return jsonify({'error': str(exc), 'game_uuid': game_uuid}), 404
    except ProviderDisabledError as exc:
        return jsonify({'error': exc.message, 'provider': exc.provider_id}), 503
    except RuntimeError as exc:
        return jsonify({'error': str(exc), 'game_uuid': game_uuid}), 503
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to apply artwork: {exc}', 'game_uuid': game_uuid}), 502

    return jsonify(result), 200


@apis_bp.route('/providers/giantbomb/search', methods=['GET'])
@login_required
@admin_required
def giantbomb_search():
    """Search GiantBomb covers by game title."""
    query = (request.args.get('q') or request.args.get('query') or '').strip()
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400
    try:
        limit = min(int(request.args.get('limit') or 20), 50)
    except (TypeError, ValueError):
        limit = 20

    provider = get_provider('giantbomb')
    if not provider.is_enabled():
        return jsonify({
            'error': 'GiantBomb is not configured. Set GIANTBOMB_API_KEY.',
            'provider': provider.id,
        }), 503
    try:
        results = provider.search_covers(query, limit=limit)
    except ProviderDisabledError as exc:
        return jsonify({'error': exc.message, 'provider': exc.provider_id}), 503
    except RuntimeError as exc:
        return jsonify({'error': str(exc), 'provider': provider.id}), 502

    return jsonify({
        'provider': provider.id,
        'query': query,
        'results': [item.to_dict() for item in results],
    })


@apis_bp.route('/providers/pcgamingwiki/search', methods=['GET'])
@login_required
def pcgamingwiki_search():
    """Find PCGamingWiki pages for a game title (links only)."""
    query = (request.args.get('q') or request.args.get('query') or '').strip()
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400
    try:
        return jsonify(pcgamingwiki_enrichment(query))
    except RuntimeError as exc:
        return jsonify({'error': str(exc), 'provider': 'pcgamingwiki'}), 502
