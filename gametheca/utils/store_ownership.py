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

import base64
import csv
import hashlib
import io
import json
import os
from datetime import datetime, timezone

from sqlalchemy import func, select

from gametheca import db
from gametheca.models import Game, GameURL, GlobalSettings, StoreAccount, UserOwnedTitle
from gametheca.utils.global_settings import global_settings_row
from gametheca.utils.http_safe import safe_request
from gametheca.utils.security import validate_user_outbound_http_url

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


# GOG Galaxy desktop client's public OAuth pair. The same values are in Heroic,
# Playnite, and lutris. GOG has no documented ownership API; this impersonates
# that client and may break or conflict with GOG's terms. Override with
# GOG_CLIENT_ID / GOG_CLIENT_SECRET. Fail honestly on 401 — do not retry-loop.
_GOG_GALAXY_CLIENT_ID = '46899977096215655'
_GOG_GALAXY_CLIENT_SECRET = '9d85c43b313d4edda054277894adfb55'
_GOG_TOKEN_URL = 'https://auth.gog.com/token'
_GOG_OWNED_URL = 'https://embed.gog.com/user/data/games'
_GOG_PRODUCTS_URL = 'https://api.gog.com/products'

# Epic Games Launcher public client (Legendary / Heroic). Same unofficial
# surface warning as GOG. Override with EPIC_CLIENT_ID / EPIC_CLIENT_SECRET.
_EPIC_LAUNCHER_CLIENT_ID = '34a02cf8f4414e29b15921876da36f9a'
_EPIC_LAUNCHER_CLIENT_SECRET = 'daafbccc737745186e330d496dd2ea9d'
_EPIC_TOKEN_URL = (
    'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'
)
_EPIC_LIBRARY_URL = (
    'https://library-service.live.use1a.on.epicgames.com/library/api/public/items'
)

# Amazon Games entitlements via the unofficial Nile / Heroic launcher surface.
# Same honesty as GOG/Epic: register IDs and names only. Never call download
# endpoints (GetGameDownload / GetPatches).
_AMAZON_TOKEN_URL = 'https://api.amazon.com/auth/token'
_AMAZON_ENTITLEMENTS_URL = 'https://gaming.amazon.com/api/distribution/entitlements'
_AMAZON_ENTITLEMENTS_TARGET = (
    'com.amazon.animusdistributionservice.entitlement.'
    'AnimusEntitlementsService.GetEntitlements'
)
_AMAZON_KEY_ID = 'd5dc8b8b-86c8-4fc4-ae93-18c0def5314d'
_AMAZON_LAUNCHER_UA = 'com.amazon.agslauncher.win/3.0.9202.1'


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


def gog_live_ready() -> bool:
    return bool(get_gog_api_token()) or _any_account_credential('gog')


def epic_live_ready() -> bool:
    return bool(get_epic_api_token()) or _any_account_credential('epic')


def amazon_live_ready() -> bool:
    return bool(get_amazon_api_token()) or _any_account_credential('amazon')


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


def _gog_client_pair() -> tuple[str, str]:
    client_id = (os.getenv('GOG_CLIENT_ID') or '').strip() or _GOG_GALAXY_CLIENT_ID
    client_secret = (
        (os.getenv('GOG_CLIENT_SECRET') or '').strip() or _GOG_GALAXY_CLIENT_SECRET
    )
    return client_id, client_secret


def _epic_client_pair() -> tuple[str, str]:
    client_id = (os.getenv('EPIC_CLIENT_ID') or '').strip() or _EPIC_LAUNCHER_CLIENT_ID
    client_secret = (
        (os.getenv('EPIC_CLIENT_SECRET') or '').strip() or _EPIC_LAUNCHER_CLIENT_SECRET
    )
    return client_id, client_secret


def _gog_tokens_for(account: StoreAccount) -> dict:
    data = _parse_credential_json(account.credential)
    if not data.get('access_token') and not data.get('refresh_token'):
        env_access = (os.getenv('GOG_ACCESS_TOKEN') or '').strip()
        env_refresh = (
            (os.getenv('GOG_REFRESH_TOKEN') or os.getenv('GOG_API_TOKEN') or '')
            .strip()
        )
        if env_access:
            data['access_token'] = env_access
        if env_refresh:
            data['refresh_token'] = env_refresh
        if env_refresh and not env_access and 'token' in data:
            data.pop('token', None)
        elif not data.get('refresh_token') and data.get('token'):
            data['refresh_token'] = data['token']
    elif data.get('token') and not data.get('refresh_token'):
        data['refresh_token'] = data['token']
    return data


