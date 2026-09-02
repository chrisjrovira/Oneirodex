"""WebRetro core discovery helpers (no multi-MB WASM in repo)."""

from __future__ import annotations

from pathlib import Path

from oneirodex.utils.webretro_cores import (
    deferred_core_status,
    discover_webretro_cores,
    get_effective_installed_cores,
)


def test_discover_reads_wasm_filenames(tmp_path: Path):
    (tmp_path / 'nestopia_libretro.wasm').write_bytes(b'\0')
    (tmp_path / 'mednafen_pce_fast_libretro.wasm').write_bytes(b'\0')
    (tmp_path / 'readme.txt').write_text('ignore')
    found = discover_webretro_cores(tmp_path)
    assert found == frozenset({'nestopia', 'mednafen_pce_fast'})


def test_effective_unions_shipped_and_disk(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(
        'oneirodex.platform.WEBRETR_INSTALLED_CORES',
        frozenset({'nestopia'}),
    )
    (tmp_path / 'vice_x64_libretro.wasm').write_bytes(b'\0')
    effective = get_effective_installed_cores(tmp_path)
    assert 'nestopia' in effective
    assert 'vice_x64' in effective


def test_deferred_status_reports_missing_by_default():
    status = deferred_core_status()
    assert 'mednafen_pce_fast' in status
    assert 'vice_x64' in status
    assert 'dosbox_pure' in status
    # Default image does not vendor these
    assert status['mednafen_pce_fast']['wasm_present'] is False
    assert status['vice_x64']['wasm_present'] is False
    assert status['dosbox_pure']['flag'] == 'ENABLE_PCDOS_BROWSER'


def test_installed_cores_js_endpoint(client):
    res = client.get('/api/emulator/installed-cores.js')
    assert res.status_code == 200
    assert res.mimetype == 'application/javascript'
    body = res.get_data(as_text=True)
    assert body.startswith('var GT_INSTALLED_CORES = ')
    assert 'nestopia' in body
    assert 'Cache-Control' in res.headers
    assert res.headers['Cache-Control'] == 'private, max-age=300'
