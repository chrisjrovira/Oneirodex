"""Epic Games ownership register via the launcher's public client
(unofficial surface, as Legendary / Heroic use). Register IDs and names
only; never downloads.

Split out of ``store_ownership`` in the v11 cycle (H-D.4) as a pure move.
"""
from __future__ import annotations

import base64
import json
import os

from sqlalchemy import select

from oneirodex import db
from oneirodex.models import StoreAccount
from oneirodex.utils.store_ownership_common import (
    connect_store_account,
    disconnect_store_account,
    get_epic_api_token,
    is_ownership_sync_enabled,
    upsert_owned_title,
    _any_account_credential,
    _outbound,
    _parse_credential_json,
)


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


def epic_live_ready() -> bool:
    return bool(get_epic_api_token()) or _any_account_credential('epic')


def _epic_client_pair() -> tuple[str, str]:
    client_id = (os.getenv('EPIC_CLIENT_ID') or '').strip() or _EPIC_LAUNCHER_CLIENT_ID
    client_secret = (
        (os.getenv('EPIC_CLIENT_SECRET') or '').strip() or _EPIC_LAUNCHER_CLIENT_SECRET
    )
    return client_id, client_secret


def _epic_device_auth_for(account: StoreAccount) -> dict:
    data = _parse_credential_json(account.credential)
    if not (data.get('account_id') and data.get('device_id') and data.get('secret')):
        env_raw = get_epic_api_token()
        if env_raw:
            env_data = _parse_credential_json(env_raw)
            if env_data:
                data = env_data
    return data


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