def _epic_device_auth_for(account: StoreAccount) -> dict:
    data = _parse_credential_json(account.credential)
    if not (data.get('account_id') and data.get('device_id') and data.get('secret')):
        env_raw = get_epic_api_token()
        if env_raw:
            env_data = _parse_credential_json(env_raw)
            if env_data:
                data = env_data
    return data


def _flatten_amazon_credential(data: dict) -> dict:
    """Accept Nile/Heroic nested user.json or a flat refresh_token blob."""
    flat = dict(data)
    tokens = data.get('tokens')
    if isinstance(tokens, dict):
        bearer = tokens.get('bearer') if isinstance(tokens.get('bearer'), dict) else tokens
        if isinstance(bearer, dict):
            if bearer.get('access_token') and not flat.get('access_token'):
                flat['access_token'] = bearer['access_token']
            if bearer.get('refresh_token') and not flat.get('refresh_token'):
                flat['refresh_token'] = bearer['refresh_token']
    extensions = data.get('extensions') if isinstance(data.get('extensions'), dict) else {}
    device_info = (
        extensions.get('device_info')
        if isinstance(extensions.get('device_info'), dict)
        else {}
    )
    customer = (
        extensions.get('customer_info')
        if isinstance(extensions.get('customer_info'), dict)
        else {}
    )
    serial = (
        flat.get('device_serial')
        or flat.get('device_serial_number')
        or device_info.get('device_serial_number')
        or device_info.get('device_serial')
    )
    if serial:
        flat['device_serial'] = str(serial).strip()
    user_id = flat.get('user_id') or customer.get('user_id')
    if user_id:
        flat['user_id'] = str(user_id).strip()
    if flat.get('token') and not flat.get('refresh_token'):
        flat['refresh_token'] = flat['token']
    return flat


def _amazon_tokens_for(account: StoreAccount) -> dict:
    data = _flatten_amazon_credential(_parse_credential_json(account.credential))
    env_serial = (os.getenv('AMAZON_DEVICE_SERIAL') or '').strip()
    env_access = (os.getenv('AMAZON_ACCESS_TOKEN') or '').strip()
    if not data.get('refresh_token') and not data.get('access_token'):
        env_raw = get_amazon_api_token()
        if env_raw:
            if env_raw.lstrip().startswith('{'):
                data = _flatten_amazon_credential(_parse_credential_json(env_raw))
            else:
                data['refresh_token'] = env_raw
    if env_serial and not data.get('device_serial'):
        data['device_serial'] = env_serial
    if env_access and not data.get('access_token'):
        data['access_token'] = env_access
    return data


def _refresh_gog_access(account: StoreAccount, tokens: dict) -> str:
    access = (tokens.get('access_token') or '').strip()
    refresh = (tokens.get('refresh_token') or '').strip()
    if not refresh and access:
        return access
    if not refresh:
        raise ValueError(
            'GOG live sync needs a refresh token — paste one from Heroic/Galaxy '
            'or set GOG_REFRESH_TOKEN. CSV import still works without it.'
        )
    client_id, client_secret = _gog_client_pair()
    resp = _outbound(
        'POST',
        _GOG_TOKEN_URL,
        data={
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': refresh,
        },
    )
    if resp.status_code == 401:
        raise ValueError(
            'GOG rejected the saved token (unofficial Galaxy client). Paste a '
            'new refresh token; CSV import still works.'
        )
    resp.raise_for_status()
    payload = resp.json() if resp.content else {}
    new_access = (payload.get('access_token') or '').strip()
    new_refresh = (payload.get('refresh_token') or refresh).strip()
    if not new_access:
        raise ValueError('GOG token refresh returned no access token')
    account.credential = json.dumps({
        'refresh_token': new_refresh,
        'access_token': new_access,
    })
    db.session.commit()
    return new_access


