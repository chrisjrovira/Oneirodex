"""
Register-only store ownership sync.

Records which titles a user owns according to external store APIs or CSV import.
NEVER downloads games, DRM payloads, or store clients — ownership data is used
solely to annotate library browse/discover cards (owned / store_owned badges).

GOG/Epic matching: Game has no dedicated gog_id/epic_id columns today. When a
CSV row includes a title name, we match on normalized name (casefold + strip)
only when exactly one library game matches; ambiguous or nameless rows stay
unmatched until an admin links them manually.
"""

from __future__ import annotations

import csv
import io
import os
from datetime import datetime, timezone

import requests
from sqlalchemy import func, select

from gametheca import db
from gametheca.models import Game, GameURL, GlobalSettings, StoreAccount, UserOwnedTitle
from gametheca.utils.global_settings import global_settings_row

# meta_quest = register-only ownership (CSV); never downloads DRM titles.
VALID_STORES = frozenset({'steam', 'gog', 'epic', 'amazon', 'meta_quest'})

_CSV_ID_HEADERS = frozenset({
    'appid',
    'app_id',
    'id',
    'steam_app_id',
    'product_id',
    'gog_id',
    'epic_id',
    'catalog_item_id',
    'meta_id',
    'quest_id',
    'name',
})

_NAME_MATCH_STORES = frozenset({'gog', 'epic', 'amazon', 'meta_quest'})


def is_ownership_sync_enabled() -> bool:
    settings = global_settings_row()
    if settings is not None and settings.enable_store_ownership_sync is False:
        return False
    return True


def get_steam_web_api_key() -> str | None:
    """Server-level Steam Web API key from env or global settings."""
    key = (os.getenv('STEAM_WEB_API_KEY') or '').strip()
    if key:
        return key
    settings = global_settings_row()
    if settings and settings.steam_web_api_key:
        return settings.steam_web_api_key.strip()
    return None


#: How each store's register can be kept current.
#:
#: 'live'     — we can re-read ownership from the store on a schedule.
#: 'snapshot' — the register only changes when someone imports a file. What was
#:              imported is correct as of that import and drifts from then on.
#:
#: Stated here because the product was quietly implying otherwise: linking a GOG
#: or Epic account looked identical to linking Steam, produced a one-time list,
#: and then never refreshed — with nothing anywhere saying so. A register that
#: silently goes stale is worse than one you know is a snapshot, because you
#: trust it.
#:
#: Moving a store to 'live' means implementing its sync *and* enrolling it in
#: ownership_poller._live_sync_handlers(); this map is what the UI reads, so a
#: store promoted here without a working sync would start lying again.
STORE_SYNC_MODE: dict[str, str] = {
    'steam': 'live',
    'gog': 'snapshot',
    'epic': 'snapshot',
    'amazon': 'snapshot',
    'playnite': 'snapshot',
}


def store_sync_mode(store: str) -> str:
    """Snapshot unless we know otherwise — the safe direction to be wrong in."""
    return STORE_SYNC_MODE.get((store or '').lower(), 'snapshot')


def get_gog_api_token() -> str | None:
    """Optional GOG API token — live sync not implemented in this slice.

    Reading the token is not the missing piece. GOG has no documented ownership
    API; the community route is a session token lifted from a browser login,
    which is undocumented, breaks without warning and is a poor thing to ask a
    household to maintain. Epic is worse — ownership is only reachable through
    the launcher's auth flow. Both need a decision about whether to depend on
    an unofficial surface before either is worth building, so the register stays
    honest about being a snapshot rather than guessing.
    """
    return (os.getenv('GOG_API_TOKEN') or '').strip() or None


def get_epic_api_token() -> str | None:
    """Optional Epic API token — live sync not implemented in this slice."""
    return (os.getenv('EPIC_API_TOKEN') or '').strip() or None


def _normalize_title_name(name: str | None) -> str | None:
    if not name:
        return None
    normalized = name.casefold().strip()
    return normalized or None


def _match_by_unique_normalized_name(name: str | None) -> str | None:
    """
    Best-effort match when no store-specific Game ID column exists.
    Returns a UUID only when exactly one library game shares the normalized name.
    """
    normalized = _normalize_title_name(name)
    if not normalized:
        return None
    # lower(trim()) approximates casefold for typical ASCII game titles on SQLite.
    matches = db.session.execute(
        select(Game.uuid).where(func.lower(func.trim(Game.name)) == normalized)
    ).scalars().all()
    if len(matches) == 1:
        return matches[0]
    return None


def _match_meta_quest_by_url(external_app_id: str) -> str | None:
    """Exact match on GameURL(url_type='meta_quest') when a single game links the id."""
    external_id = (external_app_id or '').strip()
    if not external_id:
        return None
    matches = db.session.execute(
        select(GameURL.game_uuid).where(
            GameURL.url_type == 'meta_quest',
            GameURL.url == external_id,
        )
    ).scalars().all()
    if len(matches) == 1:
        return matches[0]
    return None


