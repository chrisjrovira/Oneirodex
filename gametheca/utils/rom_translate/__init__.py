"""Offline ROM auto-translate stubs (no library mutation)."""

from gametheca.utils.rom_translate.registry import (
    get_pipeline_for_platform,
    list_rom_translate_capabilities,
)

__all__ = [
    'get_pipeline_for_platform',
    'list_rom_translate_capabilities',
]
