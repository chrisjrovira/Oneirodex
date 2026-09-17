"""Player chrome (UID-007 + cabinet playback) — pause / rewind / picture on the play shell.

The controls live on `webretro.html` and talk to the iframe through `od-bridge.js`.
These are source assertions: a missing toolbar still renders a playable room, so
nothing else would notice.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEBRETRO = ROOT / 'oneirodex' / 'static' / 'vendor' / 'webretro'


def test_play_shell_exposes_playback_controls():
    html = (WEBRETRO / 'webretro.html').read_text(encoding='utf-8')
    for token in (
        'data-od-play="pause"',
        'data-od-play="reset"',
        'data-od-play="mute"',
        'data-od-play="power"',
        'data-od-play="save"',
        'data-od-play="load"',
        'data-od-play="rewind"',
        'data-od-play="ff"',
        'data-od-play="picture"',
        'data-od-play="help"',
        'id="od-play-volume"',
        'id="od-play-help"',
        'od-play-overlay',
        'od-play-chrome',
    ):
        assert token in html, token


def test_bridge_handles_playback_messages():
    src = (WEBRETRO / 'od-bridge.js').read_text(encoding='utf-8')
    for token in (
        "'od-pause'",
        "'od-reset'",
        "'od-audio'",
        "'od-save-state'",
        "'od-load-state'",
        "'od-picture'",
        "'od-cabinet-key'",
        'audio_mute',
        '_cmd_reset',
        '_cmd_save_state',
        '_cmd_load_state',
        'rewindOkForCore',
        'ShiftRight',
    ):
        assert token in src, token


def test_rewind_and_fast_forward_are_wired_in_retroarch_cfg():
    base = (WEBRETRO / 'assets' / 'base.js').read_text(encoding='utf-8')
    for token in (
        'rewind_enable = "true"',
        'input_rewind = "rshift"',
        'input_toggle_fast_forward = "f5"',
        'input_hold_fast_forward = "tab"',
        'fastforward_ratio',
        'video_smooth = "false"',
    ):
        assert token in base, token
    assert 'rewind_enable = "true"' in base
    assert 'Do not enable runahead' in base
    assert 'runahead_enable' not in base


def test_overlay_css_auto_hides_on_fine_pointers():
    css = (WEBRETRO / 'play-skins.css').read_text(encoding='utf-8')
    assert '.od-play-overlay' in css
    assert 'prefers-reduced-motion' in css
    assert '(hover: none)' in css
    assert '[data-picture="crt"]' in css
    assert '[data-picture="sharp"]' in css
    assert '.od-play-help' in css


def test_leave_play_never_uses_history_back():
    """Iframe navigations poison history.back(); leave must always navigate away."""
    html = (WEBRETRO / 'webretro.html').read_text(encoding='utf-8')
    assert 'function goBackToLibrary()' in html
    assert 'function clearLeaveGuards()' in html
    assert 'history.back(' not in html
    assert "window.location.assign('/library')" in html
    assert 'onbeforeunload = null' in html
    assert 'od-allow-leave' in html
    assert '&_gt=' in html  # cache key travels with the iframe URL; its value is checked below


def test_embedded_webretro_skips_beforeunload_trap():
    """ROM start must not install onbeforeunload inside the play iframe."""
    base = (WEBRETRO / 'assets' / 'base.js').read_text(encoding='utf-8')
    assert 'window.self === window.top' in base
    assert 'window.onbeforeunload = function() { return true; }' in base
    bridge = (WEBRETRO / 'od-bridge.js').read_text(encoding='utf-8')
    assert "type === 'od-allow-leave'" in bridge
    standalone = (WEBRETRO / 'standalone.html').read_text(encoding='utf-8')
    assert 'base.js?v=' in standalone


def test_overlay_shell_stays_click_through():
    """Visible overlay must not cover Start; only .od-play-ctrl takes pointers."""
    css = (WEBRETRO / 'play-skins.css').read_text(encoding='utf-8')
    assert '.od-play-overlay .od-play-ctrl' in css
    assert 'pointer-events: auto' in css
    # The always-on touch rule must not re-arm the full shell as a hit target.
    touch = css.split('@media (hover: none)')[1].split('@media')[0]
    assert 'pointer-events: none' in touch
    assert 'pointer-events: auto' not in touch


def test_play_asset_cache_key_is_one_value_everywhere():
    """base.js and od-bridge.js share one ?v= key, and webretro.html passes the same one.

    The key is the only cache control these files have (max-age=3600, no
    validator). It sat at `leave-guard-1` through two refresh-clock fixes, so a
    browser that had the old file kept it. Pinning the literal here would
    recreate that trap; pinning *consistency* means a bump cannot be partial.
    """
    import re

    standalone = (WEBRETRO / 'standalone.html').read_text(encoding='utf-8')
    shell = (WEBRETRO / 'webretro.html').read_text(encoding='utf-8')
    keys = set(re.findall(r"(?:base\.js|od-bridge\.js)\?v=([\w.-]+)", standalone))
    assert len(keys) == 1, f'base.js and od-bridge.js disagree on the cache key: {keys}'
    (key,) = keys
    assert key != 'leave-guard-1', 'the key was never bumped past the leave-guard fix'
    assert f"_gt={key}" in shell, 'webretro.html passes a different key to the iframe than standalone loads'
