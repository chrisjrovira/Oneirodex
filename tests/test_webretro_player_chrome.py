"""Player chrome (UID-007 + cabinet playback) — pause / rewind / picture on the play shell.

The controls live on `webretro.html` and talk to the iframe through `gt-bridge.js`.
These are source assertions: a missing toolbar still renders a playable room, so
nothing else would notice.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEBRETRO = ROOT / 'gametheca' / 'static' / 'vendor' / 'webretro'


def test_play_shell_exposes_playback_controls():
    html = (WEBRETRO / 'webretro.html').read_text(encoding='utf-8')
    for token in (
        'data-gt-play="pause"',
        'data-gt-play="reset"',
        'data-gt-play="mute"',
        'data-gt-play="power"',
        'data-gt-play="save"',
        'data-gt-play="load"',
        'data-gt-play="rewind"',
        'data-gt-play="ff"',
        'data-gt-play="picture"',
        'data-gt-play="help"',
        'id="gt-play-volume"',
        'id="gt-play-help"',
        'gt-play-overlay',
        'gt-play-chrome',
    ):
        assert token in html, token


def test_bridge_handles_playback_messages():
    src = (WEBRETRO / 'gt-bridge.js').read_text(encoding='utf-8')
    for token in (
        "'gt-pause'",
        "'gt-reset'",
        "'gt-audio'",
        "'gt-save-state'",
        "'gt-load-state'",
        "'gt-picture'",
        "'gt-cabinet-key'",
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
    assert '.gt-play-overlay' in css
    assert 'prefers-reduced-motion' in css
    assert '(hover: none)' in css
    assert '[data-picture="crt"]' in css
    assert '[data-picture="sharp"]' in css
    assert '.gt-play-help' in css
