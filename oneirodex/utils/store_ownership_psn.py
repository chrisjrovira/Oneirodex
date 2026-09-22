"""PlayStation Network ownership register via the unofficial ``psnawp``
client (INSP-42, v11 H4a). **Register-only, opt-in, unofficial.**

A member's own ``npsso`` token (copied from a signed-in browser session, the
way every community tool does it) lets the client list the account's title
history -- ids and names -- which we write to the ownership register so a
card can say *Owned on PlayStation*. Nothing here downloads, installs or
touches a console.

* **Opt-in.** Live sync runs only when ``ENABLE_UNOFFICIAL_STORE_SYNC`` names
  ``psn``; otherwise the store is a CSV snapshot. Default off (gate G5).
* **Optional extra.** ``psnawp`` is imported lazily; missing -> plugin
  *available*, sync says which package to install. CSV needs nothing.
* **The token is the member's.** Stored on their ``StoreAccount``, never
  logged; a rejected token fails closed with one sentence.
"""
from __future__ import annotations

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

STORE = 'psn'
PACKAGE = 'psnawp'
INSTALL_HINT = f'PlayStation live sync needs the optional {PACKAGE} package (pip install {PACKAGE}). CSV import works without it.'


def client_available() -> bool:
    try:
        import psnawp_api  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def get_psn_api_token() -> str | None:
    """Household npsso from env -- fallback when a member saved none."""
    return (os.getenv('PSN_NPSSO') or '').strip() or None


def psn_live_ready() -> bool:
    if STORE not in unofficial_store_opt_in() or not client_available():
        return False
    return bool(get_psn_api_token()) or _any_account_credential(STORE)


def connect_psn_account(
    user_id: int,
    online_id: str | None = None,
    note: str | None = None,
    npsso: str | None = None,
) -> StoreAccount:
    external_id = (online_id or note or '').strip() or None
    payload = {'npsso': npsso.strip()} if (npsso or '').strip() else {}
    cred_json = json.dumps(payload) if payload else None
    return connect_store_account(user_id, STORE, external_id, credential=cred_json)


def disconnect_psn_account(user_id: int) -> None:
    disconnect_store_account(user_id, STORE)


def _npsso_for(account: StoreAccount) -> str:
    data = _parse_credential_json(account.credential)
    token = str(data.get('npsso') or data.get('token') or '').strip()
    return token or (get_psn_api_token() or '')


def _psn_titles(npsso: str) -> tuple[list[tuple[str, str | None]], str | None]:
    """Title ids + names from the account's title stats, via the unofficial
    client; also the online id when the client reports it. Tests patch this."""
    from psnawp_api import PSNAWP

    client = PSNAWP(npsso)
    me = client.me()
    online_id = getattr(me, 'online_id', None)
    rows: list[tuple[str, str | None]] = []
    seen: set[str] = set()
    for stat in me.title_stats(limit=1000):
        tid = str(getattr(stat, 'title_id', '') or '').strip()
        if tid and tid not in seen:
            seen.add(tid)
            rows.append((tid, getattr(stat, 'name', None)))
    return rows, (str(online_id) if online_id else None)


def sync_psn_owned_games(user_id: int) -> dict[str, Any]:
    """Register IDs and names from the PSN title history. Never downloads."""
    if not is_ownership_sync_enabled():
        raise PermissionError('Store ownership sync is disabled by administrator')
    if STORE not in unofficial_store_opt_in():
        raise PermissionError(
            'PlayStation live sync is opt-in: set ENABLE_UNOFFICIAL_STORE_SYNC=psn on the server. CSV import works without it.'
        )
    if not client_available():
        raise ValueError(INSTALL_HINT)
    account = db.session.execute(
        select(StoreAccount).filter_by(user_id=user_id, store=STORE)
    ).scalars().first()
    if not account:
        raise ValueError('PlayStation account not connected')
    npsso = _npsso_for(account)
    if not npsso:
        raise ValueError('PlayStation live sync needs an npsso token. CSV import works without it.')
    try:
        rows, online_id = _psn_titles(npsso)
    except Exception as exc:  # noqa: BLE001
        text = str(exc)
        if '401' in text or 'Unauthorized' in text or 'npsso' in text.lower():
            raise ValueError('PlayStation rejected the saved npsso (unofficial psnawp client). Paste a fresh token; CSV import still works.') from exc
        raise ValueError(f'PlayStation sync failed: {type(exc).__name__}') from exc
    if online_id and not account.external_account_id:
        account.external_account_id = online_id[:64]
    matched = 0
    for title_id, name in rows:
        row = upsert_owned_title(user_id, STORE, title_id, name)
        if row.matched_game_uuid:
            matched += 1
    db.session.commit()
    return {'synced': len(rows), 'matched': matched, 'store': STORE}
