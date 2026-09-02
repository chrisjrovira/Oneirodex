"""Software / experience identify helpers (non-IGDB Main Game path).

When IGDB has no high-confidence game match, enrich Unmatched proposals with
Steam software hits and suggested item_kind. Stage D (W20-5a) may auto-create a
custom-range Game from an exact Steam App ID / storesearch title, GOG exact
title, or Epic exact title before logging Unmatched (operator toggles under
Integrations → Metadata). Stage E (W21-BE-2) may attach propose-only
MobyGames / TheGamesDB exact-title hints after Stage D miss — never creates a
Game from those catalogs in W21. Never invents DRM download queues.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import uuid4

from flask import current_app, has_app_context
from sqlalchemy import func, select

from oneirodex import db
from oneirodex.models import Game, GameURL, UnmatchedFolder
from oneirodex.platform import NATIVE_PC_PLATFORMS
from oneirodex.utils.game_name_parse import parse_game_label
from oneirodex.utils.item_kind import (
    DEFAULT_ITEM_KIND,
    ITEM_KINDS,
    infer_item_kind_from_steam_type,
    is_denied_auto_game_match,
    normalize_item_kind,
    suggest_item_kind,
)
from oneirodex.utils.match_scoring import score_candidate
from oneirodex.utils.secondary_scrapers import (
    search_epic_games,
    search_gog_games,
    search_mobygames_games,
    search_steam_games,
    search_thegamesdb_games,
)

STAGE_D_SOURCE_ORDER = ('steam', 'gog', 'epic')


CUSTOM_IGDB_BASE = 2000000420

# Ownership / identify payloads must never carry install or download queue fields.
_FORBIDDEN_DRM_URL_KEYS = frozenset({
    'download_url',
    'install_url',
    'installer_url',
    'direct_download',
    'magnet',
    'torrent_url',
    'depot_url',
    'manifest_url',
})


def _next_custom_igdb_id() -> int:
    highest = db.session.execute(
        select(func.max(Game.igdb_id)).filter(Game.igdb_id >= CUSTOM_IGDB_BASE)
    ).scalar()
    return CUSTOM_IGDB_BASE if highest is None else int(highest) + 1


def build_software_search_queries(raw_label: str) -> list[str]:
    """Ordered unique queries for Steam software identify (incl. VR re-attach)."""
    parsed = parse_game_label(raw_label)
    cleaned = (parsed.get('cleaned_name') or '').strip()
    queries: list[str] = []
    if cleaned:
        queries.append(cleaned)
        if parsed.get('had_vr_suffix'):
            vr_form = f'{cleaned} VR'
            if vr_form not in queries:
                queries.append(vr_form)
    # Raw basename (light) as last resort when peel emptied the label oddly
    basename = (raw_label or '').replace('\\', '/').rstrip('/').split('/')[-1].strip()
    if basename and basename not in queries and basename.casefold() != cleaned.casefold():
        queries.append(basename)
    # Dedupe case-insensitively while preserving order
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        key = q.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(q)
    return out


def collect_software_identify_candidates(
    raw_label: str,
    *,
    limit: int = 10,
) -> list[dict]:
    """
    Search Steam (games + software) for identify candidates.

    Scores by cleaned name; tags item_kind / is_software. Does not call IGDB.
    """
    queries = build_software_search_queries(raw_label)
    if not queries:
        return []
    primary = queries[0]
    seen_ids: set[int] = set()
    ranked: list[dict] = []

    for query in queries:
        hits = search_steam_games(query, limit=limit, include_software=True)
        for hit in hits:
            app_id = hit.get('steam_app_id') or hit.get('id')
            try:
                app_id_int = int(app_id) if app_id is not None else None
            except (TypeError, ValueError):
                app_id_int = None
            if app_id_int is not None and app_id_int in seen_ids:
                continue
            if app_id_int is not None:
                seen_ids.add(app_id_int)
            name = hit.get('name') or ''
            score = float(score_candidate(primary, name) or 0.0)
            # Prefer exact/near matches against VR-reattached query as well
            for q in queries[1:]:
                score = max(score, float(score_candidate(q, name) or 0.0))
            kind = hit.get('item_kind') or suggest_item_kind(
                name, steam_type=hit.get('steam_type'),
            )
            if is_denied_auto_game_match(name) or is_denied_auto_game_match(primary):
                kind = 'tool'
            ranked.append({
                **hit,
                'steam_app_id': app_id_int,
                'match_score': round(score, 4),
                'item_kind': kind,
                'suggested_kind': kind,
                'deny_auto_game': is_denied_auto_game_match(name)
                or is_denied_auto_game_match(primary),
            })

    ranked.sort(key=lambda c: float(c.get('match_score') or 0), reverse=True)
    return ranked[:limit]


def enrich_proposal_with_software(proposal: dict, raw_label: str) -> dict:
    """Attach Steam software candidates + suggested_kind onto a match proposal."""
    if not isinstance(proposal, dict):
        proposal = {'proposal': {}}
    body = proposal.setdefault('proposal', {})
    software = collect_software_identify_candidates(raw_label, limit=10)
    body['software_candidates'] = [
        {
            'source': c.get('source') or 'steam',
            'steam_app_id': c.get('steam_app_id'),
            'name': c.get('name'),
            'steam_type': c.get('steam_type'),
            'item_kind': c.get('item_kind'),
            'score': c.get('match_score'),
            'url': c.get('url'),
            'cover_url': c.get('cover_url'),
            'is_software': bool(c.get('is_software')),
            'deny_auto_game': bool(c.get('deny_auto_game')),
        }
        for c in software
    ]
    suggested = DEFAULT_ITEM_KIND
    if software:
        top = software[0]
        suggested = normalize_item_kind(top.get('item_kind'))
        if top.get('deny_auto_game'):
            suggested = 'tool'
        elif top.get('is_software') and suggested == 'game':
            suggested = 'tool'
    elif is_denied_auto_game_match(raw_label) or is_denied_auto_game_match(
        body.get('cleaned_name')
    ):
        suggested = 'tool'
    body['suggested_kind'] = suggested
    body['identify_path'] = 'software' if software else 'unmatched'
    return proposal


def _casefold_title(value: str | None) -> str:
    return (value or '').casefold().strip()


def exact_title_hits(query: str, hits: list[dict] | None) -> list[dict]:
    """Return store hits whose name casefolds equal to query (exact only)."""
    needle = _casefold_title(query)
    if not needle:
        return []
    out: list[dict] = []
    for hit in hits or []:
        if not isinstance(hit, dict):
            continue
        if _casefold_title(hit.get('name')) == needle:
            out.append(hit)
    return out


_IDENTITY_NON_ALNUM = re.compile(r'[^a-z0-9]+')


def _identity_key(value: str | None) -> str:
    """Punctuation-tolerant title key: 'Half-Life 2' and 'Half Life 2' agree."""
    text = _IDENTITY_NON_ALNUM.sub(' ', (value or '').casefold()).strip()
    return ' '.join(text.split())


def titles_identify_agree(left: str | None, right: str | None) -> bool:
    key = _identity_key(left)
    return bool(key) and key == _identity_key(right)


def _catalog_http_allowed() -> bool:
    """Skip live Steam/GOG/Moby/TGDB in pytest. Production still consults them."""
    try:
        if has_app_context() and current_app.config.get('TESTING'):
            return False
    except Exception:
        pass
    return True


def gather_catalog_identify_signals(
    cleaned_name: str,
    library_platform: str | None = None,
) -> dict:
    """Exact-title rows from Steam / GOG / unique-exact Moby / TGDB.

    Unique-exact only for MobyGames and TheGamesDB (ambiguous exact is skipped,
    not a veto). Empty when keys are unset or pytest has TESTING=True.
    """
    query = (cleaned_name or '').strip()
    empty = {'rows': [], 'skipped': [], 'stage_e': {}}
    if not query:
        return empty
    if not _catalog_http_allowed():
        return {**empty, 'skipped': ['testing']}

    rows: list[dict] = []
    skipped: list[str] = []
    platform_key = (library_platform or '').strip() or None
    is_console = bool(platform_key) and platform_key not in NATIVE_PC_PLATFORMS

    try:
        steam_hits = search_steam_games(query, limit=10, include_software=False)
    except Exception as err:
        print(f'⚠️ [W34] Steam search failed: {err}')
        steam_hits = []
        skipped.append('steam')
    exact_steam = exact_title_hits(query, steam_hits)
    if len(exact_steam) == 1:
        rows.append(_candidate_from_steam_hit(exact_steam[0], match_mode='exact_title'))

    try:
        gog_hits = search_gog_games(query, limit=10)
    except Exception as err:
        print(f'⚠️ [W34] GOG search failed: {err}')
        gog_hits = []
        skipped.append('gog')
    exact_gog = exact_title_hits(query, gog_hits)
    if len(exact_gog) == 1:
        rows.append(_candidate_from_gog_hit(exact_gog[0]))

    try:
        from oneirodex.utils.providers.mobygames import get_mobygames_api_key

        moby_key = (get_mobygames_api_key() or '').strip()
    except Exception:
        moby_key = ''
    if not moby_key:
        skipped.append('mobygames_key_unset')
    else:
        try:
            moby_hits = search_mobygames_games(query, api_key=moby_key, limit=10)
        except Exception as err:
            print(f'⚠️ [W34] MobyGames search failed: {err}')
            moby_hits = []
        exact_moby = exact_title_hits(query, moby_hits)
        if len(exact_moby) == 1:
            hit = exact_moby[0]
            rows.append({
                'source': 'mobygames',
                'name': (hit.get('name') or '').strip(),
                'match_mode': 'moby_exact',
                'url': (hit.get('url') or '').strip() or None,
                'mobygames_id': hit.get('mobygames_id') or hit.get('id'),
            })

    if is_console:
        try:
            from oneirodex.utils.providers.thegamesdb import get_thegamesdb_api_key

            tgdb_key = (get_thegamesdb_api_key() or '').strip()
        except Exception:
            tgdb_key = ''
        if not tgdb_key:
            skipped.append('thegamesdb_key_unset')
        else:
            try:
                tgdb_hits = search_thegamesdb_games(query, limit=10)
            except Exception as err:
                print(f'⚠️ [W34] TheGamesDB search failed: {err}')
                tgdb_hits = []
            exact_tgdb = exact_title_hits(query, tgdb_hits)
            if len(exact_tgdb) == 1:
                hit = exact_tgdb[0]
                rows.append({
                    'source': 'thegamesdb',
                    'name': (hit.get('name') or '').strip(),
                    'match_mode': 'tgdb_exact',
                    'url': (hit.get('url') or '').strip() or None,
                    'thegamesdb_id': hit.get('thegamesdb_id') or hit.get('id'),
                })

    return {'rows': rows, 'skipped': skipped, 'stage_e': {}}


def corroborate_igdb_with_catalogs(
    *,
    igdb_name: str | None,
    cleaned_name: str | None,
    library_platform: str | None = None,
) -> dict:
    """Compare a high-confidence IGDB title to unique-exact catalog hits.

    ``disagree``: a catalog unique-exact title identity-matches the folder but
    not IGDB (folder Doom / IGDB Doom 3 / Moby Doom). ``agree``: a catalog
    title identity-matches IGDB. Remaster/subtitle tails that match neither
    identity are ``no_signal``, not a veto.
    """
    gathered = gather_catalog_identify_signals(
        cleaned_name or '',
        library_platform,
    )
    agreed: list[dict] = []
    disagreed: list[dict] = []
    for row in gathered.get('rows') or []:
        if not isinstance(row, dict):
            continue
        catalog_name = row.get('name')
        if titles_identify_agree(igdb_name, catalog_name):
            agreed.append(row)
        elif titles_identify_agree(cleaned_name, catalog_name):
            disagreed.append(row)
    if disagreed:
        verdict = 'disagree'
    elif agreed:
        verdict = 'agree'
    else:
        verdict = 'no_signal'
    return {
        'verdict': verdict,
        'agreed': agreed,
        'disagreed': disagreed,
        'skipped': list(gathered.get('skipped') or []),
    }


def apply_catalog_identity_to_game(game, rows: list[dict] | None) -> None:
    """Fill-only Steam / Moby identity from agreeing catalog rows. Never a download URL."""
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        source = (row.get('source') or '').strip().lower()
        if source == 'steam' and not getattr(game, 'steam_app_id', None):
            app_id = row.get('steam_app_id') or row.get('id')
            try:
                app_id_int = int(app_id) if app_id is not None else None
            except (TypeError, ValueError):
                app_id_int = None
            if app_id_int:
                game.steam_app_id = app_id_int
                game.steam_url = f'https://store.steampowered.com/app/{app_id_int}/'
        elif source == 'mobygames':
            url = (row.get('url') or '').strip()
            if not url:
                continue
            lowered = url.lower()
            if any(token in lowered for token in ('download', 'install', 'magnet', 'torrent')):
                continue
            db.session.add(GameURL(
                game_uuid=game.uuid,
                url_type='mobygames',
                url=url,
            ))


def scrub_stage_d_payload(payload: dict) -> dict:
    """Drop install/download queue fields — register-only ownership/metadata."""
    if not isinstance(payload, dict):
        return {}
    return {k: v for k, v in payload.items() if k not in _FORBIDDEN_DRM_URL_KEYS}


def _candidate_from_steam_details(
    details: dict,
    *,
    steam_app_id: int,
    fallback_name: str,
) -> dict:
    name = (details.get('name') or fallback_name or '').strip() or fallback_name
    steam_type = details.get('steam_type')
    kind = infer_item_kind_from_steam_type(steam_type, name=name)
    if is_denied_auto_game_match(name) and kind == DEFAULT_ITEM_KIND:
        kind = 'tool'
    return scrub_stage_d_payload({
        'source': 'steam',
        'name': name,
        'summary': details.get('short_description'),
        'cover_url': details.get('header_image'),
        'steam_app_id': int(steam_app_id),
        'steam_type': steam_type,
        'item_kind': kind,
        'url': f'https://store.steampowered.com/app/{int(steam_app_id)}/',
        'identify_path': 'stage_d',
        'match_mode': 'app_id',
    })


def _candidate_from_steam_hit(hit: dict, *, match_mode: str) -> dict:
    app_id = hit.get('steam_app_id') or hit.get('id')
    try:
        app_id_int = int(app_id) if app_id is not None else None
    except (TypeError, ValueError):
        app_id_int = None
    name = (hit.get('name') or '').strip()
    steam_type = hit.get('steam_type')
    kind = hit.get('item_kind') or infer_item_kind_from_steam_type(
        steam_type, name=name,
    )
    if is_denied_auto_game_match(name) and normalize_item_kind(kind) == DEFAULT_ITEM_KIND:
        kind = 'tool'
    return scrub_stage_d_payload({
        'source': 'steam',
        'name': name,
        'summary': hit.get('summary'),
        'cover_url': hit.get('cover_url'),
        'steam_app_id': app_id_int,
        'steam_type': steam_type,
        'item_kind': normalize_item_kind(kind),
        'url': hit.get('url') or (
            f'https://store.steampowered.com/app/{app_id_int}/' if app_id_int else None
        ),
        'identify_path': 'stage_d',
        'match_mode': match_mode,
    })


def _candidate_from_gog_hit(hit: dict) -> dict:
    gog_id = hit.get('gog_id') or hit.get('id')
    try:
        gog_id_int = int(gog_id) if gog_id is not None else None
    except (TypeError, ValueError):
        gog_id_int = None
    name = (hit.get('name') or '').strip()
    kind = DEFAULT_ITEM_KIND
    if is_denied_auto_game_match(name):
        kind = 'tool'
    # Store page only — never install/download URLs.
    store_url = hit.get('url')
    if store_url and any(
        token in str(store_url).lower()
        for token in ('download', 'install', 'checkout', 'cart')
    ):
        store_url = None
    return scrub_stage_d_payload({
        'source': 'gog',
        'name': name,
        'summary': hit.get('summary'),
        'cover_url': hit.get('cover_url'),
        'gog_id': gog_id_int,
        'slug': hit.get('slug'),
        'item_kind': kind,
        'url': store_url,
        'identify_path': 'stage_d',
        'match_mode': 'exact_title',
    })


def _candidate_from_epic_hit(hit: dict) -> dict:
    epic_id = hit.get('epic_id') or hit.get('id')
    name = (hit.get('name') or '').strip()
    kind = DEFAULT_ITEM_KIND
    if is_denied_auto_game_match(name):
        kind = 'tool'
    store_url = hit.get('url')
    if store_url and any(
        token in str(store_url).lower()
        for token in ('download', 'install', 'checkout', 'cart')
    ):
        store_url = None
    return scrub_stage_d_payload({
        'source': 'epic',
        'name': name,
        'summary': hit.get('summary'),
        'cover_url': hit.get('cover_url'),
        'epic_id': epic_id,
        'slug': hit.get('slug'),
        'item_kind': kind,
        'url': store_url,
        'identify_path': 'stage_d',
        'match_mode': 'exact_title',
        'ownership_only': True,
    })


def igdb_retry_title_from_store(
    candidate: dict | None,
    already: list[str] | tuple[str, ...] | set[str] | None = None,
) -> str | None:
    """Store canonical title we have not already searched on IGDB.

    Used after an IGDB miss: exact Steam/GOG/Epic title → one more IGDB pass
    before creating a custom-range Stage D game. Improves hit-rate for messy
    folder names without fuzzy auto-import.
    """
    if not isinstance(candidate, dict):
        return None
    name = (candidate.get('name') or '').strip()
    if not name:
        return None
    seen = {
        (item or '').casefold().strip()
        for item in (already or [])
        if (item or '').strip()
    }
    if name.casefold().strip() in seen:
        return None
    return name


def _enabled_stage_d_sources(sources=None) -> tuple[str, ...]:
    if sources is None:
        try:
            from oneirodex.utils.metadata_providers import stage_d_source_ids

            sources = stage_d_source_ids()
        except Exception:
            sources = STAGE_D_SOURCE_ORDER
    enabled = {str(item).strip().lower() for item in (sources or ()) if item}
    return tuple(item for item in STAGE_D_SOURCE_ORDER if item in enabled)


def _stage_d_titles_corroborate(folder_title: str | None, store_title: str | None) -> bool:
    """
    Conservative App-ID title gate: folder label must match or be a clear
    primary-title prefix of the store title (remaster / subtitle tails OK).

    Rejects wrong-namespace paren digits that resolve to an unrelated Steam app.
    """
    folder = _casefold_title(folder_title or '')
    store = _casefold_title(store_title or '')
    if not folder or not store:
        return False
    if folder == store:
        return True
    # "Broken Sword 2" vs "Broken Sword 2 - the Smoking Mirror: Remastered"
    for sep in (' - ', ': ', ' — ', ' – '):
        head = store.split(sep, 1)[0].strip()
        if head and folder == head:
            return True
    if store.startswith(folder + ' ') or store.startswith(folder + ':'):
        return True
    if store.startswith(folder + '-'):
        return True
    return False


def resolve_stage_d_store_candidate(
    *,
    cleaned_name: str,
    steam_app_id: int | None = None,
    steam_title: str | None = None,
    sources=None,
) -> dict | None:
    """
    Stage D confidence gate: App ID or exact (casefold) store title only.

    Ambiguous multi-hit exact titles → None (caller keeps proposal / Unmatched).
    Fuzzy / near matches are never auto-imported.
    Order: Steam App ID (verified details + title corroboration) → Steam exact
    title → GOG exact title → Epic exact title.

    ``sources`` limits which stores run (operator Integrations toggles). Default
    is all three when the settings module is available.

    Paren digits that fail Steam details (wrong namespace) do **not** stamp a
    bogus steam_app_id — fall through to exact-title search instead.
    """
    enabled = _enabled_stage_d_sources(sources)
    if not enabled:
        return None

    fallback_name = (cleaned_name or steam_title or '').strip()
    app_id = None
    if 'steam' in enabled and steam_app_id is not None:
        try:
            app_id = int(steam_app_id)
        except (TypeError, ValueError):
            app_id = None
    if 'steam' in enabled and app_id and app_id > 0:
        from oneirodex.utils.steam_lookup import fetch_steam_app_details

        details = fetch_steam_app_details(app_id)
        if details:
            store_name = (details.get('name') or '').strip()
            # Prefer folder cleaned name; steam_title hint is already store-sourced.
            corroborate_against = fallback_name or store_name
            if _stage_d_titles_corroborate(corroborate_against, store_name):
                return _candidate_from_steam_details(
                    details, steam_app_id=app_id, fallback_name=fallback_name,
                )
            # Live Steam hit but title mismatch → ignore App ID, try exact title.
        # Details miss or title mismatch: do not invent steam_app_id identity.

    queries: list[str] = []
    for q in (cleaned_name, steam_title):
        text = (q or '').strip()
        if not text:
            continue
        if _casefold_title(text) in {_casefold_title(x) for x in queries}:
            continue
        queries.append(text)

    if 'steam' in enabled:
        for query in queries:
            hits = search_steam_games(query, limit=10, include_software=True)
            exact = exact_title_hits(query, hits)
            if len(exact) == 1:
                return _candidate_from_steam_hit(exact[0], match_mode='exact_title')
            if len(exact) > 1:
                return None  # ambiguous — do not auto-import

    if 'gog' in enabled:
        for query in queries:
            hits = search_gog_games(query, limit=10)
            exact = exact_title_hits(query, hits)
            if len(exact) == 1:
                return _candidate_from_gog_hit(exact[0])
            if len(exact) > 1:
                return None

    if 'epic' in enabled:
        for query in queries:
            hits = search_epic_games(query, limit=10)
            exact = exact_title_hits(query, hits)
            if len(exact) == 1:
                return _candidate_from_epic_hit(exact[0])
            if len(exact) > 1:
                return None

    # Deliberately stops here. TheGamesDB / MobyGames are *not* part of the
    # Stage D auto-cascade — they run in Stage E as propose-only, because a
    # catalogue title match has no store identity to corroborate it and the
    # score gates for auto-import have not been proven. Adding them here would
    # auto-create games from a single fuzzy-adjacent title match.
    return None


def _attach_store_url(game, *, url_type: str, url: str | None) -> None:
    store_url = (url or '').strip()
    if not store_url or not game:
        return
    lowered = store_url.lower()
    if any(token in lowered for token in ('download', 'install', 'checkout', 'cart', 'magnet')):
        return
    already = any(
        (getattr(row, 'url_type', '') or '').lower() == url_type
        for row in (game.urls or [])
    )
    if already:
        return
    db.session.add(GameURL(
        game_uuid=game.uuid,
        url_type=url_type,
        url=store_url,
    ))


def create_custom_kinded_game(
    *,
    name: str,
    full_disk_path: str,
    library_uuid: str,
    item_kind: str = DEFAULT_ITEM_KIND,
    steam_app_id: int | None = None,
    gog_id: int | None = None,
    gog_url: str | None = None,
    epic_url: str | None = None,
    summary: str | None = None,
    cover: str | None = None,
    size: int = 0,
) -> Game:
    """
    Create a custom-range Game with item_kind (no real IGDB id).

    Used by Unmatched mark_kind, Stage D store cascade, and software identify.
    GOG / Epic identity is register-only via GameURL (no dedicated gog_id column).
    """
    kind = normalize_item_kind(item_kind)
    if kind not in ITEM_KINDS:
        kind = DEFAULT_ITEM_KIND
    custom_id = _next_custom_igdb_id()
    game = Game(
        igdb_id=custom_id,
        name=(name or '').strip() or 'Untitled',
        summary=summary,
        full_disk_path=full_disk_path,
        library_uuid=library_uuid,
        cover=cover,
        size=int(size or 0),
        steam_app_id=steam_app_id,
        item_kind=kind,
        date_created=datetime.now(timezone.utc),
        date_identified=datetime.now(timezone.utc),
        slug=f"custom-{custom_id}-{uuid4().hex[:8]}",
        path_status='ok',
    )
    if steam_app_id:
        game.steam_url = f'https://store.steampowered.com/app/{int(steam_app_id)}/'
    db.session.add(game)
    db.session.flush()
    try:
        from oneirodex.utils.rom_language import apply_rom_language_fields

        apply_rom_language_fields(game, full_disk_path or name)
    except Exception:
        pass
    if gog_id or gog_url:
        store_url = (gog_url or '').strip()
        if not store_url and gog_id:
            # Product id alone — store as typed register link without inventing a download URL.
            store_url = f'https://www.gog.com/game/{int(gog_id)}'
        _attach_store_url(game, url_type='gog', url=store_url)
    if epic_url:
        _attach_store_url(game, url_type='epic', url=epic_url)
    return game


def upsert_stage_d_custom_game(
    *,
    candidate: dict,
    full_disk_path: str,
    library_uuid: str,
    size: int = 0,
) -> Game:
    """
    Create or update a custom-range Game from a Stage D store candidate.

    Update applies only when a custom Game already exists for the same path
    (and matching store id when present). Never attaches DRM install URLs.
    """
    candidate = scrub_stage_d_payload(candidate or {})
    name = (candidate.get('name') or '').strip() or 'Untitled'
    kind = normalize_item_kind(candidate.get('item_kind'))
    steam_app_id = candidate.get('steam_app_id')
    try:
        steam_app_id = int(steam_app_id) if steam_app_id is not None else None
    except (TypeError, ValueError):
        steam_app_id = None
    gog_id = candidate.get('gog_id')
    try:
        gog_id = int(gog_id) if gog_id is not None else None
    except (TypeError, ValueError):
        gog_id = None
    summary = candidate.get('summary')
    cover = candidate.get('cover_url') or candidate.get('cover')
    gog_url = candidate.get('url') if candidate.get('source') == 'gog' else None
    epic_url = candidate.get('url') if candidate.get('source') == 'epic' else None

    existing = db.session.execute(
        select(Game).filter(
            Game.full_disk_path == full_disk_path,
            Game.library_uuid == library_uuid,
            Game.igdb_id >= CUSTOM_IGDB_BASE,
        )
    ).scalar_one_or_none()

    if existing is None and steam_app_id is not None:
        existing = db.session.execute(
            select(Game).filter(
                Game.library_uuid == library_uuid,
                Game.steam_app_id == steam_app_id,
                Game.full_disk_path == full_disk_path,
                Game.igdb_id >= CUSTOM_IGDB_BASE,
            )
        ).scalar_one_or_none()

    if existing is not None:
        existing.name = name
        if summary:
            existing.summary = summary
        if cover:
            existing.cover = cover
        existing.item_kind = kind
        existing.date_identified = datetime.now(timezone.utc)
        existing.path_status = 'ok'
        if steam_app_id:
            existing.steam_app_id = steam_app_id
            existing.steam_url = f'https://store.steampowered.com/app/{int(steam_app_id)}/'
        if gog_id or gog_url:
            store_url = (gog_url or '').strip()
            if not store_url and gog_id:
                store_url = f'https://www.gog.com/game/{int(gog_id)}'
            _attach_store_url(existing, url_type='gog', url=store_url)
        if epic_url:
            _attach_store_url(existing, url_type='epic', url=epic_url)
        try:
            from oneirodex.utils.rom_language import apply_rom_language_fields

            apply_rom_language_fields(existing, full_disk_path or name)
        except Exception:
            pass
        _hydrate_steam_content(existing, steam_app_id)
        return existing

    created = create_custom_kinded_game(
        name=name,
        full_disk_path=full_disk_path,
        library_uuid=library_uuid,
        item_kind=kind,
        steam_app_id=steam_app_id,
        gog_id=gog_id,
        gog_url=gog_url,
        epic_url=epic_url,
        summary=summary,
        cover=cover,
        size=size,
    )
    _hydrate_steam_content(created, steam_app_id)
    return created


def _hydrate_steam_content(game, steam_app_id) -> None:
    """Pull full store content (summary, genres, dev/publisher, release, modes).

    The storesearch hit that identified the title carries no description and no
    taxonomy, so without this a Stage D game lands with every box empty.

    A Steam App ID gets the direct ``appdetails`` path, which is the richest
    source we have. Everything else — a GOG-identified title, or a console ROM
    that never touched a PC store — falls through to the multi-source cascade,
    which used to be skipped entirely: this function returned early without an
    App ID, so those titles got no enrichment at all.

    Failures are swallowed on purpose — a metadata miss must not undo an
    identification.
    """
    if not game:
        return

    try:
        if steam_app_id:
            from oneirodex.utils.steam_metadata import hydrate_game_from_steam

            hydrate_game_from_steam(game, app_id=steam_app_id)
            # Steam answered on the fields it covers; anything still empty is
            # worth one more pass through the other sources.
            from oneirodex.utils.secondary_scrapers import missing_core_fields

            if not missing_core_fields({
                'summary': getattr(game, 'summary', None),
                'genres': list(getattr(game, 'genres', []) or []),
                'developer': getattr(game, 'developer_id', None),
            }):
                return

        from oneirodex.utils.metadata_cascade import hydrate_game_from_cascade

        # With an App ID we already pulled Steam's own appdetails above, which
        # is strictly richer than what the cascade's name search would return.
        hydrate_game_from_cascade(game, skip=('steam',) if steam_app_id else ())
    except Exception as exc:  # noqa: BLE001
        print(f'Content hydrate skipped for {getattr(game, "name", "?")}: {exc}')


def try_stage_d_store_identify(
    *,
    raw_label: str,
    cleaned_name: str,
    full_disk_path: str,
    library_uuid: str,
    steam_app_id: int | None = None,
    steam_title: str | None = None,
    size: int = 0,
    candidate: dict | None = None,
    sources=None,
) -> Game | None:
    """
    IGDB-miss Stage D entry: resolve exact/App-ID store hit and commit custom Game.

    Returns Game on success, None on miss/ambiguous (caller logs Unmatched).
    Flushes the session; caller is responsible for commit.

    Pass ``candidate`` when the caller already resolved a store hit (e.g. for an
    IGDB retry with the store's canonical title) so Stage D does not re-query.
    """
    if candidate is None:
        candidate = resolve_stage_d_store_candidate(
            cleaned_name=cleaned_name or raw_label,
            steam_app_id=steam_app_id,
            steam_title=steam_title,
            sources=sources,
        )
    if not candidate:
        return None
    game = upsert_stage_d_custom_game(
        candidate=candidate,
        full_disk_path=full_disk_path,
        library_uuid=library_uuid,
        size=size,
    )
    db.session.flush()
    return game


def _norm_platform_token(value: str | None) -> str:
    return re.sub(r'[^a-z0-9]', '', (value or '').casefold())


# Extra TGDB name needles keyed by LibraryPlatform enum name (beyond .value).
_TGDB_PLATFORM_ALIASES: dict[str, tuple[str, ...]] = {
    'GB': ('nintendo game boy', 'game boy'),
    'GBC': ('nintendo game boy color', 'game boy color', 'gbc'),
    'GBA': ('nintendo game boy advance', 'game boy advance', 'gba'),
    'NES': ('nintendo entertainment system', 'nes', 'famicom'),
    'SNES': ('super nintendo', 'snes', 'super famicom'),
    'N64': ('nintendo 64', 'n64'),
    'NDS': ('nintendo ds', 'nds'),
    'N3DS': ('nintendo 3ds', '3ds'),
    'NGC': ('nintendo gamecube', 'gamecube'),
    'WII': ('nintendo wii', 'wii'),
    'WII_U': ('wii u', 'wiiu'),
    'VB': ('nintendo virtual boy', 'virtual boy'),
    'SEGA_MD': ('sega genesis', 'mega drive', 'genesis'),
    'SEGA_MS': ('sega master system', 'master system'),
    'SEGA_GG': ('sega game gear', 'game gear'),
    'SEGA_CD': ('sega cd', 'mega cd'),
    'SEGA_32X': ('sega 32x', '32x'),
    'SEGA_SATURN': ('sega saturn', 'saturn'),
    'SEGA_DC': ('sega dreamcast', 'dreamcast'),
    'SEGA_SG1000': ('sg-1000', 'sg1000'),
    'SEGA_PICO': ('sega pico',),
    'PSX': ('playstation', 'psx', 'ps1'),
    'PS2': ('playstation 2', 'ps2'),
    'PS3': ('playstation 3', 'ps3'),
    'PSP': ('playstation portable', 'psp'),
    'PSVITA': ('ps vita', 'vita'),
    'XBOX': ('xbox',),
    'X360': ('xbox 360',),
    'XONE': ('xbox one', 'xboxone'),
    'PCWIN': ('pc', 'windows', 'microsoft windows'),
    'PCDOS': ('dos', 'ms-dos', 'pc'),
    'PCE': ('pc engine', 'turbografx', 'tg16', 'hu card'),
    'PCE_CD': ('pc engine cd', 'turbografx-cd', 'turbografx cd', 'tgcd'),
    'SUPERGRAFX': ('supergrafx', 'pc engine supergrafx'),
    'NGP': ('neo geo pocket', 'ngp'),
    'NGPC': ('neo geo pocket color', 'ngpc'),
    # BE-DET-8 — AES vs CD stay distinct (substring-safe matching in tgdb_platform_matches).
    'NEOGEO': ('neo geo aes', 'aes'),
    'NEOGEO_CD': ('neo geo cd', 'neocd'),
    'ARCADE': ('arcade',),
    'INTV': ('intellivision',),
    'CHAF': ('channel f', 'fairchild'),
    'O2EM': ('odyssey 2', 'odyssey2', 'videopac'),
    'THREEDO': ('3do',),
    'VECTREX': ('vectrex',),
    'SUPERVISION': ('watara', 'supervision'),
    'GX4000': ('gx4000',),
    'ASTROCADE': ('astrocade',),
    'ARCADIA': ('arcadia 2001',),
    'POKE_MINI': ('pokemon mini', 'pokémon mini'),
    'GAME_WATCH': ('game & watch', 'game watch', 'g&w'),
    'CD_I': ('cd-i', 'philips cd-i'),
    'JAGUAR_CD': ('jaguar cd', 'atari jaguar cd'),
    'AMIGA_CD32': ('amiga cd32', 'cd32'),
    'MSX': ('msx',),
    'ZX_SPECTRUM': ('zx spectrum', 'spectrum'),
    'CPC': ('amstrad cpc',),
    'ATARI_ST': ('atari st',),
    'APPLE_II': ('apple ii', 'apple 2'),
    'ATARI_8BIT': ('atari 8-bit', 'atari 800'),
    'X68000': ('x68000', 'x68k'),
    'PC_98': ('pc-98', 'pc98'),
    'BBC_MICRO': ('bbc micro', 'bbc microcomputer'),
}

# Short library keys: reject tokens that belong to a longer sibling.
# Needle substring otherwise maps Game Boy → Color, Wii → Wii U, etc.
_TGDB_SHORT_REJECT: dict[str, tuple[str, ...]] = {
    'GB': ('color', 'advance', 'gbc', 'gba'),
    'WII': ('wiiu',),
    'JAGUAR': ('jaguarcd', 'cd'),
    'AMIGA': ('cd32',),
    'NGP': ('color', 'ngpc'),
    'PCE': ('cd', 'supergrafx'),
    'PSX': (
        'playstation2', 'playstation3', 'playstation4', 'playstation5',
        'playstationportable', 'psp', 'vita', 'ps2', 'ps3', 'ps4', 'ps5',
    ),
    'XBOX': ('360', 'xboxone', 'series'),
    'NEOGEO': ('pocket',),
}

# Long library keys: token must carry a specificity marker so a short sibling
# name cannot pass via ``needle in token``.
_TGDB_LONG_REQUIRE: dict[str, tuple[str, ...]] = {
    'GBC': ('color', 'gbc'),
    'GBA': ('advance', 'gba'),
    'WII_U': ('wiiu',),
    'JAGUAR_CD': ('cd',),
    'AMIGA_CD32': ('cd32',),
    'NGPC': ('color', 'ngpc'),
    'NGP': ('pocket', 'ngp'),
    'PCE_CD': ('cd',),
    'SUPERGRAFX': ('supergrafx',),
    'PS2': ('playstation2', 'ps2'),
    'PS3': ('playstation3', 'ps3'),
    'PSP': ('portable', 'psp'),
    'PSVITA': ('vita',),
    'X360': ('360',),
    'XONE': ('xboxone',),
}


def _tgdb_family_allows(key: str, token: str) -> bool:
    """False when a sibling platform stole this hit via substring overlap."""
    require = _TGDB_LONG_REQUIRE.get(key)
    if require and not any(marker in token for marker in require):
        return False
    reject = _TGDB_SHORT_REJECT.get(key)
    if reject and any(marker in token for marker in reject):
        return False
    return True


def _library_platform_needles(library_platform: str | None) -> list[str]:
    """Normalized needles for TGDB platform-name matching."""
    key = (library_platform or '').strip()
    if not key:
        return []
    needles: list[str] = []
    try:
        from oneirodex.platform import LibraryPlatform

        plat = LibraryPlatform[key]
        needles.append(_norm_platform_token(plat.value))
        needles.append(_norm_platform_token(plat.name))
    except (KeyError, TypeError):
        needles.append(_norm_platform_token(key))
    for alias in _TGDB_PLATFORM_ALIASES.get(key, ()):
        needles.append(_norm_platform_token(alias))
    # Dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for n in needles:
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def _tgdb_token_is_neogeo_cd(token: str) -> bool:
    """True when a normalized TGDB platform token denotes Neo Geo CD (not AES)."""
    if not token:
        return False
    if 'neocd' in token:
        return True
    if 'cd' in token and 'neogeo' in token:
        return True
    return token in ('neogeocd', 'neocd')


def _tgdb_token_is_neogeo_aes(token: str) -> bool:
    """True when a normalized TGDB platform token denotes Neo Geo AES (not CD)."""
    if not token or _tgdb_token_is_neogeo_cd(token):
        return False
    if 'pocket' in token:
        return False
    if 'aes' in token:
        return True
    if token in ('neogeo', 'neogeoaes'):
        return True
    # "Neo Geo" without CD — treat as AES cart family, never CD.
    return 'neogeo' in token


def tgdb_platform_matches(
    hit_platforms: list | None,
    library_platform: str | None,
) -> bool:
    """True when any TGDB platform name corroborates the library leaf platform.

    BE-DET-8 hard guard: Neo Geo AES (``NEOGEO``) never matches Neo Geo CD
    hits (and reverse) — substring ``neogeo`` ⊂ ``neogeocd`` must not leak.
    Longer siblings (Wii U, Game Boy Color, Jaguar CD, …) stay distinct from
    the short name they contain.
    """
    key = (library_platform or '').strip()
    if not key:
        return False

    names: list[str] = []
    for p in hit_platforms or []:
        if isinstance(p, str):
            names.append(p)
        elif isinstance(p, dict):
            names.append(p.get('platform_name') or p.get('name') or '')
    if not names:
        return False

    # Dedicated AES ↔ CD gate (never cross-map). Pocket is not AES.
    if key in ('NEOGEO', 'NEOGEO_CD'):
        for name in names:
            token = _norm_platform_token(name)
            if not token:
                continue
            if key == 'NEOGEO_CD':
                if _tgdb_token_is_neogeo_cd(token):
                    return True
            elif _tgdb_token_is_neogeo_aes(token):
                return True
        return False

    needles = _library_platform_needles(library_platform)
    if not needles:
        return False
    for name in names:
        token = _norm_platform_token(name)
        if not token or not _tgdb_family_allows(key, token):
            continue
        for needle in needles:
            if needle == token or needle in token or token in needle:
                return True
    return False


def filter_tgdb_hits_for_platform(
    hits: list[dict] | None,
    library_platform: str | None,
) -> list[dict]:
    """Keep TGDB hits whose platform list matches the library console leaf."""
    out: list[dict] = []
    for hit in hits or []:
        if not isinstance(hit, dict):
            continue
        if tgdb_platform_matches(hit.get('platforms'), library_platform):
            out.append(hit)
    return out


def _stage_e_candidate_row(hit: dict, *, match_mode: str) -> dict:
    """Scrubbed propose-only candidate (metadata URLs only)."""
    source = (hit.get('source') or '').strip() or 'unknown'
    return scrub_stage_d_payload({
        'source': source,
        'id': hit.get('id') or hit.get('mobygames_id') or hit.get('thegamesdb_id'),
        'name': hit.get('name'),
        'url': hit.get('url'),
        'cover_url': hit.get('cover_url'),
        'summary': hit.get('summary'),
        'mobygames_id': hit.get('mobygames_id'),
        'thegamesdb_id': hit.get('thegamesdb_id'),
        'platforms': hit.get('platforms'),
        'identify_path': 'stage_e',
        'match_mode': match_mode,
        'propose_only': True,
    })


def resolve_stage_e_catalog_hints(
    *,
    cleaned_name: str,
    library_platform: str | None = None,
) -> dict:
    """
    Stage E propose-only after Stage D miss.

    - MobyGames: exact title (casefold) when API key configured; skip silently if unset.
    - TheGamesDB: exact title + platform filter for console leaves when key configured.
    - Never creates a Game (W21: Moby always propose-only; TGDB propose-only too).

    Returns a hint dict with ``candidates``, optional ``suggested_candidate_name``,
    and ``match_reason`` / ``identify_path`` for proposal sidecar enrichment.
    """
    query = (cleaned_name or '').strip()
    empty = {
        'candidates': [],
        'suggested_candidate_name': None,
        'match_reason': None,
        'identify_path': None,
        'skipped': [],
    }
    if not query:
        return empty

    platform_key = (library_platform or '').strip() or None
    is_pc = (not platform_key) or platform_key in NATIVE_PC_PLATFORMS
    is_console = bool(platform_key) and platform_key not in NATIVE_PC_PLATFORMS

    candidates: list[dict] = []
    skipped: list[str] = []
    preferred_name: str | None = None
    match_reason: str | None = None

    # --- MobyGames (PC preferred; also OK as propose hint on any leaf) ---
    try:
        from oneirodex.utils.providers.mobygames import get_mobygames_api_key

        moby_key = (get_mobygames_api_key() or '').strip()
    except Exception:
        moby_key = ''
    if not moby_key:
        skipped.append('mobygames_key_unset')
    else:
        try:
            moby_hits = search_mobygames_games(query, api_key=moby_key, limit=10)
        except Exception as err:
            print(f'⚠️ [Stage E] MobyGames search failed: {err}')
            moby_hits = []
        exact_moby = exact_title_hits(query, moby_hits)
        if len(exact_moby) == 1:
            row = _stage_e_candidate_row(exact_moby[0], match_mode='moby_exact')
            candidates.append(row)
            if preferred_name is None:
                preferred_name = (row.get('name') or '').strip() or None
                match_reason = 'stage_e_moby_exact'
        elif len(exact_moby) > 1:
            # Ambiguous exact titles — attach all for UI, no preferred auto name.
            for hit in exact_moby[:5]:
                candidates.append(
                    _stage_e_candidate_row(hit, match_mode='moby_exact_ambiguous'),
                )
            if match_reason is None:
                match_reason = 'stage_e_moby_ambiguous'

    # --- TheGamesDB (console leaves; platform-filtered exact) ---
    if is_console:
        try:
            from oneirodex.utils.providers.thegamesdb import get_thegamesdb_api_key

            tgdb_key = (get_thegamesdb_api_key() or '').strip()
        except Exception:
            tgdb_key = ''
        if not tgdb_key:
            skipped.append('thegamesdb_key_unset')
        else:
            try:
                tgdb_hits = search_thegamesdb_games(query, api_key=tgdb_key, limit=10)
            except Exception as err:
                print(f'⚠️ [Stage E] TheGamesDB search failed: {err}')
                tgdb_hits = []
            filtered = filter_tgdb_hits_for_platform(tgdb_hits, platform_key)
            exact_tgdb = exact_title_hits(query, filtered)
            if len(exact_tgdb) == 1:
                row = _stage_e_candidate_row(exact_tgdb[0], match_mode='tgdb_exact')
                candidates.append(row)
                preferred_name = (row.get('name') or '').strip() or preferred_name
                match_reason = 'stage_e_tgdb_exact'
            elif len(exact_tgdb) > 1:
                for hit in exact_tgdb[:5]:
                    candidates.append(
                        _stage_e_candidate_row(hit, match_mode='tgdb_exact_ambiguous'),
                    )
                if match_reason is None:
                    match_reason = 'stage_e_tgdb_ambiguous'
    elif is_pc:
        # PC leaves skip TGDB scan cascade (manual Identify chip remains).
        skipped.append('tgdb_pc_skipped')

    if not candidates:
        return {
            **empty,
            'skipped': skipped,
        }

    # Preferred name only when all non-ambiguous exact hits share one title.
    unique_exact_names = {
        _casefold_title(c.get('name'))
        for c in candidates
        if c.get('match_mode') in ('moby_exact', 'tgdb_exact')
        and (c.get('name') or '').strip()
    }
    if len(unique_exact_names) == 1:
        for c in candidates:
            if c.get('match_mode') in ('moby_exact', 'tgdb_exact'):
                preferred_name = (c.get('name') or '').strip() or preferred_name
                break
        if match_reason is None:
            match_reason = 'stage_e_exact'
    else:
        preferred_name = None
        if len(unique_exact_names) > 1:
            match_reason = 'stage_e_multi_source'

    return {
        'candidates': candidates,
        'suggested_candidate_name': preferred_name,
        'match_reason': match_reason,
        'identify_path': 'stage_e' if candidates else None,
        'skipped': skipped,
    }


def enrich_proposal_with_stage_e(
    proposal: dict,
    *,
    cleaned_name: str,
    library_platform: str | None = None,
) -> dict:
    """Attach Stage E propose-only catalog hints onto a match proposal.

    Does not create Games. Safe when API keys are unset (silent skip).
    """
    if not isinstance(proposal, dict):
        proposal = {'proposal': {}}
    body = proposal.setdefault('proposal', {})
    hints = resolve_stage_e_catalog_hints(
        cleaned_name=cleaned_name or body.get('cleaned_name') or '',
        library_platform=library_platform,
    )
    body['stage_e_candidates'] = hints.get('candidates') or []
    body['stage_e'] = {
        'match_reason': hints.get('match_reason'),
        'identify_path': hints.get('identify_path'),
        'skipped': list(hints.get('skipped') or []),
        'propose_only': True,
    }
    if hints.get('match_reason'):
        # Soft hint for UI filters — does not overwrite dupe match_reason codes
        # already on UnmatchedFolder; proposal-only unless caller denormalizes.
        body.setdefault('stage_e_match_reason', hints['match_reason'])
    # Prefer Stage E name when software path left no candidate name.
    stage_name = (hints.get('suggested_candidate_name') or '').strip() or None
    if stage_name:
        soft = body.get('software_candidates') or []
        has_soft_name = False
        if isinstance(soft, list) and soft and isinstance(soft[0], dict):
            has_soft_name = bool((soft[0].get('name') or '').strip())
        if not has_soft_name:
            body['suggested_candidate_name'] = stage_name
        if body.get('identify_path') in (None, 'unmatched', 'igdb'):
            body['identify_path'] = 'stage_e'
    return proposal


def mark_unmatched_as_kind(
    folder: UnmatchedFolder,
    *,
    item_kind: str,
    name: str | None = None,
    steam_app_id: int | None = None,
    summary: str | None = None,
) -> Game:
    """Create a kinded custom Game from an UnmatchedFolder and clear the row."""
    if not folder or not folder.folder_path:
        raise ValueError('Unmatched folder path required')
    if not folder.library_uuid:
        raise ValueError('Unmatched folder has no library_uuid')

    path = folder.folder_path
    parsed = parse_game_label(path)
    soft_search = (getattr(folder, 'search_name', None) or '').strip()
    display = (
        (name or '').strip()
        or soft_search
        or parsed.get('cleaned_name')
        or path.replace('\\', '/').rstrip('/').split('/')[-1]
    )
    kind = normalize_item_kind(item_kind)
    if steam_app_id is None and parsed.get('steam_app_id'):
        steam_app_id = parsed['steam_app_id']

    # Prefer Steam title when software app id known
    if steam_app_id and not name:
        from oneirodex.utils.steam_lookup import fetch_steam_app_details

        details = fetch_steam_app_details(int(steam_app_id))
        if details:
            display = details.get('name') or display
            if not summary:
                summary = details.get('short_description')
            kind = normalize_item_kind(
                suggest_item_kind(display, steam_type=details.get('steam_type'))
                if kind == DEFAULT_ITEM_KIND
                else kind
            )

    game = create_custom_kinded_game(
        name=display,
        full_disk_path=path,
        library_uuid=folder.library_uuid,
        item_kind=kind,
        steam_app_id=int(steam_app_id) if steam_app_id else None,
        summary=summary,
    )
    db.session.delete(folder)
    return game
