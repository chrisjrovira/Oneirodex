"""BP-1 Nostalgist NES host — household URLs only, no CDN ROMs/cores."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOST = ROOT / 'oneirodex' / 'static' / 'vendor' / 'nostalgist'


def test_pilot_host_loads_umd_and_household_resolvers():
    html = (HOST / 'play.html').read_text(encoding='utf-8')
    assert 'nostalgist.umd.js' in html
    assert 'Nostalgist.launch' in html
    assert '/api/downloadrom/' in html
    assert 'window.location.origin' in html
    assert '/static/vendor/webretro/cores/' in html
    assert '_libretro.js' in html
    assert '_libretro.wasm' in html
    assert 'resolveRom' in html
    lower = html.lower()
    assert 'jsdelivr' not in lower
    assert 'cdn.jsdelivr' not in lower
    assert 'github.com' not in lower


def test_umd_and_licence_are_present():
    assert (HOST / 'nostalgist.umd.js').is_file()
    licence = (HOST / 'LICENSE').read_text(encoding='utf-8')
    assert 'MIT License' in licence
    assert 'arianrhodsandlot' in licence