def match_title_to_library_game(
    store: str,
    external_app_id: str,
    name: str | None = None,
) -> str | None:
    """
    Match an owned store title to a library Game UUID.
    Steam: exact match on Game.steam_app_id when present.
    Meta Quest: GameURL url_type=meta_quest exact id, else unique normalized name.
    GOG/Epic/Amazon: unique normalized name when name is provided; never multi-match.
    """
    if store == 'steam':
        try:
            app_id = int(external_app_id)
        except (TypeError, ValueError):
            return None
        return db.session.execute(
            select(Game.uuid).filter(Game.steam_app_id == app_id)
        ).scalars().first()
    if store == 'meta_quest':
        by_url = _match_meta_quest_by_url(external_app_id)
        if by_url:
            return by_url
        return _match_by_unique_normalized_name(name)
    if store in _NAME_MATCH_STORES:
        return _match_by_unique_normalized_name(name)
    return None


def upsert_owned_title(
    user_id: int,
    store: str,
    external_app_id: str,
    name: str | None = None,
) -> UserOwnedTitle:
    """Insert or update a UserOwnedTitle row and attempt library matching."""
    now = datetime.now(timezone.utc)
    matched_uuid = match_title_to_library_game(store, external_app_id, name)
    existing = db.session.execute(
        select(UserOwnedTitle).filter_by(
            user_id=user_id,
            store=store,
            external_app_id=str(external_app_id),
        )
    ).scalars().first()
    if existing:
        if name:
            existing.name = name
        existing.matched_game_uuid = matched_uuid
        existing.last_synced_at = now
        return existing
    row = UserOwnedTitle(
        user_id=user_id,
        store=store,
        external_app_id=str(external_app_id),
        name=name,
        matched_game_uuid=matched_uuid,
        last_synced_at=now,
    )
    db.session.add(row)
    return row


def get_matched_owned_game_uuids(user_id: int) -> set[str]:
    rows = db.session.execute(
        select(UserOwnedTitle.matched_game_uuid).where(
            UserOwnedTitle.user_id == user_id,
            UserOwnedTitle.matched_game_uuid.isnot(None),
        )
    ).all()
    return {row[0] for row in rows}


def ownership_flags(game_uuid: str, owned_uuids: set[str]) -> dict:
    owned = game_uuid in owned_uuids
    return {
        'owned': owned,
        'store_owned': owned,
    }


def connect_store_account(
    user_id: int,
    store: str,
    external_account_id: str | None = None,
) -> StoreAccount:
    """Link a register-only store account (optional external ID / note)."""
    if store not in VALID_STORES:
        raise ValueError(f'Unsupported store: {store}')
    external_account_id = (external_account_id or '').strip() or None
    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store=store)
    ).scalars().first()
    if account:
        account.external_account_id = external_account_id
    else:
        account = StoreAccount(
            user_id=user_id,
            store=store,
            external_account_id=external_account_id,
        )
        db.session.add(account)
    db.session.commit()
    return account


def disconnect_store_account(user_id: int, store: str) -> None:
    """Remove store link and clear synced titles for that store."""
    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store=store)
    ).scalars().first()
    if account:
        db.session.delete(account)
    for row in db.session.execute(
        select(UserOwnedTitle).filter_by(user_id=user_id, store=store)
    ).scalars().all():
        db.session.delete(row)
    db.session.commit()


def connect_steam_account(user_id: int, steam_id: str) -> StoreAccount:
    steam_id = steam_id.strip()
    if not steam_id.isdigit():
        raise ValueError('Steam ID must be numeric')
    return connect_store_account(user_id, 'steam', steam_id)


def disconnect_steam_account(user_id: int) -> None:
    disconnect_store_account(user_id, 'steam')


def connect_gog_account(
    user_id: int,
    gog_user_id: str | None = None,
    note: str | None = None,
) -> StoreAccount:
    external_id = (gog_user_id or note or '').strip() or None
    return connect_store_account(user_id, 'gog', external_id)


def disconnect_gog_account(user_id: int) -> None:
    disconnect_store_account(user_id, 'gog')


def connect_epic_account(
    user_id: int,
    epic_account_id: str | None = None,
    note: str | None = None,
) -> StoreAccount:
    external_id = (epic_account_id or note or '').strip() or None
    return connect_store_account(user_id, 'epic', external_id)


def disconnect_epic_account(user_id: int) -> None:
    disconnect_store_account(user_id, 'epic')


def sync_steam_owned_games(user_id: int) -> dict:
    """
    Fetch owned games via Steam Web API GetOwnedGames and upsert UserOwnedTitle rows.
    Register-only: records app IDs and names; does not download anything.
    """
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')

    api_key = get_steam_web_api_key()
    if not api_key:
        raise ValueError(
            'Steam Web API key not configured (set STEAM_WEB_API_KEY env or admin setting)'
        )

    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store='steam')
    ).scalars().first()
    if not account or not account.external_account_id:
        raise ValueError('Steam account not connected')

    url = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/'
    params = {
        'key': api_key,
        'steamid': account.external_account_id,
        'include_appinfo': 1,
        'include_played_free_games': 1,
        'format': 'json',
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    games = (data.get('response') or {}).get('games') or []

    matched = 0
    for game in games:
        app_id = game.get('appid')
        if app_id is None:
            continue
        row = upsert_owned_title(user_id, 'steam', str(app_id), game.get('name'))
        if row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'synced': len(games), 'matched': matched, 'store': 'steam'}


