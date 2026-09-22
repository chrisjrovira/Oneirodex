"""Design tokens, per-system palettes, era art table and the size matrix
behind the procedural cover renderer.

Split out of ``cover_art_studio`` in the v11 cycle (H-D.4) as a pure move so
the painters and the pack storage can both import them without a cycle.
``cover_art_studio`` re-exports every public name; import from there.
"""
from __future__ import annotations

from typing import Any




# Aurora design tokens (match setup/default_theme/css/od-tokens.css)
OD_BG = (11, 13, 16)
OD_SURFACE = (20, 24, 32)
OD_SURFACE_2 = (28, 34, 48)
OD_TEXT = (242, 244, 248)
OD_TEXT_MUTED = (196, 204, 216)
OD_ACCENT = (47, 214, 123)

# Operator title scaling. The slider default used to be 1.0 and the renderer
# skipped the multiply at 1.0, which is why Art Studio still drew tiny type
# after the slider shipped (UID-011). 1.3× is the new idle size; 0.85 is the
# floor so the control cannot undo the legibility this module exists for.
TITLE_SCALE_MIN = 0.85
TITLE_SCALE_MAX = 2.0
DEFAULT_TITLE_SCALE = 1.3


def clamp_title_scale(title_scale) -> float:
    try:
        if title_scale is None or title_scale == '':
            return DEFAULT_TITLE_SCALE
        return min(max(float(title_scale), TITLE_SCALE_MIN), TITLE_SCALE_MAX)
    except (TypeError, ValueError):
        return DEFAULT_TITLE_SCALE

# Per-system template packs: distinct palette + glyph for readable tiles ≥200×300.
# Keys are normalized (casefold) LibraryPlatform names/values and common short labels.
SystemPalette = tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int], str]

# (bg_top, bg_bottom, accent, glyph_id)
SYSTEM_TEMPLATES: dict[str, SystemPalette] = {
    'nes': ((48, 12, 18), (18, 8, 12), (220, 60, 60), 'cart'),
    'nintendo entertainment system (nes)': ((48, 12, 18), (18, 8, 12), (220, 60, 60), 'cart'),
    'snes': ((56, 28, 88), (22, 14, 40), (180, 120, 255), 'cart'),
    'super nintendo entertainment system (snes)': ((56, 28, 88), (22, 14, 40), (180, 120, 255), 'cart'),
    'n64': ((12, 48, 28), (8, 20, 14), (80, 200, 100), 'disc'),
    'nintendo 64': ((12, 48, 28), (8, 20, 14), (80, 200, 100), 'disc'),
    'gba': ((28, 40, 72), (12, 16, 36), (100, 160, 255), 'cart'),
    'nintendo gameboy advance': ((28, 40, 72), (12, 16, 36), (100, 160, 255), 'cart'),
    'gb': ((40, 56, 24), (16, 24, 12), (140, 200, 60), 'cart'),
    'gbc': ((40, 32, 64), (16, 14, 32), (200, 120, 255), 'cart'),
    'nds': ((20, 36, 64), (10, 16, 32), (90, 170, 255), 'clamshell'),
    'nintendo ds': ((20, 36, 64), (10, 16, 32), (90, 170, 255), 'clamshell'),
    'ngc': ((72, 36, 12), (32, 16, 8), (255, 140, 40), 'disc'),
    'nintendo gamecube': ((72, 36, 12), (32, 16, 8), (255, 140, 40), 'disc'),
    'wii': ((40, 48, 56), (16, 20, 28), (120, 180, 220), 'disc'),
    'nintendo wii': ((40, 48, 56), (16, 20, 28), (120, 180, 220), 'disc'),
    'switch': ((64, 16, 24), (24, 8, 12), (232, 56, 72), 'joycon'),
    'nintendo switch': ((64, 16, 24), (24, 8, 12), (232, 56, 72), 'joycon'),
    'psx': ((24, 24, 56), (10, 10, 28), (120, 120, 255), 'disc'),
    'sony playstation (psx)': ((24, 24, 56), (10, 10, 28), (120, 120, 255), 'disc'),
    'ps1': ((24, 24, 56), (10, 10, 28), (120, 120, 255), 'disc'),
    'ps2': ((12, 24, 56), (6, 12, 28), (60, 120, 220), 'disc'),
    'sony ps2': ((12, 24, 56), (6, 12, 28), (60, 120, 220), 'disc'),
    'ps3': ((20, 20, 28), (8, 8, 14), (180, 180, 200), 'disc'),
    'sony ps3': ((20, 20, 28), (8, 8, 14), (180, 180, 200), 'disc'),
    'psp': ((32, 32, 40), (12, 12, 18), (160, 160, 180), 'umd'),
    'sony psp': ((32, 32, 40), (12, 12, 18), (160, 160, 180), 'umd'),
    'sega_md': ((16, 32, 64), (8, 14, 32), (40, 120, 220), 'cart'),
    'sega mega drive/genesis (md)': ((16, 32, 64), (8, 14, 32), (40, 120, 220), 'cart'),
    'genesis': ((16, 32, 64), (8, 14, 32), (40, 120, 220), 'cart'),
    'sega_saturn': ((48, 24, 56), (20, 10, 28), (200, 80, 200), 'disc'),
    'sega saturn': ((48, 24, 56), (20, 10, 28), (200, 80, 200), 'disc'),
    'sega_dc': ((56, 28, 16), (24, 12, 8), (255, 120, 40), 'disc'),
    'sega dreamcast': ((56, 28, 16), (24, 12, 8), (255, 120, 40), 'disc'),
    'pcwin': ((16, 28, 40), (8, 12, 20), (47, 214, 123), 'pc'),
    'pc windows': ((16, 28, 40), (8, 12, 20), (47, 214, 123), 'pc'),
    'pcdos': ((28, 24, 16), (12, 10, 8), (220, 180, 60), 'pc'),
    'pc dos': ((28, 24, 16), (12, 10, 8), (220, 180, 60), 'pc'),
    'arcade': ((48, 8, 16), (20, 4, 8), (255, 60, 80), 'cabinet'),
    'xbox': ((12, 40, 20), (6, 18, 10), (80, 200, 80), 'xbox'),
    'x360': ((12, 40, 20), (6, 18, 10), (120, 220, 80), 'xbox'),
    'xbox 360': ((12, 40, 20), (6, 18, 10), (120, 220, 80), 'xbox'),
    'default': ((20, 24, 32), (11, 13, 16), (47, 214, 123), 'mark'),
}

