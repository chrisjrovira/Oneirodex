"""Manual multi-source metadata search for identify / add game UI."""

from flask import current_app, jsonify, request
from flask_login import login_required

from gametheca.utils.api_response import api_error
from gametheca.utils.auth import admin_required
from gametheca.utils.providers.meta_quest import (
    get_meta_quest_api_mode,
    normalize_meta_quest_source,
    unofficial_graphql_enabled,
)
from gametheca.utils.providers.mobygames import (
    get_mobygames_api_key,
    mobygames_config_hint,
)
from gametheca.utils.providers.thegamesdb import (
    get_thegamesdb_api_key,
    thegamesdb_config_hint,
)
from gametheca.utils.secondary_scrapers import (
    search_epic_games,
    search_giantbomb_games,
    search_gog_games,
    search_itch_games,
    search_meta_quest_games,
    search_mobygames_games,
    search_rawg_games,
    search_steam_games,
    search_thegamesdb_games,
)

from . import apis_bp

# DRM store sources are metadata / ownership-register only — never download games.
SUPPORTED_SOURCES = (
    'steam',
    'rawg',
    'gog',
    'epic',
    'itch',
    'giantbomb',
    'mobygames',
    'thegamesdb',
    'meta_quest',
)
# UI aliases accepted for Meta Quest Store (canonical id remains meta_quest).
_META_QUEST_ALIASES = frozenset({'meta_quest', 'meta', 'quest'})
# Aliases for MobyGames chip.
_MOBYGAMES_ALIASES = frozenset({'mobygames', 'moby'})
# Aliases for TheGamesDB chip.
_THEGAMESDB_ALIASES = frozenset({'thegamesdb', 'tgdb'})


@apis_bp.route('/search_metadata', methods=['GET'])
@login_required
@admin_required
def search_metadata():
    """Search Steam / RAWG / GOG / Epic / itch / GiantBomb / MobyGames / TheGamesDB / Meta Quest by name.

    Query args:
      name (required)
      source: steam|rawg|gog|epic|itch|giantbomb|mobygames|moby|thegamesdb|tgdb|meta_quest|meta|quest (required)
      limit: int (default 10, max 20)
      include_software: bool (Steam only, default true) — include Steam
        type=software/application hits for gaming-adjacent apps

    Meta Quest, Epic: ownership/register + metadata only — never DRM installs.
    Steam results include steam_type + item_kind for UI kind badges.
    MobyGames / TheGamesDB: optional API key — empty results when unset (honest, no 500).
    """
    name = (request.args.get('name') or '').strip()
    source_raw = (request.args.get('source') or '').strip().lower()
    source = normalize_meta_quest_source(source_raw) or source_raw
    if source_raw in _MOBYGAMES_ALIASES or source == 'moby':
        source = 'mobygames'
    if source_raw in _THEGAMESDB_ALIASES or source == 'tgdb':
        source = 'thegamesdb'
    try:
        limit = min(int(request.args.get('limit') or 10), 20)
    except (TypeError, ValueError):
        limit = 10
    include_software_raw = (request.args.get('include_software') or '1').strip().lower()
    include_software = include_software_raw not in ('0', 'false', 'no')

    if not name:
        return api_error('No game name provided', code='bad_request')
    if (
        source not in SUPPORTED_SOURCES
        and source_raw not in _META_QUEST_ALIASES
        and source_raw not in _MOBYGAMES_ALIASES
        and source_raw not in _THEGAMESDB_ALIASES
    ):
        return api_error(
            (
                f'Unsupported source. Use one of: {", ".join(SUPPORTED_SOURCES)} '
                '(aliases: meta, quest, moby, tgdb)'
            ),
            code='bad_request',
            sources=list(SUPPORTED_SOURCES),
        )

    mobygames_key_present = False
    thegamesdb_key_present = False
    if source == 'steam':
        results = search_steam_games(name, limit=limit, include_software=include_software)
    elif source == 'rawg':
        api_key = current_app.config.get('RAWG_API_KEY') or None
        results = search_rawg_games(name, api_key=api_key, limit=limit)
    elif source == 'gog':
        results = search_gog_games(name, limit=limit)
    elif source == 'epic':
        results = search_epic_games(name, limit=limit)
    elif source == 'itch':
        results = search_itch_games(name, limit=limit)
    elif source == 'giantbomb':
        results = search_giantbomb_games(name, limit=limit)
    elif source == 'mobygames':
        mobygames_key_present = bool(get_mobygames_api_key())
        results = search_mobygames_games(name, limit=limit)
    elif source == 'thegamesdb':
        thegamesdb_key_present = bool(get_thegamesdb_api_key())
        results = search_thegamesdb_games(name, limit=limit)
    else:
        results = search_meta_quest_games(name, limit=limit)
        source = 'meta_quest'

    payload = {
        'source': source,
        'results': results,
        'ownership_only': source in ('meta_quest', 'epic'),
    }
    if source == 'steam':
        payload['include_software'] = include_software
        payload['note'] = (
            'Steam results may include type=software (emulators/tools). '
            'Use item_kind for badges; never auto-treat software as IGDB Main Game. '
            'Ownership register-only — no DRM download queues.'
        )
    if source == 'mobygames':
        payload['needs_key'] = True
        payload['key_configured'] = mobygames_key_present
        if not mobygames_key_present:
            payload['note'] = (
                'MOBYGAMES_API_KEY not configured — empty results. '
                'Set env or GlobalSettings.mobygames_api_key '
                '(https://www.mobygames.com/info/api/). '
                'Metadata only — never downloads games.'
            )
        else:
            payload['note'] = (
                'MobyGames Class D metadata search. Select a hit → custom/enrich path. '
                'Not in Stage D scan cascade yet (manual identify only).'
            )
    if source == 'thegamesdb':
        payload['needs_key'] = True
        payload['key_configured'] = thegamesdb_key_present
        if not thegamesdb_key_present:
            payload['note'] = (
                'THEGAMESDB_API_KEY not configured — empty results. '
                'Set env or GlobalSettings.thegamesdb_api_key '
                '(https://thegamesdb.net/api/register.php). '
                'Metadata / covers only — never downloads games.'
            )
        else:
            payload['note'] = (
                'TheGamesDB Class D metadata search (console-friendly). '
                'Select a hit → custom/enrich path. '
                'Not in Stage D scan cascade yet (manual identify only).'
            )
    if source == 'meta_quest':
        payload['api_mode'] = get_meta_quest_api_mode()
        payload['unofficial_graphql'] = unofficial_graphql_enabled()
    return jsonify(payload)


