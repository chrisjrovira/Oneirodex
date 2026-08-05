"""Procedural cover art for GameTheca — aurora tokens, Pillow templates (no cloud AI)."""

from __future__ import annotations

import hashlib
import io
import math
import os
import re
import uuid
import zipfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from flask import current_app, url_for
from sqlalchemy import select
from werkzeug.utils import secure_filename

from gametheca import db
from gametheca.models import Game, Image as GameImage

# Aurora design tokens (match setup/default_theme/css/gt-tokens.css)
GT_BG = (11, 13, 16)
GT_SURFACE = (20, 24, 32)
GT_SURFACE_2 = (28, 34, 48)
GT_TEXT = (242, 244, 248)
GT_TEXT_MUTED = (196, 204, 216)
GT_ACCENT = (47, 214, 123)

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

SAFE_PACK_ID = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')

_FONT_CANDIDATES = (
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'C:/Windows/Fonts/segoeuib.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
)


def _filename_for(prefix: str, width: int, height: int, ext: str) -> str:
    if width == height:
        return f'{prefix}_{width}.{ext}'
    return f'{prefix}_{width}x{height}.{ext}'


KNOWN_FILENAMES = frozenset(
    _filename_for(prefix, w, h, 'webp')
    for prefix, w, h in SIZE_MATRIX
) | frozenset(
    _filename_for(prefix, w, h, 'png')
    for prefix, w, h in SIZE_MATRIX
)


def generated_root(package_root: str | Path | None = None) -> Path:
    if package_root is not None:
        return Path(package_root) / 'static' / 'library' / 'generated'
    return Path(current_app.root_path) / 'static' / 'library' / 'generated'


def stock_root(package_root: str | Path | None = None) -> Path:
    """Operator-selectable platform / stock packs (stable ids under library/stock/)."""
    if package_root is not None:
        return Path(package_root) / 'static' / 'library' / 'stock'
    return Path(current_app.root_path) / 'static' / 'library' / 'stock'


