"""Admin: product feature toggles (on by default; auth/OIDC stays separate)."""

from __future__ import annotations

import os

from flask import current_app, flash, redirect, render_template, request, url_for
from flask_login import login_required
from sqlalchemy import select

from gametheca import db
from gametheca.forms import CsrfProtectForm
from gametheca.models import GlobalSettings
from gametheca.utils.auth import admin_required
from gametheca.utils.global_settings import (
    global_settings_row,
    global_settings_row_or_create,
)
from gametheca.utils.malware_scan import module_status as malware_module_status
from gametheca.utils.ambient_lighting import ambient_lighting_status, get_ambient_config
from gametheca.utils.challenge_solver import challenge_solver_status, get_challenge_config

from . import admin2_bp

# Env flags that must never be flipped by Features/setup bulk save (opt-in / safety only).
NEVER_BULK_ENABLE_ENV = frozenset({
    'OIDC_ENABLED',
    'ENABLE_AI_AUTO_APPLY',
    'ALLOW_HARDLINK_APPLY',
    'ENABLE_CHALLENGE_SOLVER',
    'ENABLE_AMBIENT_LIGHTING',
    'ENABLE_REMOTE_PLAY',
})

# (form_name, config_key, label, help, safety_lock)
FEATURE_ENV_TOGGLES = (
    ('enable_arr_module', 'ENABLE_ARR_MODULE', 'Arr / indexer module', 'Native Torznab/Newznab + optional Prowlarr/Jackett hubs + presets', False),
    ('enable_debrid', 'ENABLE_DEBRID', 'Debrid acquire', 'Real-Debrid / AllDebrid / etc. when tokens set', False),
    ('enable_game_assists', 'ENABLE_GAME_ASSISTS', 'Game assists', 'Single-player assist packs', False),
    ('enable_vr_browse', 'ENABLE_VR_BROWSE', 'VR browse', '/vr PWA catalog', False),
    ('enable_ai_assist', 'ENABLE_AI_ASSIST', 'AI assist', 'Ollama suggestions (rename apply stays gated)', False),
    ('enable_livekit', 'ENABLE_LIVEKIT', 'LiveKit voice', 'Household voice rooms (needs LIVEKIT_* secrets)', False),
    ('enable_pcdos_browser', 'ENABLE_PCDOS_BROWSER', 'PC DOS browser play', 'Needs vendored dosbox WASM', False),
    ('enable_rom_patch_apply', 'ENABLE_ROM_PATCH_APPLY', 'ROM patch apply', 'Companion Flips apply', False),
    ('enable_patch_catalog', 'ENABLE_PATCH_CATALOG', 'Patch catalog', 'Operator YAML/JSON guides', False),
    ('enable_rom_ai_translate', 'ENABLE_ROM_AI_TRANSLATE', 'ROM AI translate hints', 'RetroArch AI Service overlay', False),
    ('enable_hardlink_helpers', 'ENABLE_HARDLINK_HELPERS', 'Hardlink helpers', 'Preview storage helpers', False),
    ('enable_malware_scan', 'ENABLE_MALWARE_SCAN', 'Malware scanner', 'ClamAV + filename heuristics', False),
    ('enable_activity_feed', 'ENABLE_ACTIVITY_FEED', 'Activity feed', 'Now playing / recent', False),
    ('enable_free_games', 'ENABLE_FREE_GAMES', 'Free games poller', 'News free-games feed', False),
    ('enable_mod_tracking', 'ENABLE_MOD_TRACKING', 'Mod tracking', 'Per-game mod notes', False),
    ('enable_ambient_lighting', 'ENABLE_AMBIENT_LIGHTING', 'Ambient lighting', 'Hyperion.ng / Home Assistant on play', False),
    ('enable_remote_play', 'ENABLE_REMOTE_PLAY', 'Remote play', 'BYO Sunshine/Wolf Moonlight host', False),
)


def _env_bool(key: str, default: bool = True) -> bool:
    raw = os.getenv(key)
    if raw is None or raw == '':
        return bool(current_app.config.get(key, default))
    return raw.lower() in ('1', 'true', 'yes', 'on')


@admin2_bp.route('/admin/features', methods=['GET', 'POST'])
@login_required
@admin_required
def features_settings_page():
    """Toggle product modules. OIDC/auth is under Integrations — stays off by default."""
    form = CsrfProtectForm()
    settings = global_settings_row()
    if settings is None:
        # Kept conditional so a plain GET does not commit on every page view;
        # the row only needs persisting the once, when it did not exist.
        settings = global_settings_row_or_create()
        db.session.commit()

    if request.method == 'POST' and form.validate_on_submit():
        settings.enable_arr_module = request.form.get('db_enable_arr_module') == 'on'
        settings.enable_ai_assist = request.form.get('db_enable_ai_assist') == 'on'
        settings.enable_malware_scan = request.form.get('db_enable_malware_scan') == 'on'
        settings.enable_game_updates = request.form.get('db_enable_game_updates') == 'on'
        settings.enable_game_extras = request.form.get('db_enable_game_extras') == 'on'
        settings.attract_mode_enabled = request.form.get('db_attract_mode_enabled') == 'on'
        # Parental control, so it is written like the rest but read fail-closed
        # in livekit_rtc — an unchecked box means children stay out.
        settings.allow_children_in_household_lobby = (
            request.form.get('db_allow_children_in_household_lobby') == 'on'
        )
        # Never enable OIDC from this page — auth stays opt-in on Integrations.
        db.session.commit()
        flash(
            'Feature preferences saved. Env flags (docker/.env) still override process defaults until restart.',
            'success',
        )
        return redirect(url_for('admin2.features_settings_page'))

    env_rows = []
    for form_name, key, label, help_text, _lock in FEATURE_ENV_TOGGLES:
        env_default = key not in ('ENABLE_REMOTE_PLAY', 'ENABLE_AMBIENT_LIGHTING')
        env_rows.append(
            {
                'name': form_name,
                'key': key,
                'label': label,
                'help': help_text,
                'on': _env_bool(key, env_default),
            }
        )

    return render_template(
        'admin/features_settings.html',
        form=form,
        settings=settings,
        env_rows=env_rows,
        malware=malware_module_status(),
        challenge=get_challenge_config(),
        challenge_status=challenge_solver_status(),
        ambient=get_ambient_config(),
        ambient_status=ambient_lighting_status(),
        oidc_enabled=_env_bool('OIDC_ENABLED', False) or bool(getattr(settings, 'oidc_enabled', False)),
        ai_auto_apply=_env_bool('ENABLE_AI_AUTO_APPLY', False),
        hardlink_apply=_env_bool('ALLOW_HARDLINK_APPLY', False),
    )
