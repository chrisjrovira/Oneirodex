"""Xbox ownership register via the unofficial ``xbox-webapi`` client
(INSP-42, v11 H4a). **Register-only, opt-in, unofficial.**

Same precedent as Epic and Amazon: a household places its own token file,
we read *title ids and names* from the title history and write them to the
ownership register so cards can say *Owned on Xbox*. Nothing here downloads,
installs or touches DRM.

* **Opt-in.** Live sync runs only when ``ENABLE_UNOFFICIAL_STORE_SYNC`` names
  ``xbox``; otherwise the store is a CSV snapshot like Nintendo. The default
  is off (decision gate G5).
* **Optional extra.** ``xbox-webapi`` is imported lazily; when it is missing
  the plugin reads *available* and sync says which package to install. CSV
  import never needs it.
* **Tokens are the operator's.** The credential is the JSON the client's own
  ``xbox-authenticate`` wrote; it is stored on the member's ``StoreAccount``
  and refreshed there. Nothing is logged, and a 401 fails closed with a
  sentence, not a stack trace.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from sqlalchemy import select

from oneirodex import db
from oneirodex.models import StoreAccount
from oneirodex.utils.store_ownership_common import (
    _any_account_credential,
    _parse_credential_json,
    connect_store_account,
    disconnect_store_account,
    is_ownership_sync_enabled,
    unofficial_store_opt_in,
    upsert_owned_title,
)

STORE = 'xbox'
PACKAGE = 'xbox-webapi'
INSTALL_HINT = f'Xbox live sync needs the optional {PACKAGE} package (pip install {PACKAGE}). CSV import works without it.'


def client_available() -> bool:
    try:
        import xbox.webapi  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def get_xbox_api_token() -> str | None:
    """Household token JSON from env -- fallback when a member saved none."""
    return (os.getenv('XBOX_TOKENS_JSON') or '').strip() or None


def xbox_live_ready() -> bool:
    """Only when opted in, the client is installed, and some credential exists."""
    if STORE not in unofficial_store_opt_in() or not client_available():
        return False
    return bool(get_xbox_api_token()) or _any_account_credential(STORE)


def connect_xbox_account(
    user_id: int,
    xuid: str | None = None,
    note: str | None = None,
    credential: str | dict | None = None,
) -> StoreAccount:
    external_id = (xuid or note or '').strip() or None
    payload: dict = {}
    if isinstance(credential, dict) and credential:
        payload = dict(credential)
    elif isinstance(credential, str) and credential.strip():
        raw = credential.strip()
        payload = _parse_credential_json(raw) if raw.startswith('{') else {'token': raw}
    xuid_in = str(payload.get('xuid') or (payload.get('xsts') or {}).get('xuid') or '').strip() if payload else ''
    if xuid_in and not external_id:
        external_id = xuid_in[:64]
    cred_json = json.dumps(payload) if payload else None
    return connect_store_account(user_id, STORE, external_id, credential=cred_json)


def disconnect_xbox_account(user_id: int) -> None:
    disconnect_store_account(user_id, STORE)


def _tokens_for(account: StoreAccount) -> dict:
    data = _parse_credential_json(account.credential)
    if not data:
        env_raw = get_xbox_api_token()
        if env_raw:
            data = _parse_credential_json(env_raw)
    return data


async def _title_history_async(tokens: dict) -> tuple[list[tuple[str, str | None]], dict]:
    """Title ids + names from the title hub, via the unofficial client.

    Returns the rows and the (possibly refreshed) token dict to store back.
    Register-only: the title hub endpoint lists what the account has played or
    owns; no content endpoint is ever called.
    """
    from httpx import AsyncClient  # xbox-webapi's transport
    from xbox.webapi.api.client import XboxLiveClient
    from xbox.webapi.authentication.manager import AuthenticationManager
    from xbox.webapi.authentication.models import OAuth2TokenResponse

    client_id = (os.getenv('XBOX_CLIENT_ID') or tokens.get('client_id') or '').strip()
    client_secret = (os.getenv('XBOX_CLIENT_SECRET') or tokens.get('client_secret') or '').strip()
    oauth = tokens.get('oauth') if isinstance(tokens.get('oauth'), dict) else tokens
    async with AsyncClient() as session:
        auth = AuthenticationManager(session, client_id, client_secret, '')
        auth.oauth = OAuth2TokenResponse.model_validate(oauth) if hasattr(OAuth2TokenResponse, 'model_validate') else OAuth2TokenResponse.parse_obj(oauth)
        await auth.refresh_tokens()
        xbl = XboxLiveClient(auth)
        xuid = auth.xsts_token.xuid
        history = await xbl.titlehub.get_title_history(xuid, max_items=1000)
        rows: list[tuple[str, str | None]] = []
        for title in getattr(history, 'titles', []) or []:
            tid = str(getattr(title, 'title_id', '') or '').strip()
            if tid:
                rows.append((tid, getattr(title, 'name', None)))
        refreshed = {
            'oauth': json.loads(auth.oauth.model_dump_json() if hasattr(auth.oauth, 'model_dump_json') else auth.oauth.json()),
            'xuid': xuid,
        }
        if client_id:
            refreshed['client_id'] = client_id
        if client_secret:
            refreshed['client_secret'] = client_secret
        return rows, refreshed


def _xbox_title_history(tokens: dict) -> tuple[list[tuple[str, str | None]], dict]:
    """Sync wrapper; tests patch this."""
    return asyncio.run(_title_history_async(tokens))


def sync_xbox_owned_games(user_id: int) -> dict[str, Any]:
    """Register IDs and names from the Xbox title history. Never downloads."""
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')
    if STORE not in unofficial_store_opt_in():
        raise PermissionError(
            'Xbox live sync is opt-in: set ENABLE_UNOFFICIAL_STORE_SYNC=xbox on the server. CSV import works without it.'
        )
    if not client_available():
        raise ValueError(INSTALL_HINT)
    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store=STORE)
    ).scalars().first()
    if not account:
        raise ValueError('Xbox account not connected')
    tokens = _tokens_for(account)
    if not tokens:
        raise ValueError('Xbox live sync needs the xbox-webapi token JSON (from xbox-authenticate). CSV import works without it.')
    try:
        rows, refreshed = _xbox_title_history(tokens)
    except Exception as exc:  # noqa: BLE001 -- fail closed with a sentence
        text = str(exc)
        if '401' in text or 'Unauthorized' in text or 'invalid_grant' in text:
            raise ValueError('Xbox rejected the saved token (unofficial xbox-webapi client). Paste a fresh token JSON; CSV import still works.') from exc
        raise ValueError(f'Xbox sync failed: {type(exc).__name__}') from exc
    if refreshed:
        account.credential = json.dumps(refreshed)
        xuid = str(refreshed.get('xuid') or '').strip()
        if xuid and not account.external_account_id:
            account.external_account_id = xuid[:64]
    matched = 0
    for title_id, name in rows:
        row = upsert_owned_title(user_id, STORE, title_id, name)
        if row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'synced': len(rows), 'matched': matched, 'store': STORE}