def newstyle_root(package_root: str | Path | None = None) -> Path:
    if package_root is not None:
        return Path(package_root) / 'static' / 'newstyle'
    return Path(current_app.root_path) / 'static' / 'newstyle'


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in _FONT_CANDIDATES:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def _lerp_color(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


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


def _title_seed(title: str) -> int:
    """Stable 32-bit seed from a title (unicode-safe)."""
    digest = hashlib.sha256(title.encode('utf-8')).hexdigest()
    return int(digest[:8], 16)


def _mix_rgb(
    a: tuple[int, int, int],
    b: tuple[int, int, int],
    t: float,
) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return _lerp_color(a, b, t)


def _title_secondary_accent(
    seed: int,
    base: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Derive a secondary accent from the title seed — teal/amber/coral family, not purple-white."""
    family = (
        (47, 214, 123),   # aurora green
        (64, 180, 220),   # cool teal
        (232, 168, 56),   # amber
        (220, 88, 72),    # coral
        (120, 200, 180),  # mint
        (255, 140, 60),   # orange
    )
    pick = family[seed % len(family)]
    return _mix_rgb(base, pick, 0.55)


def _title_initials(title: str) -> str:
    words = [w for w in re.split(r'\s+', title.strip()) if w]
    if not words:
        return 'GT'
    if len(words) == 1:
        ch = words[0][0]
        return ch.upper() if ch.isalpha() or not ch.isascii() else words[0][:2].upper()
    chars: list[str] = []
    for word in words[:3]:
        chars.append(word[0].upper() if word else '')
    return ''.join(c for c in chars if c)[:3] or 'GT'


def _vertical_gradient(
    width: int,
    height: int,
    top: tuple[int, int, int] = GT_SURFACE,
    bottom: tuple[int, int, int] = GT_BG,
) -> Image.Image:
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(height - 1, 1)
        color = _lerp_color(top, bottom, t * 0.85)
        draw.line([(0, y), (width, y)], fill=color)
    return img


def _paint_artistic_backdrop(
    img: Image.Image,
    *,
    top: tuple[int, int, int],
    bottom: tuple[int, int, int],
    accent: tuple[int, int, int],
    secondary: tuple[int, int, int],
    seed: int,
    variant: str,
) -> None:
    """Layer diagonal bands + soft orbs so the field is not a flat aurora slab."""
    width, height = img.size
    draw = ImageDraw.Draw(img)
    band_count = 5 + (seed % 4)
    for i in range(band_count):
        t = i / max(band_count - 1, 1)
        color = _mix_rgb(_mix_rgb(top, bottom, t), secondary, 0.18 + (seed % 7) * 0.02)
        offset = int(((seed >> (i % 8)) & 0xFF) / 255 * width * 0.35) - width // 8
        y0 = int(height * (t - 0.15))
        y1 = int(height * (t + 0.28))
        points = [
            (offset, y0),
            (width + offset, y0 + height // 10),
            (width - offset // 2, y1),
            (-offset // 2, y1 - height // 12),
        ]
        draw.polygon(points, fill=color)

    # Soft glow orbs anchored by seed — distinct per title
    orb_n = 2 + (seed % 3)
    for i in range(orb_n):
        cx = int(width * (0.15 + ((seed >> (i * 5)) & 0x1F) / 31 * 0.7))
        cy = int(height * (0.12 + ((seed >> (i * 7 + 3)) & 0x1F) / 31 * 0.55))
        r = int(min(width, height) * (0.18 + ((seed >> (i * 3)) & 0xF) / 15 * 0.22))
        tint = _mix_rgb(accent, secondary, 0.35 + 0.2 * i)
        for step in range(6, 0, -1):
            rr = int(r * step / 6)
            fade = _mix_rgb(tint, bottom if cy > height // 2 else top, 0.55 + step * 0.06)
            draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=fade)

    if variant in ('wide', 'hero'):
        # Cinematic side wash
        wash_w = max(24, width // 5)
        for x in range(wash_w):
            t = x / max(wash_w - 1, 1)
            col = _mix_rgb(accent, top, 0.65 + t * 0.25)
            # Approximate alpha by mixing toward existing vertical tone
            draw.line([(x, 0), (x, height)], fill=_mix_rgb(col, bottom, 0.4))
            draw.line(
                [(width - 1 - x, 0), (width - 1 - x, height)],
                fill=_mix_rgb(secondary, bottom, 0.45),
            )


def _draw_bezel_frame(
    draw: ImageDraw.ImageDraw,
    width: int,
    height: int,
    accent: tuple[int, int, int],
    secondary: tuple[int, int, int],
    *,
    variant: str,
    seed: int,
) -> None:
    """Geometric frame / bezel hints — designed per variant, not a crop box."""
    inset = max(6, min(width, height) // 18)
    stroke = max(1, min(width, height) // 160)
    light = _mix_rgb(accent, (255, 255, 255), 0.28)
    mid = _mix_rgb(accent, secondary, 0.4)

    # Outer accent rails
    rail = max(3, height // 72)
    draw.rectangle([0, 0, width, rail], fill=accent)
    draw.rectangle([0, height - rail, width, height], fill=secondary)

    if variant == 'square':
        # Nested diamond-ish corners
        m = inset + rail
        corner = max(10, min(width, height) // 8)
        for ax, ay in ((m, m), (width - m, m), (m, height - m), (width - m, height - m)):
            draw.line([ax - corner // 2, ay, ax, ay - corner // 2], fill=light, width=stroke)
            draw.line([ax, ay - corner // 2, ax + corner // 2, ay], fill=light, width=stroke)
            draw.line([ax + corner // 2, ay, ax, ay + corner // 2], fill=mid, width=stroke)
            draw.line([ax, ay + corner // 2, ax - corner // 2, ay], fill=mid, width=stroke)
        draw.rectangle([inset, inset, width - inset, height - inset], outline=light, width=stroke)
        return

    if variant in ('wide', 'hero'):
        # Letterbox + side pillars
        draw.rectangle([inset, rail + inset // 2, width - inset, height - rail - inset // 2], outline=light, width=stroke)
        pillar = max(4, width // 48)
        draw.rectangle([inset, rail + inset, inset + pillar, height - rail - inset], fill=mid)
        draw.rectangle(
            [width - inset - pillar, rail + inset, width - inset, height - rail - inset],
            fill=_mix_rgb(secondary, mid, 0.5),
        )
        # Seeded tick marks along bottom rail
        ticks = 4 + (seed % 5)
        for i in range(ticks):
            tx = int(inset + (width - 2 * inset) * (i + 1) / (ticks + 1))
            draw.rectangle([tx - 1, height - rail - 6, tx + 1, height - rail], fill=light)
        return

    # tile (2:3): cart-style bezel with corner brackets
    draw.rectangle(
        [inset, rail + inset // 2, width - inset, height - rail - inset // 2],
        outline=light,
        width=stroke,
    )
    bracket = max(12, min(width, height) // 10)
    pts = [
        (inset, rail + inset // 2 + bracket),
        (inset, rail + inset // 2),
        (inset + bracket, rail + inset // 2),
    ]
    draw.line(pts, fill=accent, width=stroke + 1)
    draw.line(
        [
            (width - inset - bracket, rail + inset // 2),
            (width - inset, rail + inset // 2),
            (width - inset, rail + inset // 2 + bracket),
        ],
        fill=secondary,
        width=stroke + 1,
    )
    draw.line(
        [
            (inset, height - rail - inset // 2 - bracket),
            (inset, height - rail - inset // 2),
            (inset + bracket, height - rail - inset // 2),
        ],
        fill=secondary,
        width=stroke + 1,
    )
    draw.line(
        [
            (width - inset - bracket, height - rail - inset // 2),
            (width - inset, height - rail - inset // 2),
            (width - inset, height - rail - inset // 2 - bracket),
        ],
        fill=accent,
        width=stroke + 1,
    )


def _maybe_scanlines(
    img: Image.Image,
    glyph: str,
    seed: int,
) -> None:
    """Subtle scanlines for retro cart/disc systems — never dominate."""
    if glyph not in ('cart', 'disc', 'clamshell', 'umd', 'cabinet'):
        return
    if seed % 3 == 0:
        return
    width, height = img.size
    if min(width, height) < 180:
        return
    step = max(4, height // 80)
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for y in range(0, height, step * 2):
        od.line([(0, y), (width, y)], fill=(0, 0, 0, 28))
    composed = Image.alpha_composite(img.convert('RGBA'), overlay)
    img.paste(composed.convert('RGB'))


def _draw_mark(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float, accent=GT_ACCENT) -> None:
    """Minimal GameTheca controller mark (matches gametheca_mark.svg)."""
    s = scale
    body = [
        cx - 22 * s,
        cy - 12 * s,
        cx + 22 * s,
        cy + 12 * s,
    ]
    draw.rounded_rectangle(body, radius=int(8 * s), outline=accent, width=max(2, int(3 * s)))
    draw.ellipse(
        [cx - 22 * s + 12 * s - 3.5 * s, cy - 3.5 * s, cx - 22 * s + 12 * s + 3.5 * s, cy + 3.5 * s],
        fill=accent,
    )
    draw.ellipse([cx + 8 * s - 2 * s, cy - 5 * s, cx + 8 * s + 2 * s, cy - 1 * s], fill=GT_TEXT)
    draw.ellipse([cx + 13 * s - 2 * s, cy, cx + 13 * s + 2 * s, cy + 4 * s], fill=GT_TEXT)
    draw.rectangle([cx - 2 * s, cy - 14 * s, cx + 2 * s, cy - 8 * s], fill=accent)


def _draw_system_glyph(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    scale: float,
    glyph: str,
    accent: tuple[int, int, int],
) -> None:
    """Draw a simple system mark that stays readable at tile sizes."""
    s = max(0.55, scale)
    w = max(2, int(2.5 * s))
    if glyph == 'cart':
        draw.rounded_rectangle(
            [cx - 18 * s, cy - 22 * s, cx + 18 * s, cy + 22 * s],
            radius=int(4 * s),
            outline=accent,
            width=w,
        )
        draw.rectangle([cx - 10 * s, cy - 26 * s, cx + 10 * s, cy - 18 * s], fill=accent)
        draw.line([cx - 10 * s, cy - 6 * s, cx + 10 * s, cy - 6 * s], fill=accent, width=w)
        draw.line([cx - 10 * s, cy + 4 * s, cx + 10 * s, cy + 4 * s], fill=accent, width=w)
    elif glyph == 'disc':
        r = 20 * s
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=accent, width=w)
        draw.ellipse([cx - 5 * s, cy - 5 * s, cx + 5 * s, cy + 5 * s], fill=accent)
    elif glyph == 'clamshell':
        draw.rounded_rectangle(
            [cx - 20 * s, cy - 24 * s, cx + 20 * s, cy - 2 * s],
            radius=int(3 * s), outline=accent, width=w,
        )
        draw.rounded_rectangle(
            [cx - 20 * s, cy + 2 * s, cx + 20 * s, cy + 24 * s],
            radius=int(3 * s), outline=accent, width=w,
        )
    elif glyph == 'joycon':
        draw.rounded_rectangle(
            [cx - 26 * s, cy - 18 * s, cx - 10 * s, cy + 18 * s],
            radius=int(6 * s), outline=accent, width=w,
        )
        draw.rounded_rectangle(
            [cx + 10 * s, cy - 18 * s, cx + 26 * s, cy + 18 * s],
            radius=int(6 * s), outline=(90, 200, 255), width=w,
        )
        draw.rectangle([cx - 8 * s, cy - 14 * s, cx + 8 * s, cy + 14 * s], outline=GT_TEXT, width=max(1, w - 1))
    elif glyph == 'umd':
        draw.ellipse([cx - 18 * s, cy - 18 * s, cx + 18 * s, cy + 18 * s], outline=accent, width=w)
        draw.ellipse([cx - 10 * s, cy - 10 * s, cx + 10 * s, cy + 10 * s], outline=accent, width=max(1, w - 1))
    elif glyph == 'pc':
        draw.rounded_rectangle(
            [cx - 22 * s, cy - 16 * s, cx + 22 * s, cy + 10 * s],
            radius=int(3 * s), outline=accent, width=w,
        )
        draw.rectangle([cx - 6 * s, cy + 10 * s, cx + 6 * s, cy + 16 * s], fill=accent)
        draw.rectangle([cx - 14 * s, cy + 16 * s, cx + 14 * s, cy + 20 * s], fill=accent)
    elif glyph == 'cabinet':
        draw.rectangle([cx - 16 * s, cy - 24 * s, cx + 16 * s, cy + 22 * s], outline=accent, width=w)
        draw.rectangle([cx - 12 * s, cy - 18 * s, cx + 12 * s, cy - 4 * s], fill=accent)
        draw.ellipse([cx - 4 * s, cy + 6 * s, cx + 4 * s, cy + 14 * s], outline=accent, width=w)
    elif glyph == 'xbox':
        draw.ellipse([cx - 18 * s, cy - 18 * s, cx + 18 * s, cy + 18 * s], outline=accent, width=w)
        draw.line([cx - 8 * s, cy - 8 * s, cx + 8 * s, cy + 8 * s], fill=accent, width=w)
        draw.line([cx + 8 * s, cy - 8 * s, cx - 8 * s, cy + 8 * s], fill=accent, width=w)
    else:
        _draw_mark(draw, cx, cy, scale, accent=accent)


def _draw_title_motif(
    draw: ImageDraw.ImageDraw,
    width: int,
    height: int,
    *,
    title: str,
    seed: int,
    accent: tuple[int, int, int],
    secondary: tuple[int, int, int],
    variant: str,
) -> None:
    """Shape language + letterform watermark derived from the title string."""
    motif = seed % 5
    short = min(width, height)
    stroke = max(1, short // 120)
    initials = _title_initials(title)
    mono_size = max(48, short // (2 if variant == 'square' else 3))
    mono_font = _load_font(mono_size)
    mono_bbox = mono_font.getbbox(initials)
    mw = mono_bbox[2] - mono_bbox[0]
    mh = mono_bbox[3] - mono_bbox[1]

    if variant in ('wide', 'hero'):
        mx = int(width * 0.12)
        my = int(height * 0.22)
    elif variant == 'square':
        mx = (width - mw) // 2
        my = int(height * 0.18)
    else:
        mx = (width - mw) // 2
        my = int(height * 0.08)

    ghost = _mix_rgb(accent, secondary, 0.5)
    # Large initials watermark (always — readable title treatment anchor)
    draw.text((mx + 2, my + 2), initials, fill=(0, 0, 0), font=mono_font)
    draw.text((mx, my), initials, fill=_mix_rgb(ghost, GT_TEXT, 0.25), font=mono_font)

    cx = width // 2 if variant != 'wide' and variant != 'hero' else int(width * 0.28)
    cy = int(height * (0.30 if variant not in ('wide', 'hero') else 0.48))

    if motif == 0:
        # Concentric arcs
        for i in range(3, 8):
            r = int(short * (0.08 + i * 0.05))
            col = accent if i % 2 else secondary
            draw.arc([cx - r, cy - r, cx + r, cy + r], start=(seed + i * 40) % 360, end=(seed + i * 40 + 140) % 360, fill=col, width=stroke + 1)
    elif motif == 1:
        # Diamond lattice from char codes
        n = 3 + (seed % 3)
        for i, ch in enumerate(title.replace(' ', '')[:8] or 'GT'):
            ang = (ord(ch) + seed + i * 37) % 360
            rad = short * (0.12 + (i % 4) * 0.06)
            px = int(cx + math.cos(math.radians(ang)) * rad)
            py = int(cy + math.sin(math.radians(ang)) * rad)
            d = max(6, short // 28)
            draw.polygon(
                [(px, py - d), (px + d, py), (px, py + d), (px - d, py)],
                outline=accent if i % 2 == 0 else secondary,
            )
    elif motif == 2:
        # Diagonal chevrons
        chevron_n = 4 + (seed % 3)
        for i in range(chevron_n):
            y = int(height * (0.15 + i * 0.08))
            span = int(width * (0.2 + (i % 3) * 0.08))
            ox = int(width * (0.1 if variant in ('wide', 'hero') else 0.2))
            draw.line(
                [(ox, y), (ox + span // 2, y - span // 5), (ox + span, y)],
                fill=secondary,
                width=stroke + 1,
            )
    elif motif == 3:
        # Ring constellation keyed to codepoints
        for i, ch in enumerate((title or 'G')[:10]):
            ang = (ord(ch) * 13 + seed) % 360
            rad = short * (0.1 + (ord(ch) % 5) * 0.04)
            px = int(cx + math.cos(math.radians(ang)) * rad)
            py = int(cy + math.sin(math.radians(ang)) * rad)
            rr = max(3, short // 40 + (ord(ch) % 4))
            draw.ellipse([px - rr, py - rr, px + rr, py + rr], outline=accent if i % 2 else secondary, width=stroke)
    else:
        # Triangular shards
        for i in range(5):
            ang = (seed + i * 72) % 360
            rad = short * 0.22
            px = int(cx + math.cos(math.radians(ang)) * rad)
            py = int(cy + math.sin(math.radians(ang)) * rad)
            s = max(8, short // 18)
            draw.polygon(
                [
                    (px, py - s),
                    (px + int(s * 0.9), py + s // 2),
                    (px - int(s * 0.9), py + s // 2),
                ],
                outline=_mix_rgb(accent, secondary, i / 5),
                width=stroke,
            )


def _wrap_title(title: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = title.split()
    if not words:
        return ['GameTheca']
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f'{current} {word}'
        bbox = font.getbbox(trial)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines[:4]


def _fit_title_font(
    headline: str,
    max_width: int,
    min_size: int,
    max_size: int,
    max_lines: int = 4,
) -> ImageFont.ImageFont:
    """Pick the largest font that keeps the title readable at tile size.

    Allows 4 lines rather than 3: a long title forced into 3 lines shrinks the
    type far below the legibility floor, which is worse than one extra line.
    """
    size = max_size
    while size >= min_size:
        font = _load_font(size)
        lines = _wrap_title(headline, font, max_width)
        widest = max((font.getbbox(line)[2] - font.getbbox(line)[0]) for line in lines)
        if widest <= max_width and len(lines) <= max_lines:
            return font
        size -= 1
    return _load_font(min_size)


def _draw_title_block(
    draw: ImageDraw.ImageDraw,
    width: int,
    height: int,
    *,
    headline: str,
    subtitle: str,
    accent: tuple[int, int, int],
    secondary: tuple[int, int, int],
    variant: str,
    is_wide: bool,
    is_square: bool,
    title_scale: float = 1.0,
) -> None:
    """Readable title treatment — hero-sized type, not a tiny subtitle caption."""
    # Floor scales with the canvas. A flat 14px was ~2.7% of a 512px cover, which
    # renders illegibly once the tile is scaled down; ~1/14 of the short edge
    # keeps the title readable at browse size.
    short_edge = min(width, height)
    min_title = max(20, short_edge // 14) if short_edge >= 200 else max(12, short_edge // 12)
    if is_wide:
        max_title = max(min_title, height // 7)
        pad = max(16, width // 16)
        max_text_w = int(width * 0.55)
        text_left = int(width * 0.40)
        y_anchor = 0.42
    elif is_square:
        max_title = max(min_title, min(width, height) // 9)
        pad = max(10, min(width, height) // 12)
        max_text_w = width - pad * 2
        text_left = None
        y_anchor = 0.62
    else:
        # Portrait covers get the largest treatment — this is the shape the
        # library grid actually renders, so it carries the legibility burden.
        max_title = max(min_title, min(width, height) // 6)
        pad = max(10, min(width, height) // 12)
        max_text_w = width - pad * 2
        text_left = None
        y_anchor = 0.58

    # Operator scaling, clamped: below ~0.6 the type drops under the legibility
    # floor this function exists to defend, and above 2x it overruns the canvas.
    try:
        scale = min(max(float(title_scale or 1.0), 0.6), 2.0)
    except (TypeError, ValueError):
        scale = 1.0
    if scale != 1.0:
        min_title = max(10, int(min_title * scale))
        max_title = max(min_title, int(max_title * scale))

    title_font = _fit_title_font(headline, max_text_w, min_title, max_title)
    try:
        sub_size = max(11, int(getattr(title_font, 'size', max_title) * 0.42))
    except (TypeError, ValueError):
        sub_size = 11
    sub_font = _load_font(sub_size)

    lines = _wrap_title(headline, title_font, max_text_w)
    line_heights = [title_font.getbbox(line)[3] - title_font.getbbox(line)[1] for line in lines]
    block_h = sum(line_heights) + (len(lines) - 1) * 4
    sub_bbox = sub_font.getbbox(subtitle)
    sub_h = sub_bbox[3] - sub_bbox[1]
    total_h = block_h + sub_h + 14
    y = int(height * y_anchor) - total_h // 2

    # Accent rule above title block
    rule_w = min(max_text_w, max(40, width // 4))
    if text_left is not None:
        rule_x = text_left
    else:
        rule_x = (width - rule_w) // 2
    draw.rectangle([rule_x, y - 10, rule_x + rule_w, y - 6], fill=accent)
    draw.rectangle([rule_x, y - 5, rule_x + rule_w // 3, y - 3], fill=secondary)

    for line, lh in zip(lines, line_heights):
        bbox = title_font.getbbox(line)
        tw = bbox[2] - bbox[0]
        if text_left is not None:
            x = text_left
        else:
            x = (width - tw) // 2
        draw.text((x + 1, y + 1), line, fill=(0, 0, 0), font=title_font)
        draw.text((x, y), line, fill=GT_TEXT, font=title_font)
        y += lh + 4

    sw = sub_bbox[2] - sub_bbox[0]
    if text_left is not None:
        sx = text_left
    else:
        sx = (width - sw) // 2
    draw.text((sx, y + 8), subtitle, fill=accent, font=sub_font)


def render_cover_art(
    width: int,
    height: int,
    *,
    title: str | None = None,
    system: str | None = None,
    variant: str = 'tile',
    artistic: bool = True,
    motif: str | None = None,
    palette_override: SystemPalette | None = None,
    headline_override: str | None = None,
    subtitle_override: str | None = None,
    title_scale: float = 1.0,
) -> Image.Image:
    """Render a branded placeholder/cover at the given size with per-system templates.

    When ``title`` is set and ``artistic`` is True (default), composition reflects
    the title via letterform watermark, seed-derived motif, and secondary accent.
    Empty titles still get intentional GameTheca branding (not an empty box).

    ``motif`` selects an optional stock geometry overlay (controller, crt_grid, …).
    ``palette_override`` bypasses system template lookup (used by stock packs).
    """
    title = (title or '').strip()
    system = (system or '').strip()
    variant = (variant or 'tile').strip().lower()
    motif = (motif or '').strip().lower() or None
    if variant not in ('tile', 'wide', 'square', 'hero'):
        if width == height:
            variant = 'square'
        elif width >= height and width / max(height, 1) >= 1.5:
            variant = 'wide'
        else:
            variant = 'tile'

    is_wide = variant in ('wide', 'hero') or (width >= height and width / max(height, 1) >= 1.5)
    is_square = variant == 'square' or width == height

    if palette_override is not None:
        top, bottom, accent, glyph = palette_override
    else:
        top, bottom, accent, glyph = resolve_system_template(system)
    seed_key = title if title else f'gametheca::{system or motif or "default"}::{variant}'
    seed = _title_seed(seed_key)
    secondary = _title_secondary_accent(seed, accent) if artistic else accent

    img = _vertical_gradient(width, height, top=top, bottom=bottom)
    draw = ImageDraw.Draw(img)

    if artistic:
        _paint_artistic_backdrop(
            img,
            top=top,
            bottom=bottom,
            accent=accent,
            secondary=secondary,
            seed=seed,
            variant=variant if not is_wide else ('hero' if variant == 'hero' else 'wide'),
        )
        draw = ImageDraw.Draw(img)
        if motif:
            _draw_stock_geometry(
                draw,
                width,
                height,
                motif=motif,
                accent=accent,
                secondary=secondary,
                seed=seed,
                variant=variant if not is_wide else ('hero' if variant == 'hero' else 'wide'),
            )
        _draw_title_motif(
            draw,
            width,
            height,
            title=title or 'GameTheca',
            seed=seed,
            accent=accent,
            secondary=secondary,
            variant=variant if not is_wide else ('hero' if variant == 'hero' else 'wide'),
        )
        frame_variant = (
            'hero' if variant == 'hero'
            else 'wide' if is_wide
            else 'square' if is_square
            else 'tile'
        )
        _draw_bezel_frame(
            draw,
            width,
            height,
            accent,
            secondary,
            variant=frame_variant,
            seed=seed,
        )
        _maybe_scanlines(img, glyph if not motif else 'cart', seed)
        draw = ImageDraw.Draw(img)
    else:
        accent_h = max(4, height // 64)
        draw.rectangle([0, 0, width, accent_h], fill=accent)
        draw.rectangle([0, height - accent_h, width, height], fill=accent)
        inset = max(8, min(width, height) // 16)
        draw.rectangle(
            [inset, inset + accent_h, width - inset, height - inset - accent_h],
            outline=_lerp_color(accent, (255, 255, 255), 0.35),
            width=max(1, min(width, height) // 200),
        )

    # System glyph — corner/side for titled art so it doesn't fight the monogram
    mark_scale = min(width, height) / (320 if artistic and title else 280)
    if artistic and title:
        if is_wide:
            gx, gy = int(width * 0.88), int(height * 0.22)
        elif is_square:
            gx, gy = width // 2, int(height * 0.42)
        else:
            gx, gy = int(width * 0.82), int(height * 0.22)
    else:
        gx = width // 2
        gy = int(height * (0.26 if not is_wide else 0.32))
    if not motif:
        _draw_system_glyph(draw, gx, gy, mark_scale, glyph, accent)

    if not title:
        headline = 'GameTheca'
        if is_wide:
            subtitle = system or 'Library'
        else:
            subtitle = system or 'Vault cover'
    else:
        headline = title
        subtitle = system or ('Stock' if motif else 'GameTheca')

    # FEAT-D4: the operator can override the derived text. An explicit empty
    # subtitle means "no subtitle", which is different from "not supplied" —
    # hence the `is not None` check rather than a truthiness test.
    if headline_override is not None and str(headline_override).strip():
        headline = str(headline_override).strip()
    if subtitle_override is not None:
        subtitle = str(subtitle_override).strip()

    _draw_title_block(
        draw,
        width,
        height,
        headline=headline,
        subtitle=subtitle,
        title_scale=title_scale,
        accent=accent,
        secondary=secondary,
        variant=variant,
        is_wide=is_wide,
        is_square=is_square,
    )

    if is_wide:
        rail = max(3, height // 72)
        bar_w = int(width * 0.35)
        draw.rectangle([0, height - rail * 2, bar_w, height], fill=_mix_rgb(top, accent, 0.4))

    return img


def _draw_stock_geometry(
    draw: ImageDraw.ImageDraw,
    width: int,
    height: int,
    *,
    motif: str,
    accent: tuple[int, int, int],
    secondary: tuple[int, int, int],
    seed: int,
    variant: str,
) -> None:
    """Original abstract gaming geometry for stock packs (not scraped box art)."""
    short = min(width, height)
    stroke = max(2, short // 90)
    cx = width // 2 if variant not in ('wide', 'hero') else int(width * 0.28)
    cy = int(height * (0.36 if variant not in ('wide', 'hero') else 0.45))

    if motif == 'controller':
        s = short / 280
        draw.rounded_rectangle(
            [cx - 50 * s, cy - 22 * s, cx + 50 * s, cy + 22 * s],
            radius=int(14 * s), outline=accent, width=stroke + 1,
        )
        draw.ellipse([cx - 38 * s, cy - 8 * s, cx - 22 * s, cy + 8 * s], outline=secondary, width=stroke)
        draw.ellipse([cx + 18 * s, cy - 10 * s, cx + 28 * s, cy], fill=accent)
        draw.ellipse([cx + 28 * s, cy, cx + 38 * s, cy + 10 * s], fill=secondary)
        draw.rectangle([cx - 4 * s, cy - 28 * s, cx + 4 * s, cy - 18 * s], fill=accent)
    elif motif == 'cartridge':
        s = short / 260
        draw.rounded_rectangle(
            [cx - 36 * s, cy - 48 * s, cx + 36 * s, cy + 48 * s],
            radius=int(6 * s), outline=accent, width=stroke + 1,
        )
        draw.rectangle([cx - 22 * s, cy - 56 * s, cx + 22 * s, cy - 42 * s], fill=secondary)
        for i in range(3):
            y = cy - 20 * s + i * 18 * s
            draw.line([cx - 22 * s, y, cx + 22 * s, y], fill=accent, width=stroke)
    elif motif == 'disc_ring':
        for i, r_mul in enumerate((0.28, 0.20, 0.12, 0.04)):
            r = short * r_mul
            col = accent if i % 2 == 0 else secondary
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=stroke)
        draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=accent)
    elif motif == 'crt_grid':
        step = max(10, short // 14)
        for x in range(0, width, step):
            draw.line([(x, 0), (x, height)], fill=_mix_rgb(accent, secondary, 0.3), width=1)
        for y in range(0, height, step):
            draw.line([(0, y), (width, y)], fill=_mix_rgb(secondary, accent, 0.25), width=1)
        draw.rectangle(
            [cx - short // 4, cy - short // 5, cx + short // 4, cy + short // 5],
            outline=accent, width=stroke,
        )
    elif motif == 'neon_court':
        pad = short // 8
        draw.rectangle([pad, pad, width - pad, height - pad], outline=accent, width=stroke)
        draw.line([(width // 2, pad), (width // 2, height - pad)], fill=secondary, width=stroke)
        draw.ellipse(
            [width // 2 - short // 8, height // 2 - short // 8, width // 2 + short // 8, height // 2 + short // 8],
            outline=accent, width=stroke,
        )
        draw.arc([pad, height // 2 - short // 5, pad + short // 3, height // 2 + short // 5], 270, 90, fill=secondary, width=stroke)
        draw.arc([width - pad - short // 3, height // 2 - short // 5, width - pad, height // 2 + short // 5], 90, 270, fill=secondary, width=stroke)
    elif motif == 'dpad':
        s = short / 240
        arm = 18 * s
        thick = 14 * s
        draw.rectangle([cx - thick, cy - arm * 2, cx + thick, cy + arm * 2], fill=accent)
        draw.rectangle([cx - arm * 2, cy - thick, cx + arm * 2, cy + thick], fill=accent)
        draw.rectangle([cx - thick // 2, cy - thick // 2, cx + thick // 2, cy + thick // 2], fill=secondary)
    elif motif == 'circuit':
        for i in range(6):
            y = int(height * (0.2 + i * 0.1))
            x0 = int(width * (0.1 + ((seed >> i) & 7) * 0.05))
            x1 = int(width * (0.55 + ((seed >> (i + 2)) & 7) * 0.05))
            draw.line([(x0, y), (x1, y)], fill=accent if i % 2 == 0 else secondary, width=stroke)
            draw.ellipse([x1 - 4, y - 4, x1 + 4, y + 4], fill=accent)
            if i % 2:
                draw.line([(x1, y), (x1, y + int(height * 0.08))], fill=secondary, width=stroke)
    elif motif == 'pixel_burst':
        cell = max(6, short // 20)
        for i in range(24):
            ox = cx + ((seed >> (i % 8)) % 11 - 5) * cell
            oy = cy + ((seed >> ((i + 3) % 8)) % 11 - 5) * cell
            col = accent if i % 2 == 0 else secondary
            draw.rectangle([ox, oy, ox + cell - 1, oy + cell - 1], fill=col)
    elif motif == 'joystick':
        s = short / 260
        draw.ellipse([cx - 14 * s, cy - 48 * s, cx + 14 * s, cy - 20 * s], fill=accent)
        draw.rectangle([cx - 4 * s, cy - 20 * s, cx + 4 * s, cy + 20 * s], fill=secondary)
        draw.ellipse([cx - 36 * s, cy + 16 * s, cx + 36 * s, cy + 48 * s], outline=accent, width=stroke)
        draw.ellipse([cx - 10 * s, cy + 28 * s, cx + 10 * s, cy + 40 * s], fill=secondary)
    elif motif == 'hex_lattice':
        r = max(12, short // 12)
        for row in range(-2, 3):
            for col in range(-2, 3):
                hx = cx + col * int(r * 1.75) + (row % 2) * int(r * 0.875)
                hy = cy + row * int(r * 1.5)
                pts = [
                    (hx + int(r * math.cos(math.radians(a))), hy + int(r * math.sin(math.radians(a))))
                    for a in range(0, 360, 60)
                ]
                draw.polygon(pts, outline=accent if (row + col) % 2 == 0 else secondary)
    elif motif == 'waveform':
        pts = []
        amp = short // 6
        for x in range(0, width, max(4, width // 80)):
            t = x / max(width - 1, 1)
            y = cy + int(math.sin(t * math.pi * 4 + (seed % 7)) * amp * (0.6 + 0.4 * math.sin(t * math.pi)))
            pts.append((x, y))
        if len(pts) > 1:
            draw.line(pts, fill=accent, width=stroke + 1)
        pts2 = [(x, cy * 2 - y) for x, y in pts]
        if len(pts2) > 1:
            draw.line(pts2, fill=secondary, width=stroke)
    else:
        # vault_mark / default abstract
        s = short / 280
        _draw_mark(draw, cx, cy, s * 1.4, accent=accent)
        draw.arc([cx - 40 * s, cy - 40 * s, cx + 40 * s, cy + 40 * s], 40, 300, fill=secondary, width=stroke)


def _image_to_bytes(img: Image.Image, fmt: str) -> bytes:
    buf = io.BytesIO()
    if fmt == 'jpg':
        rgb = img.convert('RGB')
        rgb.save(buf, format='JPEG', quality=90, optimize=True)
    elif fmt == 'webp':
        img.save(buf, format='WEBP', quality=88, method=4)
    else:
        img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def generate_size_matrix(
    title: str,
    *,
    system: str | None = None,
    fmt: str = 'webp',
) -> dict[str, bytes]:
    """Generate all UI sizes for one title."""
    fmt = (fmt or 'webp').lower()
    if fmt not in ('webp', 'png'):
        fmt = 'webp'
    out: dict[str, bytes] = {}
    for prefix, w, h in SIZE_MATRIX:
        variant = prefix
        img = render_cover_art(w, h, title=title, system=system, variant=variant)
        name = _filename_for(prefix, w, h, fmt)
        out[name] = _image_to_bytes(img, fmt)
    return out


def safe_pack_dir(pack_id: str, package_root: str | Path | None = None) -> Path:
    if not pack_id or not SAFE_PACK_ID.match(pack_id):
        raise ValueError('Invalid pack id')
    root = generated_root(package_root).resolve()
    target = (root / pack_id).resolve()
    if os.path.commonpath([str(root), str(target)]) != str(root):
        raise ValueError('Path traversal blocked')
    return target


def safe_stock_dir(pack_id: str, package_root: str | Path | None = None) -> Path:
    if not pack_id or not SAFE_PACK_ID.match(pack_id):
        raise ValueError('Invalid pack id')
    root = stock_root(package_root).resolve()
    target = (root / pack_id).resolve()
    if os.path.commonpath([str(root), str(target)]) != str(root):
        raise ValueError('Path traversal blocked')
    return target


def resolve_pack_dir(pack_id: str, package_root: str | Path | None = None) -> Path:
    """Resolve a pack under stock/ (preferred for stock-/platform- ids) or generated/."""
    if not pack_id or not SAFE_PACK_ID.match(pack_id):
        raise ValueError('Invalid pack id')
    stock = safe_stock_dir(pack_id, package_root)
    generated = safe_pack_dir(pack_id, package_root)
    stock_ready = stock.is_dir() and any(stock.glob('tile_*'))
    gen_ready = generated.is_dir() and any(generated.glob('tile_*'))
    if pack_id.startswith(('stock-', 'platform-')):
        if stock_ready:
            return stock
        if gen_ready:
            return generated
        return stock
    if gen_ready:
        return generated
    if stock_ready:
        return stock
    return generated


def safe_pack_file(pack_id: str, filename: str, package_root: str | Path | None = None) -> Path:
    if filename not in KNOWN_FILENAMES:
        raise ValueError('Unknown art filename')
    pack_dir = resolve_pack_dir(pack_id, package_root)
    path = (pack_dir / secure_filename(filename)).resolve()
    if os.path.commonpath([str(pack_dir.resolve()), str(path)]) != str(pack_dir.resolve()):
        raise ValueError('Path traversal blocked')
    return path


def save_pack(
    title: str,
    *,
    system: str | None = None,
    fmt: str = 'webp',
    pack_id: str | None = None,
    package_root: str | Path | None = None,
) -> dict[str, Any]:
    pack_id = pack_id or uuid.uuid4().hex[:12]
    pack_dir = safe_pack_dir(pack_id, package_root)
    pack_dir.mkdir(parents=True, exist_ok=True)
    files = generate_size_matrix(title, system=system, fmt=fmt)
    written: list[str] = []
    for name, data in files.items():
        dest = pack_dir / name
        dest.write_bytes(data)
        written.append(name)
    manifest = {
        'pack_id': pack_id,
        'title': title,
        'system': system or '',
        'format': fmt,
        'files': written,
    }
    (pack_dir / 'manifest.json').write_text(
        __import__('json').dumps(manifest, indent=2) + '\n',
        encoding='utf-8',
    )
    return manifest


def pack_preview_url(pack_id: str, filename: str = 'tile_400x600.webp') -> str:
    return url_for('static', filename=f'library/generated/{pack_id}/{filename}')


def build_zip_bytes(pack_id: str, package_root: str | Path | None = None) -> bytes:
    pack_dir = resolve_pack_dir(pack_id, package_root)
    if not pack_dir.is_dir():
        raise FileNotFoundError('Pack not found')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(pack_dir.iterdir()):
            if path.is_file():
                zf.write(path, arcname=f'{pack_id}/{path.name}')
    return buf.getvalue()


def _pick_cover_file(pack_dir: Path, fmt: str) -> Path:
    for name in (f'tile_600x900.{fmt}', f'tile_400x600.{fmt}', f'tile_200x300.{fmt}'):
        candidate = pack_dir / name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError('No tile art in pack')


def _pick_library_file(pack_dir: Path, fmt: str) -> Path:
    for name in (f'wide_1920x1080.{fmt}', f'hero_1280x720.{fmt}', f'wide_960x540.{fmt}'):
        candidate = pack_dir / name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError('No wide art in pack')


def apply_pack_to_game(
    pack_id: str,
    game_uuid: str,
    *,
    filename: str | None = None,
    package_root: str | Path | None = None,
) -> dict[str, Any]:
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        raise LookupError('Game not found')
    pack_dir = resolve_pack_dir(pack_id, package_root)
    if not pack_dir.is_dir() or not any(pack_dir.glob('tile_*')):
        raise FileNotFoundError('Pack not found')
    if filename:
        src = safe_pack_file(pack_id, filename, package_root)
    else:
        fmt = 'webp'
        manifest_path = pack_dir / 'manifest.json'
        if manifest_path.is_file():
            import json

            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            fmt = (manifest.get('format') or 'webp').lower()
        src = _pick_cover_file(pack_dir, fmt)
    ext = src.suffix.lower() or '.webp'
    file_name = secure_filename(f'{game_uuid}_cover_studio_{uuid.uuid4().hex[:10]}{ext}')
    save_dir = current_app.config['IMAGE_SAVE_PATH']
    os.makedirs(save_dir, exist_ok=True)
    dest = os.path.join(save_dir, file_name)
    dest_path = Path(dest).resolve()
    save_root = Path(save_dir).resolve()
    if os.path.commonpath([str(save_root), str(dest_path)]) != str(save_root):
        raise ValueError('Path traversal blocked')
    dest_path.write_bytes(src.read_bytes())

    existing = db.session.execute(
        select(GameImage).filter_by(game_uuid=game_uuid, image_type='cover')
    ).scalars().all()
    for row in existing:
        db.session.delete(row)

    image = GameImage(
        game_uuid=game_uuid,
        image_type='cover',
        url=file_name,
        download_url='',
        is_downloaded=True,
    )
    db.session.add(image)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        # The file already landed on disk; remove it so we don't leak an
        # orphaned image with no matching database row.
        try:
            dest_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise
    return {
        'game_uuid': game_uuid,
        'pack_id': pack_id,
        'filename': file_name,
        'cover_url': url_for('static', filename=f'library/images/{file_name}'),
    }


def apply_pack_as_fallback(
    pack_id: str,
    *,
    package_root: str | Path | None = None,
) -> dict[str, str]:
    pack_dir = resolve_pack_dir(pack_id, package_root)
    if not pack_dir.is_dir() or not any(pack_dir.glob('tile_*')):
        raise FileNotFoundError('Pack not found')
    fmt = 'webp'
    manifest_path = pack_dir / 'manifest.json'
    if manifest_path.is_file():
        import json

        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        fmt = (manifest.get('format') or 'webp').lower()
    cover_src = _pick_cover_file(pack_dir, fmt)
    library_src = _pick_library_file(pack_dir, fmt)
    ns_root = newstyle_root(package_root)
    ns_root.mkdir(parents=True, exist_ok=True)
    cover_img = Image.open(cover_src).convert('RGB')
    library_img = Image.open(library_src).convert('RGB')
    cover_dest = ns_root / 'default_cover.jpg'
    library_dest = ns_root / 'default_library.jpg'
    cover_img.save(cover_dest, format='JPEG', quality=90, optimize=True)
    library_img.save(library_dest, format='JPEG', quality=90, optimize=True)
    return {
        'default_cover': str(cover_dest),
        'default_library': str(library_dest),
        'pack_id': pack_id,
    }


def bake_default_fallbacks(package_root: str | Path | None = None) -> dict[str, str]:
    """Write branded default_cover.jpg / default_library.jpg (artistic empty-title pack).

    Blanks use intentional GameTheca composition (mark, geometric frame, aurora
    field) — regenerable via Admin Art Studio "Set as fallback pack" as well.
    """
    ns_root = newstyle_root(package_root)
    ns_root.mkdir(parents=True, exist_ok=True)
    cover = render_cover_art(600, 900, title='', system='', variant='tile', artistic=True)
    library = render_cover_art(1920, 1080, title='', system='', variant='wide', artistic=True)
    large = render_cover_art(1920, 1080, title='', system='', variant='hero', artistic=True)
    cover_path = ns_root / 'default_cover.jpg'
    library_path = ns_root / 'default_library.jpg'
    large_path = ns_root / 'default_library_large.jpg'
    cover.save(cover_path, format='JPEG', quality=90, optimize=True)
    library.save(library_path, format='JPEG', quality=90, optimize=True)
    large.save(large_path, format='JPEG', quality=90, optimize=True)
    return {
        'default_cover': str(cover_path),
        'default_library': str(library_path),
        'default_library_large': str(large_path),
    }
