"""Shared plumbing for the register-only store ownership sync: the store
list and sync modes, credential lookups, the guarded outbound HTTP call,
title matching against the library and the owned-title upsert.

Split out of ``store_ownership`` in the v11 cycle (H-D.4) as a pure move.
NEVER downloads games, DRM payloads or store clients (see ``store_ownership``).
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from sqlalchemy import func, select

from oneirodex import db
from oneirodex.models import Game, GameURL, StoreAccount, UserOwnedTitle
from oneirodex.utils.global_settings import global_settings_row
from oneirodex.utils.http_safe import safe_request
from oneirodex.utils.security import validate_user_outbound_http_url


# meta_quest = register-only ownership (CSV); never downloads DRM titles.
# amazon = live register via unofficial Nile/Heroic (IDs + names); never downloads.
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
    'asin',
    'amazon_id',
    'amzn_id',
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
    'gog': 'live',
    'epic': 'live',
    'amazon': 'live',
    'playnite': 'snapshot',
}


def store_sync_mode(store: str) -> str:
    """Snapshot unless we know otherwise — the safe direction to be wrong in."""
    return STORE_SYNC_MODE.get((store or '').lower(), 'snapshot')


def get_gog_api_token() -> str | None:
    """Household GOG token from env — fallback when a member has no saved credential.

    Live GOG sync uses the unofficial Galaxy client (same public client Heroic
    and Playnite use). Prefer a per-account refresh token on StoreAccount.
    """
    return (
        (os.getenv('GOG_ACCESS_TOKEN') or '').strip()
        or (os.getenv('GOG_REFRESH_TOKEN') or '').strip()
        or (os.getenv('GOG_API_TOKEN') or '').strip()
        or None
    )


def get_epic_api_token() -> str | None:
    """Household Epic device-auth JSON from env — fallback when a member has none."""
    return (
        (os.getenv('EPIC_DEVICE_AUTH') or '').strip()
        or (os.getenv('EPIC_API_TOKEN') or '').strip()
        or None
    )


def get_amazon_api_token() -> str | None:
    """Household Amazon/Nile token from env — fallback when a member has none."""
    return (
        (os.getenv('AMAZON_REFRESH_TOKEN') or '').strip()
        or (os.getenv('AMAZON_NILE_JSON') or '').strip()
        or (os.getenv('AMAZON_API_TOKEN') or '').strip()
        or None
    )


def _outbound(method: str, url: str, **kwargs):
    kwargs.setdefault('timeout', 30)
    return safe_request(
        method,
        url,
        validator=validate_user_outbound_http_url,
        **kwargs,
    )


def _any_account_credential(store: str) -> bool:
    row = db.session.execute(
        select(StoreAccount.id).where(
            StoreAccount.store == store,
            StoreAccount.credential.isnot(None),
            StoreAccount.credential != '',
        ).limit(1)
    ).first()
    return row is not None


def _parse_credential_json(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {'token': raw}
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, str):
        return {'token': parsed}
    return {}


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


def connect_store_account(
    user_id: int,
    store: str,
    external_account_id: str | None = None,
    credential: str | None = None,
) -> StoreAccount:
    """Link a register-only store account (optional external ID / note / secret)."""
    if store not in VALID_STORES:
        raise ValueError(f'Unsupported store: {store}')
    external_account_id = (external_account_id or '').strip() or None
    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store=store)
    ).scalars().first()
    if account:
        account.external_account_id = external_account_id
        if credential:
            account.credential = credential
    else:
        account = StoreAccount(
            user_id=user_id,
            store=store,
            external_account_id=external_account_id,
            credential=credential,
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
