"""Background re-sync for linked store accounts (GT-B27).

Why this exists
---------------
`sync_steam_owned_games` has always worked, but nothing ever ran it again.
Linking a Steam account synced once, at the moment you linked it, and the
register was stale from the next purchase onward — which makes a *linked*
account behave no better than the CSV import it was supposed to improve on.

That is the reported gap: "gaming services we link to need to sync to the
service like Steam does, not just an upload that won't stay up to date." Steam
already had the live call; what it did not have was a clock.

Scope
-----
Register-only, exactly as the sync itself is: this records which titles an
account owns. It downloads nothing and changes nothing on disk.

Only stores with a real live API are polled. GOG, Epic, and Amazon use unofficial
launcher surfaces (operator-supplied tokens); CSV still works for all of them.
"""

from __future__ import annotations

import threading
import time

_scheduler_started = False

#: Stores that can actually be re-synced live today. Derived from the handler
#: registry below — see _live_sync_handlers for why this must not be edited
#: on its own.
LIVE_SYNC_STORES = ('steam', 'gog', 'epic', 'amazon')


def _live_sync_handlers() -> dict:
    """store id -> how to check its credential and how to sync it.

    Enrolling a store means adding an entry *here*, not appending to
    LIVE_SYNC_STORES. The loop used to select accounts by that tuple and then
    call ``sync_steam_owned_games`` for every row regardless of
    ``account.store``, so adding 'gog' to the tuple — the one apparent switch,
    and what this module's own docstring invited — would have run the Steam
    sync against GOG accounts.

    Imported inside the function and looked up through the module rather than
    bound at import: the names have to resolve at call time, both to avoid a
    circular import and so tests can monkeypatch them.
    """
    from gametheca.utils import store_ownership

    handlers = {
        'steam': {
            'credential': store_ownership.get_steam_web_api_key,
            'sync': store_ownership.sync_steam_owned_games,
            'missing': 'no Steam Web API key configured',
        },
        'gog': {
            'credential': store_ownership.gog_live_ready,
            'sync': store_ownership.sync_gog_owned_games,
            'missing': 'no GOG refresh token configured',
        },
        'epic': {
            'credential': store_ownership.epic_live_ready,
            'sync': store_ownership.sync_epic_owned_games,
            'missing': 'no Epic device auth configured',
        },
        'amazon': {
            'credential': store_ownership.amazon_live_ready,
            'sync': store_ownership.sync_amazon_owned_games,
            'missing': 'no Amazon Nile/Heroic token configured',
        },
    }

    # LIVE_SYNC_STORES is now read only by callers and tests, so nothing would
    # catch it drifting from the registry that actually runs. A tuple claiming a
    # store the registry cannot sync is the same false advertisement that made
    # the old fallthrough possible, so fail loudly rather than quietly polling
    # nothing.
    if set(handlers) != set(LIVE_SYNC_STORES):
        raise RuntimeError(
            'LIVE_SYNC_STORES {} does not match the sync registry {} — '
            'enrol a store by adding a handler, not by editing the tuple.'
            .format(sorted(LIVE_SYNC_STORES), sorted(handlers))
        )

    # And the *product* must not claim more than the poller can do. STORE_SYNC_MODE
    # is what the ownership UI reads to decide whether to present a register as
    # current or as a dated snapshot; a store marked 'live' there without a
    # handler here would go back to showing a stale list as though it were fresh,
    # which is the exact dishonesty this pairing exists to prevent.
    claimed_live = {
        store for store in store_ownership.STORE_SYNC_MODE
        if store_ownership.store_sync_mode(store) == 'live'
    }
    if claimed_live != set(handlers):
        raise RuntimeError(
            'STORE_SYNC_MODE advertises {} as live but the sync registry has {} — '
            'a store is only live once it has a handler.'
            .format(sorted(claimed_live), sorted(handlers))
        )

    return handlers


def _is_enabled(app) -> bool:
    return bool(app.config.get('ENABLE_OWNERSHIP_POLL', True))


