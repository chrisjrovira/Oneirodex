"""WebRetro save-bridge expectations (O1) — mirrors od-bridge.js pickSramBytes ranking."""

from __future__ import annotations

from pathlib import Path


BRIDGE = Path(__file__).resolve().parents[1] / 'oneirodex' / 'static' / 'vendor' / 'webretro' / 'od-bridge.js'


def _rank(ext: str) -> int:
    e = (ext or '').lower()
    if e == '.srm' or e.endswith('.srm'):
        return 3
    if e == '.mcr' or e.endswith('.mcr'):
        return 2
    if e == '.sav' or e.endswith('.sav'):
        return 1
    return 0


def pick_sram_bytes(save_arr: list[dict]) -> bytes | None:
    preferred = None
    best_rank = -1
    for entry in save_arr or []:
        data = entry.get('data')
        if not data:
            continue
        r = _rank(entry.get('ext') or '')
        if r > best_rank:
            best_rank = r
            preferred = data
        elif best_rank < 0:
            preferred = data
            best_rank = 0
    return preferred


def test_bridge_file_documents_o1_behaviors():
    text = BRIDGE.read_text(encoding='utf-8')
    assert 'pickSramBytes' in text
    assert 'EXPORT_DELAYS_MS' in text
    assert '_cmd_load_state' in text
    assert '.mcr' in text
    assert 'autoLoaded' in text


def test_pick_sram_prefers_srm_over_sav():
    chosen = pick_sram_bytes(
        [
            {'ext': '.sav', 'data': b'sav'},
            {'ext': '.srm', 'data': b'srm'},
            {'ext': '.mcr', 'data': b'mcr'},
        ]
    )
    assert chosen == b'srm'


def test_pick_sram_falls_back_to_mcr_then_sav():
    assert pick_sram_bytes([{'ext': '.sav', 'data': b'sav'}, {'ext': '.mcr', 'data': b'mcr'}]) == b'mcr'
    assert pick_sram_bytes([{'ext': '.sav', 'data': b'sav'}]) == b'sav'
    assert pick_sram_bytes([{'ext': '.bin', 'data': b'bin'}]) == b'bin'
    assert pick_sram_bytes([]) is None
