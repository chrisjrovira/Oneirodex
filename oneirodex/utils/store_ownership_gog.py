"""GOG ownership register via the Galaxy client's public OAuth pair
(unofficial surface -- see the constants' comment). Register IDs and names
only; never downloads.

Split out of ``store_ownership`` in the v11 cycle (H-D.4) as a pure move.
"""
from __future__ import annotations

import json
import os

from sqlalchemy import select

from oneirodex import db
from oneirodex.models import StoreAccount
from oneirodex.utils.store_ownership_common import (
    connect_store_account,
    disconnect_store_account,
    get_gog_api_token,
    is_ownership_sync_enabled,
    upsert_owned_title,
    _any_account_credential,
    _outbound,
    _parse_credential_json,
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


def gog_live_ready() -> bool:
    return bool(get_gog_api_token()) or _any_account_credential('gog')


def _gog_client_pair() -> tuple[str, str]:
    client_id = (os.getenv('GOG_CLIENT_ID') or '').strip() or _GOG_GALAXY_CLIENT_ID
    client_secret = (
        (os.getenv('GOG_CLIENT_SECRET') or '').strip() or _GOG_GALAXY_CLIENT_SECRET
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