def _poll_seconds(app) -> int:
    """Refresh interval, clamped.

    Ownership changes when someone buys something — hourly is already generous
    and the floor exists so a misconfiguration cannot hammer a third-party API
    on our users' keys.
    """
    try:
        hours = float(app.config.get('OWNERSHIP_POLL_HOURS') or 12)
    except (TypeError, ValueError):
        hours = 12.0
    hours = max(1.0, min(hours, 168.0))
    return int(hours * 3600)


def sync_all_linked_accounts() -> dict:
    """Re-sync every linked account that supports a live API.

    Failures are per-account: one member's revoked token or private profile
    must not stop everyone else's refresh, which is the usual way a batch job
    like this quietly stops working for the whole install.
    """
    from sqlalchemy import select

    from gametheca import db
    from gametheca.models import StoreAccount
    from gametheca.utils import store_ownership

    if not store_ownership.is_ownership_sync_enabled():
        return {'skipped': 'ownership sync disabled by administrator'}

    handlers = _live_sync_handlers()

    # A store with no credential configured would fail identically on every
    # account; drop it once here rather than logging one failure per member.
    usable = {
        store: handler
        for store, handler in handlers.items()
        if handler['credential']()
    }
    if not usable:
        return {'skipped': '; '.join(h['missing'] for h in handlers.values())}

    accounts = db.session.execute(
        select(StoreAccount).filter(StoreAccount.store.in_(tuple(usable)))
    ).scalars().all()

    synced = 0
    failed = 0
    for account in accounts:
        store = (account.store or '').lower()
        handler = usable.get(store)
        if handler is None:
            # Unreachable given the filter, and deliberately not a fallthrough:
            # syncing an unknown store with whichever function happened to be in
            # scope is exactly the bug this registry replaced.
            continue
        if store == 'steam' and not account.external_account_id:
            continue
        if store == 'gog' and not (
            getattr(account, 'credential', None) or store_ownership.get_gog_api_token()
        ):
            continue
        if store == 'epic' and not (
            getattr(account, 'credential', None) or store_ownership.get_epic_api_token()
        ):
            continue
        if store == 'amazon' and not (
            getattr(account, 'credential', None) or store_ownership.get_amazon_api_token()
        ):
            continue
        try:
            handler['sync'](account.user_id)
            synced += 1
        except Exception as exc:
            failed += 1
            print(f'[OWNERSHIP] sync failed for user {account.user_id}: {exc}')

    return {'accounts': len(accounts), 'synced': synced, 'failed': failed}


def start_ownership_scheduler(app):
    """Start the daemon that keeps linked accounts current (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return
    if not _is_enabled(app):
        print('[OWNERSHIP] Disabled (ENABLE_OWNERSHIP_POLL=false)')
        return

    # Validate the registry *here*, at start, not on the first poll.
    #
    # The consistency checks in _live_sync_handlers() only ran inside
    # sync_all_linked_accounts(), which the loop wraps in a try/except that
    # prints and carries on. A mismatch therefore booted cleanly and then failed
    # silently every twelve hours — the exact shape of quiet breakage this
    # registry exists to prevent.
    #
    # Scoped to the poller rather than raising into app start: a mismatch is a
    # developer error, and taking a household's whole install down for it after
    # an upgrade would be a worse outcome than not polling.
    with app.app_context():
        try:
            _live_sync_handlers()
        except RuntimeError as exc:
            print(f'[OWNERSHIP] NOT started — sync registry is inconsistent: {exc}')
            return

    _scheduler_started = True
    interval = _poll_seconds(app)

    def _loop():
        # Let boot finish before making outbound calls, same as the other pollers.
        time.sleep(30)
        while True:
            try:
                with app.app_context():
                    stats = sync_all_linked_accounts()
                    if 'skipped' in stats:
                        print(f"[OWNERSHIP] Skipped: {stats['skipped']}")
                    else:
                        print(
                            f"[OWNERSHIP] Re-synced {stats['synced']}/{stats['accounts']}"
                            f" linked accounts ({stats['failed']} failed)"
                        )
            except Exception as exc:
                # A poller that dies takes ownership freshness with it silently.
                print(f'[OWNERSHIP] Poll error: {exc}')
            time.sleep(interval)

    threading.Thread(target=_loop, name='gt-ownership-poll', daemon=True).start()
    print(f'[OWNERSHIP] Started (re-sync every {interval // 3600}h)')