def _epic_access_token(account: StoreAccount, device: dict) -> str:
    account_id = (device.get('account_id') or '').strip()
    device_id = (device.get('device_id') or '').strip()
    secret = (device.get('secret') or '').strip()
    if not (account_id and device_id and secret):
        raise ValueError(
            'Epic live sync needs device auth JSON '
            '(account_id, device_id, secret) from Legendary/Heroic, or '
            'EPIC_DEVICE_AUTH. CSV import still works without it.'
        )
    client_id, client_secret = _epic_client_pair()
    basic = base64.b64encode(f'{client_id}:{client_secret}'.encode('ascii')).decode('ascii')
    resp = _outbound(
        'POST',
        _EPIC_TOKEN_URL,
        headers={
            'Authorization': f'Basic {basic}',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        data={
            'grant_type': 'device_auth',
            'account_id': account_id,
            'device_id': device_id,
            'secret': secret,
        },
    )
    if resp.status_code == 401:
        raise ValueError(
            'Epic rejected the saved device auth (unofficial launcher client). '
            'Paste a new device-auth JSON; CSV import still works.'
        )
    resp.raise_for_status()
    payload = resp.json() if resp.content else {}
    access = (payload.get('access_token') or '').strip()
    if not access:
        raise ValueError('Epic device auth returned no access token')
    display = (payload.get('displayName') or payload.get('account_id') or '').strip()
    if display and not account.external_account_id:
        account.external_account_id = display[:64]
        db.session.commit()
    return access


def _gog_product_names(ids: list[str]) -> dict[str, str]:
    names: dict[str, str] = {}
    chunk_size = 50
    for index in range(0, len(ids), chunk_size):
        chunk = ids[index:index + chunk_size]
        try:
            resp = _outbound(
                'GET',
                _GOG_PRODUCTS_URL,
                params={'ids': ','.join(chunk)},
            )
            resp.raise_for_status()
            payload = resp.json() if resp.content else None
        except Exception:
            continue
        rows = payload if isinstance(payload, list) else (
            payload.values() if isinstance(payload, dict) else []
        )
        for row in rows:
            if not isinstance(row, dict):
                continue
            pid = row.get('id') or row.get('product_id')
            title = row.get('title') or row.get('name')
            if pid is not None and title:
                names[str(pid)] = str(title)
    return names


def _epic_library_items(access_token: str) -> list[tuple[str, str | None]]:
    items: list[tuple[str, str | None]] = []
    cursor = None
    for _ in range(20):
        params = {'includeMetadata': 'true'}
        if cursor:
            params['cursor'] = cursor
        resp = _outbound(
            'GET',
            _EPIC_LIBRARY_URL,
            headers={'Authorization': f'bearer {access_token}'},
            params=params,
        )
        if resp.status_code == 401:
            raise ValueError(
                'Epic library request was rejected. Paste a new device-auth JSON.'
            )
        resp.raise_for_status()
        payload = resp.json() if resp.content else {}
        records = (
            payload.get('records')
            or payload.get('elements')
            or payload.get('items')
            or []
        )
        if isinstance(records, dict):
            records = list(records.values())
        for row in records:
            if not isinstance(row, dict):
                continue
            catalog_id = (
                row.get('catalogItemId')
                or row.get('catalogItemID')
                or row.get('id')
                or row.get('appName')
            )
            if not catalog_id:
                continue
            meta = row.get('metadata') if isinstance(row.get('metadata'), dict) else {}
            name = row.get('title') or meta.get('title') or row.get('appName')
            items.append((str(catalog_id), str(name) if name else None))
        meta = payload.get('responseMetadata') or payload.get('paging') or {}
        cursor = meta.get('nextCursor') or meta.get('cursor') or None
        if not cursor:
            break
    return items


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
    refresh_token: str | None = None,
    access_token: str | None = None,
) -> StoreAccount:
    external_id = (gog_user_id or note or '').strip() or None
    payload = {}
    if (refresh_token or '').strip():
        payload['refresh_token'] = refresh_token.strip()
    if (access_token or '').strip():
        payload['access_token'] = access_token.strip()
    credential = json.dumps(payload) if payload else None
    return connect_store_account(user_id, 'gog', external_id, credential=credential)


def disconnect_gog_account(user_id: int) -> None:
    disconnect_store_account(user_id, 'gog')