def sync_gog_owned_games(user_id: int) -> dict:
    """Live GOG sync stub — register-only CSV import is supported instead."""
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')
    if not get_gog_api_token():
        raise ValueError(
            'GOG library sync is not configured (use CSV import for register-only ownership)'
        )
    raise ValueError(
        'GOG live library sync is not implemented; use CSV import for register-only ownership'
    )


def sync_epic_owned_games(user_id: int) -> dict:
    """Live Epic sync stub — register-only CSV import is supported instead."""
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')
    if not get_epic_api_token():
        raise ValueError(
            'Epic library sync is not configured (use CSV import for register-only ownership)'
        )
    raise ValueError(
        'Epic live library sync is not implemented; use CSV import for register-only ownership'
    )


def _parse_store_csv_row(row: list[str], store: str) -> tuple[str, str | None] | None:
    if not row:
        return None
    external_id = row[0].strip()
    if not external_id or external_id.lower() in _CSV_ID_HEADERS:
        return None
    if store == 'steam' and not external_id.isdigit():
        return None
    name = None
    if len(row) > 1:
        name_cell = row[1].strip()
        if name_cell and name_cell.lower() != 'name':
            name = name_cell
    return external_id, name


def import_store_csv(user_id: int, store: str, csv_text: str) -> dict:
    """
    Import owned titles from CSV (register-only manual sync).
    Accepts product IDs in the first column, optional name in the second.
    """
    if store not in VALID_STORES:
        raise ValueError(f'Unsupported store: {store}')
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')

    reader = csv.reader(io.StringIO(csv_text))
    count = 0
    matched = 0
    for row in reader:
        parsed = _parse_store_csv_row(row, store)
        if not parsed:
            continue
        external_id, name = parsed
        title_row = upsert_owned_title(user_id, store, external_id, name)
        count += 1
        if title_row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'imported': count, 'matched': matched, 'store': store}


def import_steam_csv(user_id: int, csv_text: str) -> dict:
    return import_store_csv(user_id, 'steam', csv_text)


def import_gog_csv(user_id: int, csv_text: str) -> dict:
    return import_store_csv(user_id, 'gog', csv_text)


def import_epic_csv(user_id: int, csv_text: str) -> dict:
    return import_store_csv(user_id, 'epic', csv_text)


def import_amazon_csv(user_id: int, csv_text: str) -> dict:
    return import_store_csv(user_id, 'amazon', csv_text)


def import_meta_quest_csv(user_id: int, csv_text: str) -> dict:
    """Register-only Meta/Quest ownership import (never downloads DRM titles)."""
    return import_store_csv(user_id, 'meta_quest', csv_text)


def get_ownership_summary(user_id: int) -> dict:
    accounts = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id)
    ).scalars().all()
    account_by_store = {account.store: account for account in accounts}

    total_owned = db.session.execute(
        select(func.count(UserOwnedTitle.id)).filter_by(user_id=user_id)
    ).scalar() or 0
    total_matched = db.session.execute(
        select(func.count(UserOwnedTitle.id)).where(
            UserOwnedTitle.user_id == user_id,
            UserOwnedTitle.matched_game_uuid.isnot(None),
        )
    ).scalar() or 0

    stores = {}
    for store in sorted(VALID_STORES):
        owned_count = db.session.execute(
            select(func.count(UserOwnedTitle.id)).filter_by(user_id=user_id, store=store)
        ).scalar() or 0
        matched_count = db.session.execute(
            select(func.count(UserOwnedTitle.id)).where(
                UserOwnedTitle.user_id == user_id,
                UserOwnedTitle.store == store,
                UserOwnedTitle.matched_game_uuid.isnot(None),
            )
        ).scalar() or 0
        account = account_by_store.get(store)
        # Newest row wins: a register is only as current as its most recent
        # entry, and that is what someone means by "when did this last update".
        last_seen = db.session.execute(
            select(func.max(UserOwnedTitle.last_synced_at)).filter_by(
                user_id=user_id, store=store,
            )
        ).scalar()

        mode = store_sync_mode(store)
        stores[store] = {
            'connected': account is not None,
            'external_account_id': account.external_account_id if account else None,
            'owned_count': owned_count,
            'matched_count': matched_count,
            # The UI needs to be able to say "snapshot from 3 weeks ago" rather
            # than presenting a stale list as though it were current.
            'sync_mode': mode,
            'live_sync': mode == 'live',
            'last_synced_at': last_seen.isoformat() if last_seen else None,
        }

    return {
        'enabled': is_ownership_sync_enabled(),
        'has_steam_api_key': get_steam_web_api_key() is not None,
        'has_gog_api_key': get_gog_api_token() is not None,
        'has_epic_api_key': get_epic_api_token() is not None,
        'stores': stores,
        'total_owned': total_owned,
        'total_matched': total_matched,
    }