@apis_bp.route('/search_metadata/sources', methods=['GET'])
@login_required
@admin_required
def search_metadata_sources():
    """List identify-search sources and whether each needs an API key."""
    mode = get_meta_quest_api_mode()
    moby_key = bool(get_mobygames_api_key())
    tgdb_key = bool(get_thegamesdb_api_key())
    return jsonify({
        'sources': [
            {'id': 'steam', 'name': 'Steam', 'needs_key': False, 'ownership_only': False,
             'includes_software': True,
             'note': 'Includes Steam type=software by default; results carry item_kind.'},
            {'id': 'rawg', 'name': 'RAWG', 'needs_key': True, 'ownership_only': False},
            {'id': 'gog', 'name': 'GOG', 'needs_key': False, 'ownership_only': False},
            {'id': 'epic', 'name': 'Epic Games Store', 'needs_key': False, 'ownership_only': True},
            {'id': 'itch', 'name': 'itch.io', 'needs_key': False, 'ownership_only': False},
            {'id': 'giantbomb', 'name': 'GiantBomb', 'needs_key': True, 'ownership_only': False},
            {
                'id': 'mobygames',
                'name': 'MobyGames',
                'aliases': ['moby'],
                'needs_key': True,
                'key_configured': moby_key,
                'ownership_only': False,
                'config_hint': mobygames_config_hint(),
                'note': (
                    'Optional Class D catalog search (MOBYGAMES_API_KEY). '
                    'Empty results when unset — no 500. Manual identify only; '
                    'not Stage D auto-cascade. Metadata / cover URLs only.'
                ),
            },
            {
                'id': 'thegamesdb',
                'name': 'TheGamesDB',
                'aliases': ['tgdb'],
                'needs_key': True,
                'key_configured': tgdb_key,
                'ownership_only': False,
                'config_hint': thegamesdb_config_hint(),
                'note': (
                    'Optional Class D catalog search (THEGAMESDB_API_KEY) — '
                    'console leaf identify / covers. Empty results when unset — no 500. '
                    'Manual identify only; not Stage D auto-cascade. Metadata / cover URLs only.'
                ),
            },
            {
                'id': 'meta_quest',
                'name': 'Meta Quest Store',
                'aliases': ['meta', 'quest'],
                'needs_key': False,
                'needs_igdb': mode == 'igdb',
                'ownership_only': True,
                'api_mode': mode,
                'api_modes': ['igdb', 'csv_only', 'disabled', 'unofficial_graphql'],
                'unofficial_graphql': unofficial_graphql_enabled(),
                'note': (
                    'Identify via IGDB Quest platforms by default (META_QUEST_API_MODE=igdb). '
                    'Ownership: CSV register-only (POST /api/ownership/meta_quest/csv). '
                    'Unofficial GraphQL is off unless META_QUEST_UNOFFICIAL_GRAPHQL=1. '
                    'Never downloads DRM titles. VR stays is_vr / Virtual Reality perspective.'
                ),
            },
        ],
    })
