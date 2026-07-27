"""Registry of offline ROM translate pipeline stubs."""

from __future__ import annotations

from gametheca.utils.rom_translate.pipeline import BaseOfflineStub, GbaOfflineStub

_PIPELINES = [
    GbaOfflineStub(),
    BaseOfflineStub(),
]


def list_rom_translate_capabilities() -> list[dict]:
    """Public capability list for admin API / UI honesty."""
    # Deduplicate by platform preference (named stubs first)
    seen: set[str] = set()
    rows: list[dict] = []
    for pipe in _PIPELINES:
        key = pipe.platform
        if key in seen:
            continue
        seen.add(key)
        rows.append(pipe.to_dict())

    # Known platforms with no plugin yet
    known = (
        'NES',
        'SNES',
        'N64',
        'GB',
        'GBC',
        'GBA',
        'NDS',
        'SMS',
        'GENESIS',
        'PSX',
        'PCE',
    )
    for platform in known:
        if platform in seen:
            continue
        rows.append(
            {
                'id': f'{platform.lower()}_unsupported',
                'platform': platform,
                'status': 'unsupported',
                'docs_url': '/docs/strategy/rom-auto-translate.md',
                'supports_offline': False,
            }
        )
    return rows


def get_pipeline_for_platform(platform: str | None) -> BaseOfflineStub:
    key = (platform or '').strip().upper()
    for pipe in _PIPELINES:
        if pipe.platform == key:
            return pipe
    return BaseOfflineStub()
