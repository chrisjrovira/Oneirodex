"""Software / experience identify helpers (non-IGDB Main Game path).

When IGDB has no high-confidence game match, enrich Unmatched proposals with
Steam software hits and suggested item_kind. Never invents DRM download queues.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select

from gametheca import db
from gametheca.models import Game, UnmatchedFolder
from gametheca.utils.game_name_parse import parse_game_label
from gametheca.utils.item_kind import (
    DEFAULT_ITEM_KIND,
    ITEM_KINDS,
    is_denied_auto_game_match,
    normalize_item_kind,
    suggest_item_kind,
)
from gametheca.utils.match_scoring import score_candidate
from gametheca.utils.secondary_scrapers import search_steam_games


CUSTOM_IGDB_BASE = 2000000420


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


def create_custom_kinded_game(
    *,
    name: str,
    full_disk_path: str,
    library_uuid: str,
    item_kind: str = DEFAULT_ITEM_KIND,
    steam_app_id: int | None = None,
    summary: str | None = None,
    cover: str | None = None,
    size: int = 0,
) -> Game:
    """
    Create a custom-range Game with item_kind (no real IGDB id).

    Used by Unmatched mark_kind and software identify commit paths.
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
    )
    if steam_app_id:
        game.steam_url = f'https://store.steampowered.com/app/{int(steam_app_id)}/'
    db.session.add(game)
    return game


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
    display = (name or '').strip() or parsed.get('cleaned_name') or path.replace('\\', '/').rstrip('/').split('/')[-1]
    kind = normalize_item_kind(item_kind)
    if steam_app_id is None and parsed.get('steam_app_id'):
        steam_app_id = parsed['steam_app_id']

    # Prefer Steam title when software app id known
    if steam_app_id and not name:
        from gametheca.utils.steam_lookup import fetch_steam_app_details

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