def connect_epic_account(
    user_id: int,
    epic_account_id: str | None = None,
    note: str | None = None,
    device_auth: str | dict | None = None,
) -> StoreAccount:
    external_id = (epic_account_id or note or '').strip() or None
    credential = None
    if isinstance(device_auth, dict) and device_auth:
        credential = json.dumps(device_auth)
    elif isinstance(device_auth, str) and device_auth.strip():
        raw = device_auth.strip()
        parsed = _parse_credential_json(raw)
        credential = json.dumps(parsed) if parsed else raw
    return connect_store_account(user_id, 'epic', external_id, credential=credential)


def disconnect_epic_account(user_id: int) -> None:
    disconnect_store_account(user_id, 'epic')


def connect_amazon_account(
    user_id: int,
    amazon_user_id: str | None = None,
    note: str | None = None,
    credential: str | dict | None = None,
    refresh_token: str | None = None,
    access_token: str | None = None,
    device_serial: str | None = None,
) -> StoreAccount:
    external_id = (amazon_user_id or note or '').strip() or None
    payload: dict = {}
    if isinstance(credential, dict) and credential:
        payload = _flatten_amazon_credential(credential)
    elif isinstance(credential, str) and credential.strip():
        raw = credential.strip()
        if raw.startswith('{'):
            parsed = _parse_credential_json(raw)
            payload = _flatten_amazon_credential(parsed) if parsed else {'refresh_token': raw}
        else:
            payload = {'refresh_token': raw}
    if (refresh_token or '').strip():
        payload['refresh_token'] = refresh_token.strip()
    if (access_token or '').strip():
        payload['access_token'] = access_token.strip()
    if (device_serial or '').strip():
        payload['device_serial'] = device_serial.strip()
    if payload.get('user_id') and not external_id:
        external_id = str(payload['user_id'])[:64]
    cred_json = json.dumps(payload) if payload else None
    return connect_store_account(user_id, 'amazon', external_id, credential=cred_json)


def disconnect_amazon_account(user_id: int) -> None:
    disconnect_store_account(user_id, 'amazon')


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
    resp = _outbound('GET', url, params=params)
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
    """Fetch owned GOG product IDs via the unofficial Galaxy surface.

    Register-only: records IDs and names; does not download anything.
    """
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')

    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store='gog')
    ).scalars().first()
    if not account:
        raise ValueError('GOG account not connected')

    access = _refresh_gog_access(account, _gog_tokens_for(account))
    resp = _outbound(
        'GET',
        _GOG_OWNED_URL,
        headers={'Authorization': f'Bearer {access}'},
    )
    if resp.status_code == 401:
        raise ValueError(
            'GOG rejected the saved token (unofficial Galaxy client). Paste a '
            'new refresh token; CSV import still works.'
        )
    resp.raise_for_status()
    payload = resp.json() if resp.content else {}
    owned = payload.get('owned') or payload.get('games') or []
    ids: list[str] = []
    for item in owned:
        if isinstance(item, dict):
            pid = item.get('id') or item.get('product_id')
        else:
            pid = item
        if pid is None:
            continue
        ids.append(str(pid))

    names = _gog_product_names(ids) if ids else {}
    matched = 0
    for product_id in ids:
        row = upsert_owned_title(
            user_id, 'gog', product_id, names.get(product_id),
        )
        if row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'synced': len(ids), 'matched': matched, 'store': 'gog'}


def sync_epic_owned_games(user_id: int) -> dict:
    """Fetch owned Epic catalog items via unofficial launcher device auth.

    Register-only: records IDs and names; does not download anything.
    """
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')

    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store='epic')
    ).scalars().first()
    if not account:
        raise ValueError('Epic account not connected')

    access = _epic_access_token(account, _epic_device_auth_for(account))
    items = _epic_library_items(access)
    matched = 0
    for catalog_id, name in items:
        row = upsert_owned_title(user_id, 'epic', catalog_id, name)
        if row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'synced': len(items), 'matched': matched, 'store': 'epic'}


