"""Admin Integrations hub inventory — all configured APIs / providers.

Used by ``GET /api/admin/integrations/inventory`` so the admin UI can list
every integration with status + deep links (not IGDB-only).
"""

from __future__ import annotations

import os
from typing import Any

from sqlalchemy import select


def _settings_row():
    from oneirodex import db
    from oneirodex.models import GlobalSettings

    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1)
    ).scalars().first()


def _status(*, configured: bool, enabled: bool | None = None) -> str:
    if enabled is False:
        return 'disabled'
    if configured:
        return 'configured'
    return 'available'


def build_integrations_inventory() -> list[dict[str, Any]]:
    """Return inventory rows for Admin Integrations honesty."""
    settings = _settings_row()
    rows: list[dict[str, Any]] = []

    def add(
        *,
        id: str,
        name: str,
        category: str,
        admin_href: str,
        configured: bool,
        enabled: bool | None = None,
        notes: str = '',
        settings_href: str | None = None,
    ) -> None:
        rows.append({
            'id': id,
            'name': name,
            'category': category,
            'status': _status(configured=configured, enabled=enabled),
            'configured': bool(configured),
            'enabled': enabled,
            'admin_href': admin_href,
            'settings_href': settings_href or admin_href,
            'notes': notes,
        })

    # --- Metadata / artwork ---
    igdb_ok = bool(
        settings
        and getattr(settings, 'igdb_client_id', None)
        and getattr(settings, 'igdb_client_secret', None)
    )
    add(
        id='igdb',
        name='IGDB',
        category='metadata',
        admin_href='/admin/integrations#igdb',
        settings_href='/admin/igdb_settings',
        configured=igdb_ok,
        notes='Primary game metadata',
    )

    # --- Cascade sources (GT-B26) ---
    #
    # metadata_cascade already walks eight sources — Steam, GOG, Epic, itch.io,
    # Giant Bomb, MobyGames, RAWG and TheGamesDB — but only four of them were
    # listed here. So the Integrations page said Oneirodex scraped IGDB and
    # three databases while it was in fact querying five more, and an operator
    # had no way to see or reason about them.
    #
    # These are keyless public endpoints: there is no credential to configure,
    # so `configured=True` states "usable right now", not "you set this up".
    # Reporting them as unconfigured would read as broken.
    add(
        id='steam',
        name='Steam',
        category='metadata',
        admin_href='/admin/integrations#metadata',
        configured=True,
        notes='PC storefront metadata — normalised into the IGDB field shape',
    )
    add(
        id='gog',
        name='GOG',
        category='metadata',
        admin_href='/admin/integrations#metadata',
        configured=True,
        notes='PC storefront search — DRM-free catalogue',
    )
    add(
        id='epic',
        name='Epic Games Store',
        category='metadata',
        admin_href='/admin/integrations#metadata',
        configured=True,
        notes='PC storefront search',
    )
    add(
        id='itch',
        name='itch.io',
        category='metadata',
        admin_href='/admin/integrations#metadata',
        configured=True,
        notes='Indie storefront search',
    )
    add(
        id='rawg',
        name='RAWG',
        category='metadata',
        admin_href='/admin/integrations#metadata',
        configured=True,
        notes='Catalogue database backstop for PC and console',
    )

    sgdb_key = ''
    try:
        from oneirodex.utils.providers import get_steamgriddb_api_key

        sgdb_key = get_steamgriddb_api_key() or ''
    except Exception:
        sgdb_key = ''
    add(
        id='steamgriddb',
        name='SteamGridDB',
        category='artwork',
        admin_href='/admin/integrations#steamgriddb',
        configured=bool(sgdb_key),
        notes='Cover / hero art',
    )

    gb_key = bool(settings and getattr(settings, 'giantbomb_api_key', None))
    try:
        from oneirodex.utils.providers.mobygames import get_mobygames_api_key

        moby_key = bool(get_mobygames_api_key())
    except Exception:
        moby_key = bool(settings and getattr(settings, 'mobygames_api_key', None))
    try:
        from oneirodex.utils.providers.thegamesdb import get_thegamesdb_api_key

        tgdb_key = bool(get_thegamesdb_api_key())
    except Exception:
        tgdb_key = bool(settings and getattr(settings, 'thegamesdb_api_key', None))
    add(
        id='giantbomb',
        name='Giant Bomb',
        category='metadata',
        admin_href='/admin/integrations#giantbomb',
        configured=gb_key,
        notes='Secondary metadata / wiki',
    )
    add(
        id='mobygames',
        name='MobyGames',
        category='metadata',
        admin_href='/admin/integrations#mobygames',
        configured=moby_key,
        notes='Optional Class D identify search (MOBYGAMES_API_KEY)',
    )
    add(
        id='thegamesdb',
        name='TheGamesDB',
        category='metadata',
        admin_href='/admin/integrations#thegamesdb',
        configured=tgdb_key,
        notes='Optional Class D identify / covers (THEGAMESDB_API_KEY)',
    )

    hltb_on = bool(settings and getattr(settings, 'enable_hltb_integration', True))
    add(
        id='hltb',
        name='HowLongToBeat',
        category='metadata',
        admin_href='/admin/integrations#hltb',
        settings_href='/admin/new_server_settings',
        configured=hltb_on,
        enabled=hltb_on,
        notes='Playtime estimates (no API key)',
    )

    try:
        from oneirodex.utils.providers.meta_quest import get_meta_quest_api_mode

        mq_mode = get_meta_quest_api_mode()
    except Exception:
        mq_mode = 'csv_only'
    add(
        id='meta_quest',
        name='Meta / Quest',
        category='ownership',
        admin_href='/admin/integrations#meta_quest',
        configured=mq_mode != 'off',
        notes=f'Ownership register — mode={mq_mode}',
    )

    # --- Auth / mail / support ---
    smtp_ok = bool(settings and getattr(settings, 'smtp_server', None))
    add(
        id='smtp',
        name='SMTP Email',
        category='email',
        admin_href='/admin/integrations#email',
        settings_href='/admin/smtp_settings',
        configured=smtp_ok,
        notes='Invites, resets, digests',
    )

    oidc_env = os.environ.get('OIDC_ENABLED', '').lower() in ('1', 'true', 'yes')
    oidc_db = bool(settings and getattr(settings, 'oidc_enabled', False))
    oidc_cfg = bool(
        settings
        and getattr(settings, 'oidc_issuer_url', None)
        and getattr(settings, 'oidc_client_id', None)
    )
    add(
        id='oidc',
        name='OIDC / SSO',
        category='auth',
        admin_href='/admin/integrations#oidc',
        configured=oidc_cfg and (oidc_env or oidc_db),
        enabled=oidc_env and oidc_db,
        notes='Opt-in; needs OIDC_ENABLED env + Integrations toggle',
    )

    add(
        id='support',
        name='Support inbox',
        category='support',
        admin_href='/admin/support',
        configured=True,
        notes='In-app Report → admin inbox + GitHub Issues',
    )

    # --- Social / RTC ---
    chat_url = bool(settings and getattr(settings, 'community_chat_url', None))
    add(
        id='community_chat',
        name='Community chat link',
        category='social',
        admin_href='/admin/integrations#community',
        configured=chat_url,
        notes='BYO Stoat/Matrix deep-link',
    )

    try:
        from oneirodex.utils.livekit_rtc import livekit_config, livekit_enabled

        lk_cfg = livekit_config()
        lk_on = livekit_enabled()
        lk_ready = bool(lk_on and lk_cfg.get('url') and lk_cfg.get('api_key') and lk_cfg.get('api_secret'))
    except Exception:
        lk_on = False
        lk_ready = False
    add(
        id='livekit',
        name='LiveKit voice',
        category='rtc',
        admin_href='/admin/features',
        settings_href='/admin/ops',
        configured=lk_ready,
        enabled=lk_on,
        notes='Household voice SFU — ENABLE_LIVEKIT + LIVEKIT_* secrets',
    )

    # --- Acquire (admin-facing indexers / hubs) ---
    try:
        from oneirodex.utils.arr_connectors import connector_status

        for row in connector_status():
            cid = row.get('id') or 'arr'
            configured = bool(row.get('configured'))
            add(
                id=f"arr_{cid}",
                name=str(row.get('name') or cid),
                category='acquire',
                admin_href='/admin/arr',
                configured=configured,
                notes=str(row.get('note') or row.get('kind') or 'Acquire connector'),
            )
    except Exception:
        add(
            id='arr_module',
            name='Arr / indexers',
            category='acquire',
            admin_href='/admin/arr',
            configured=False,
            notes='Native Torznab + optional Prowlarr/Jackett/qBit',
        )

    # Ownership stores (register-only)
    add(
        id='ownership_steam',
        name='Steam ownership',
        category='ownership',
        admin_href='/admin/integrations#ownership',
        configured=True,
        notes='Register-only — no DRM download queues',
    )

    return rows