# Decade-room palettes for backup/placeholder art. Geometry is original (wood
# stripes, poster blocks, carpet bands) — never scraped box art. Keys match
# play_rooms.ROOMS / html[data-era].
ERA_ART: dict[str, dict[str, Any]] = {
    'wood_den_80s': {
        'top': (42, 28, 18),
        'bottom': (18, 12, 8),
        'accent': (232, 192, 125),
        'glyph': 'cart',
        'kind': 'wood',
    },
    'teen_bedroom_90s': {
        'top': (56, 42, 72),
        'bottom': (22, 16, 28),
        'accent': (201, 160, 212),
        'glyph': 'cart',
        'kind': 'posters',
    },
    'carpet_den_late_90s': {
        'top': (28, 24, 40),
        'bottom': (12, 10, 16),
        'accent': (138, 164, 255),
        'glyph': 'disc',
        'kind': 'carpet',
    },
    'media_center_00s': {
        'top': (20, 28, 44),
        'bottom': (8, 12, 20),
        'accent': (63, 155, 255),
        'glyph': 'disc',
        'kind': 'media',
    },
    'arcade_cabinet': {
        'top': (48, 12, 28),
        'bottom': (8, 6, 15),
        'accent': (255, 45, 111),
        'glyph': 'cabinet',
        'kind': 'marquee',
    },
    'desk': {
        'top': (16, 32, 22),
        'bottom': (8, 14, 10),
        'accent': (94, 240, 138),
        'glyph': 'pc',
        'kind': 'phosphor',
    },
}

SIZE_MATRIX: list[tuple[str, int, int]] = [
    ('tile', 200, 300),
    ('tile', 400, 600),
    ('tile', 600, 900),
    ('wide', 480, 270),
    ('wide', 960, 540),
    ('wide', 1920, 1080),
    ('square', 128, 128),
    ('square', 256, 256),
    ('square', 512, 512),
    ('hero', 1280, 720),
]


def resolve_system_template(system: str | None) -> SystemPalette:
    """Map a LibraryPlatform label / short name to a template pack."""
    key = (system or '').strip().casefold()
    if not key:
        return SYSTEM_TEMPLATES['default']
    if key in SYSTEM_TEMPLATES:
        return SYSTEM_TEMPLATES[key]
    # Enum member name (e.g. SEGA_MD)
    compact = key.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '')
    if compact in SYSTEM_TEMPLATES:
        return SYSTEM_TEMPLATES[compact]
    for alias, pack in SYSTEM_TEMPLATES.items():
        if alias != 'default' and (alias in key or key in alias):
            return pack
    return SYSTEM_TEMPLATES['default']