def _refresh_amazon_access(account: StoreAccount, tokens: dict) -> tuple[str, str]:
    """Return (access_token, device_serial). Register-only — never downloads."""
    access = (tokens.get('access_token') or '').strip()
    refresh = (tokens.get('refresh_token') or '').strip()
    serial = (tokens.get('device_serial') or '').strip()
    if not serial:
        raise ValueError(
            'Amazon live sync needs the Nile/Heroic device serial '
            '(extensions.device_info.device_serial_number) with the token. '
            'CSV import still works without it.'
        )
    if not refresh and access:
        return access, serial
    if not refresh:
        raise ValueError(
            'Amazon live sync needs a Nile/Heroic refresh token, or '
            'AMAZON_REFRESH_TOKEN. CSV import still works without it.'
        )
    resp = _outbound(
        'POST',
        _AMAZON_TOKEN_URL,
        json={
            'source_token': refresh,
            'source_token_type': 'refresh_token',
            'requested_token_type': 'access_token',
            'app_name': 'AGSLauncher for Windows',
            'app_version': '1.0.0',
        },
    )
    if resp.status_code == 401:
        raise ValueError(
            'Amazon rejected the saved token (unofficial Nile/Heroic client). '
            'Paste a new token blob; CSV import still works.'
        )
    resp.raise_for_status()
    payload = resp.json() if resp.content else {}
    new_access = (payload.get('access_token') or '').strip()
    if not new_access:
        raise ValueError('Amazon token refresh returned no access token')
    stored = _flatten_amazon_credential(_parse_credential_json(account.credential))
    stored['refresh_token'] = refresh
    stored['access_token'] = new_access
    stored['device_serial'] = serial
    account.credential = json.dumps(stored)
    user_id = (stored.get('user_id') or '').strip()
    if user_id and not account.external_account_id:
        account.external_account_id = user_id[:64]
    db.session.commit()
    return new_access, serial


def _amazon_entitlement_id_name(item) -> tuple[str, str | None] | None:
    if not isinstance(item, dict):
        return None
    product = item.get('product') if isinstance(item.get('product'), dict) else item
    pid = (
        product.get('id')
        or product.get('productId')
        or item.get('productId')
        or item.get('id')
        or item.get('entitlementId')
    )
    if pid is None:
        return None
    name = product.get('title') or product.get('productTitle') or item.get('title')
    return str(pid), (str(name) if name else None)


def _amazon_entitlements(access: str, serial: str) -> list[tuple[str, str | None]]:
    hardware = hashlib.sha256(serial.encode('utf-8')).hexdigest().upper()
    items: list[tuple[str, str | None]] = []
    next_token = None
    while True:
        body = {
            'Operation': 'GetEntitlements',
            'clientId': 'Sonic',
            'syncPoint': None,
            'nextToken': next_token,
            'maxResults': 50,
            'productIdFilter': None,
            'keyId': _AMAZON_KEY_ID,
            'hardwareHash': hardware,
        }
        resp = _outbound(
            'POST',
            _AMAZON_ENTITLEMENTS_URL,
            headers={
                'X-Amz-Target': _AMAZON_ENTITLEMENTS_TARGET,
                'x-amzn-token': access,
                'User-Agent': _AMAZON_LAUNCHER_UA,
                'Content-Type': 'application/json',
                'Content-Encoding': 'amz-1.0',
            },
            json=body,
        )
        if resp.status_code == 401:
            raise ValueError(
                'Amazon rejected the saved token (unofficial Nile/Heroic client). '
                'Paste a new token blob; CSV import still works.'
            )
        resp.raise_for_status()
        payload = resp.json() if resp.content else {}
        for raw in payload.get('entitlements') or []:
            parsed = _amazon_entitlement_id_name(raw)
            if parsed:
                items.append(parsed)
        next_token = payload.get('nextToken')
        if not next_token:
            break
    return items


def sync_amazon_owned_games(user_id: int) -> dict:
    """Fetch owned Amazon Games titles via unofficial Nile/Heroic entitlements.

    Register-only: records IDs and names; does not download anything.
    """
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')

    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store='amazon')
    ).scalars().first()
    if not account:
        raise ValueError('Amazon account not connected')

    access, serial = _refresh_amazon_access(account, _amazon_tokens_for(account))
    items = _amazon_entitlements(access, serial)
    matched = 0
    for product_id, name in items:
        row = upsert_owned_title(user_id, 'amazon', product_id, name)
        if row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'synced': len(items), 'matched': matched, 'store': 'amazon'}


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
            'has_credential': bool(account.credential) if account else False,
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
        'has_amazon_api_key': get_amazon_api_token() is not None,
        'stores': stores,
        'total_owned': total_owned,
        'total_matched': total_matched,
    }
