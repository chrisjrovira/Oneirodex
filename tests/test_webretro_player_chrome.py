"""Player chrome (UID-007) — pause / reset / mute / volume / power on the play shell.

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
        'id="gt-play-volume"',
        'gt-play-overlay',
        'gt-play-chrome',
    ):
        assert token in html, token


def test_bridge_handles_playback_messages():
    src = (WEBRETRO / 'gt-bridge.js').read_text(encoding='utf-8')
    for token in ("'gt-pause'", "'gt-reset'", "'gt-audio'", 'audio_mute', '_cmd_reset'):
        assert token in src, token


def test_overlay_css_auto_hides_on_fine_pointers():
    css = (WEBRETRO / 'play-skins.css').read_text(encoding='utf-8')
    assert '.gt-play-overlay' in css
    assert 'prefers-reduced-motion' in css
    assert '(hover: none)' in css
