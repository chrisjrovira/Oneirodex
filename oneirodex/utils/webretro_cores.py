"""WebRetro WASM core discovery (operator-vendored cores on disk)."""

from __future__ import annotations

from pathlib import Path

# Cores operators may drop later — not shipped in the default image.
DEFERRED_BROWSER_CORES: dict[str, dict] = {
    'mednafen_pce_fast': {
        'platforms': ['PCE'],
        'label': 'PC Engine / TurboGrafx (mednafen_pce_fast)',
    },
    'mednafen_supergrafx': {
        'platforms': ['PCE'],
        'label': 'SuperGrafx (mednafen_supergrafx)',
    },
    'vice_x64': {
        'platforms': ['VICE_X64SC', 'VICE_X128', 'VICE_XVIC', 'VICE_XPLUS4', 'VICE_XPET'],
        'label': 'Commodore (vice_x64)',
    },
    'dosbox_pure': {
        'platforms': ['PCDOS'],
        'label': 'DOS (dosbox_pure)',
        'flag': 'ENABLE_PCDOS_BROWSER',
    },
    'dosbox': {
        'platforms': ['PCDOS'],
        'label': 'DOS (dosbox)',
        'flag': 'ENABLE_PCDOS_BROWSER',
    },
}


def default_cores_dir() -> Path:
    here = Path(__file__).resolve().parent.parent
    return here / 'static' / 'vendor' / 'webretro' / 'cores'


def discover_webretro_cores(cores_dir: str | Path | None = None) -> frozenset[str]:
    """Return core IDs that have a ``*_libretro.wasm`` file on disk."""
    root = Path(cores_dir) if cores_dir else default_cores_dir()
    if not root.is_dir():
        return frozenset()
    found: set[str] = set()
    for path in root.glob('*_libretro.wasm'):
        name = path.name[: -len('_libretro.wasm')]
        if name:
            found.add(name)
    return frozenset(found)


def get_effective_installed_cores(cores_dir: str | Path | None = None) -> frozenset[str]:
    """Shipped allowlist ∪ cores discovered on disk.

    Reads ``WEBRETR_INSTALLED_CORES`` live so tests can monkeypatch it.
    """
    from oneirodex import platform as plat

    shipped = frozenset(getattr(plat, 'WEBRETR_INSTALLED_CORES', ()) or ())
    return shipped | discover_webretro_cores(cores_dir)


def wasm_present_on_disk(core_id: str, cores_dir: str | Path | None = None) -> bool:
    root = Path(cores_dir) if cores_dir else default_cores_dir()
    return (root / f'{core_id}_libretro.wasm').is_file()


def deferred_core_status(cores_dir: str | Path | None = None) -> dict[str, dict]:
    """Operator-facing status for Wave 19 deferred WASM cores."""
    root = Path(cores_dir) if cores_dir else default_cores_dir()
    out: dict[str, dict] = {}
    for core_id, meta in DEFERRED_BROWSER_CORES.items():
        out[core_id] = {
            **meta,
            'wasm_present': (root / f'{core_id}_libretro.wasm').is_file(),
            'js_present': (root / f'{core_id}_libretro.js').is_file(),
        }
    return out
