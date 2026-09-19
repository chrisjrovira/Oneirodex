"""Amazon Games entitlements via the unofficial Nile / Heroic launcher
surface. Register IDs and names only; never calls download endpoints.

Split out of ``store_ownership`` in the v11 cycle (H-D.4) as a pure move.
"""
from __future__ import annotations

import hashlib
import json
import os

from sqlalchemy import select

from oneirodex import db
from oneirodex.models import StoreAccount
from oneirodex.utils.store_ownership_common import (
    connect_store_account,
    disconnect_store_account,
    get_amazon_api_token,
    is_ownership_sync_enabled,
    upsert_owned_title,
    _any_account_credential,
    _outbound,
    _parse_credential_json,
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


def amazon_live_ready() -> bool:
    return bool(get_amazon_api_token()) or _any_account_credential('amazon')


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
