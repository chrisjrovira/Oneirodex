"""Pillow painters for the procedural cover renderer: backdrops, art
directions, bezels, scanlines, system glyphs, era scenery, stock geometry.

Split out of ``cover_art_studio`` in the v11 cycle (H-D.4) as a pure move.
Nothing here touches Flask, the database or the filesystem; every function
takes an ``ImageDraw`` (or an ``Image``) and a seed.
"""
from __future__ import annotations

import hashlib
import math
import os
import re

from PIL import Image, ImageDraw, ImageFont
from oneirodex.utils.cover_art_tokens import OD_SURFACE
from oneirodex.utils.cover_art_tokens import OD_BG
from oneirodex.utils.cover_art_tokens import OD_ACCENT
from oneirodex.utils.cover_art_tokens import OD_TEXT
from oneirodex.utils.cover_art_tokens import ERA_ART



_FONT_CANDIDATES = (
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'C:/Windows/Fonts/segoeuib.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
)


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
    top: tuple[int, int, int] = OD_SURFACE,
    bottom: tuple[int, int, int] = OD_BG,
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


#: Composition archetypes, all drawn from console/arcade hardware (GT-B28).
#:
#: The generator used to run one fixed sequence for every cover — gradient,
#: bands, orbs, bezel, centred initials — so only the palette changed between
#: titles and every image read as the same picture in a different colour. The
#: variety has to be *structural*: where the title sits, what furniture is on
#: the canvas, whether there is a frame at all.
ART_DIRECTIONS = ('cartridge', 'marquee', 'crt', 'pixel', 'boxart', 'neon')


def pick_art_direction(seed: int) -> str:
    """Stable per title, so a cover does not change when it is regenerated."""
    return ART_DIRECTIONS[seed % len(ART_DIRECTIONS)]


def _paint_art_direction(
    img: 'Image.Image',
    *,
    direction: str,
    accent: tuple[int, int, int],
    secondary: tuple[int, int, int],
    top: tuple[int, int, int],
    bottom: tuple[int, int, int],
    seed: int,
) -> None:
    """Draw the direction's gaming furniture.

    Each one owns a different region of the canvas, which is what stops the
    results converging: a cartridge label sits high, a marquee spans the top
    edge, a boxart banner claims the bottom third.
    """
    width, height = img.size
    draw = ImageDraw.Draw(img)
    unit = max(2, min(width, height) // 64)

    if direction == 'cartridge':
        # Label plate inset from a cartridge shoulder — title lands on the plate.
        shoulder = int(width * 0.12)
        plate = [shoulder, int(height * 0.16), width - shoulder, int(height * 0.52)]
        draw.rectangle(plate, fill=_mix_rgb(top, secondary, 0.35))
        draw.rectangle(plate, outline=accent, width=unit)
        for i in range(3):
            y = int(height * 0.60) + i * unit * 3
            draw.rectangle(
                [shoulder + unit * 2, y, width - shoulder - unit * 2, y + unit],
                fill=_mix_rgb(accent, bottom, 0.45 + i * 0.12),
            )

    elif direction == 'marquee':
        # Arcade marquee band across the top, lamps under it.
        band = int(height * 0.22)
        draw.rectangle([0, 0, width, band], fill=_mix_rgb(accent, top, 0.25))
        draw.rectangle([0, band, width, band + unit], fill=secondary)
        lamps = 6 + (seed % 5)
        for i in range(lamps):
            cx = int(width * (i + 0.5) / lamps)
            r = unit
            draw.ellipse(
                [cx - r, band + unit * 3 - r, cx + r, band + unit * 3 + r],
                fill=_mix_rgb(secondary, top, 0.2),
            )

    elif direction == 'crt':
        # Rounded tube vignette — corners darkened toward the shell.
        inset = int(min(width, height) * 0.06)
        draw.rounded_rectangle(
            [inset, inset, width - inset, height - inset],
            radius=int(min(width, height) * 0.09),
            outline=_mix_rgb(bottom, accent, 0.3),
            width=unit * 3,
        )
        for step in range(inset):
            t = step / max(inset - 1, 1)
            shade = _mix_rgb(bottom, top, 0.15 + t * 0.5)
            draw.rectangle([step, step, width - step, height - step], outline=shade)

    elif direction == 'pixel':
        # Chunky mosaic across the lower half — reads as sprite work at a glance.
        cell = max(6, min(width, height) // 18)
        for gx in range(0, width, cell):
            for gy in range(int(height * 0.45), height, cell):
                bit = (seed >> ((gx // cell + gy // cell) % 24)) & 0x3
                if bit == 0:
                    continue
                tone = _mix_rgb(accent if bit == 1 else secondary, bottom, 0.35 + bit * 0.12)
                draw.rectangle([gx, gy, gx + cell - 1, gy + cell - 1], fill=tone)

    elif direction == 'boxart':
        # Publisher banner bottom, spine stripe left — classic retail box.
        banner = int(height * 0.68)
        draw.rectangle([0, banner, width, height], fill=_mix_rgb(bottom, secondary, 0.4))
        draw.rectangle([0, banner, width, banner + unit], fill=accent)
        spine = int(width * 0.07)
        draw.rectangle([0, 0, spine, height], fill=_mix_rgb(accent, bottom, 0.55))

    elif direction == 'neon':
        # Synthwave horizon: perspective grid below a sun disc.
        horizon = int(height * 0.62)
        draw.ellipse(
            [int(width * 0.28), horizon - int(height * 0.30),
             int(width * 0.72), horizon + int(height * 0.06)],
            fill=_mix_rgb(accent, top, 0.3),
        )
        draw.rectangle([0, horizon, width, height], fill=_mix_rgb(bottom, secondary, 0.55))
        lines = 8
        for i in range(1, lines + 1):
            y = horizon + int((height - horizon) * (i / lines) ** 1.8)
            draw.line([(0, y), (width, y)], fill=_mix_rgb(accent, bottom, 0.5), width=1)
        for i in range(-6, 7):
            x = width // 2 + i * (width // 8)
            draw.line([(width // 2, horizon), (x, height)],
                      fill=_mix_rgb(secondary, bottom, 0.55), width=1)


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


def _draw_mark(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float, accent=OD_ACCENT) -> None:
    """Minimal Oneirodex controller mark (matches oneirodex_mark.svg)."""
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
    draw.ellipse([cx + 8 * s - 2 * s, cy - 5 * s, cx + 8 * s + 2 * s, cy - 1 * s], fill=OD_TEXT)
    draw.ellipse([cx + 13 * s - 2 * s, cy, cx + 13 * s + 2 * s, cy + 4 * s], fill=OD_TEXT)
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
        draw.rectangle([cx - 8 * s, cy - 14 * s, cx + 8 * s, cy + 14 * s], outline=OD_TEXT, width=max(1, w - 1))
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


def _paint_era_scenery(
    img: Image.Image,
    *,
    era: str,
    accent: tuple[int, int, int],
    seed: int,
) -> None:
    """Draw era-room scenery onto a cover: wood, posters, carpet, marquee, desk.

    Original geometry only — the same idea as css/od-era.css, in pixels so
    placeholder tiles follow the active decade theme.
    """
    meta = ERA_ART.get(era)
    if not meta:
        return
    width, height = img.size
    draw = ImageDraw.Draw(img)
    kind = meta['kind']
    secondary = _mix_rgb(accent, (255, 255, 255), 0.25)
    plank = max(6, width // 18)

    if kind == 'wood':
        for x in range(0, width, plank):
            col = _mix_rgb(accent, (40, 24, 12), 0.15 + ((x + seed) % 5) * 0.05)
            draw.rectangle([x, 0, x + max(2, plank // 4), height], fill=col)
        wx, wy = int(width * 0.72), int(height * 0.08)
        ww, wh = int(width * 0.18), int(height * 0.22)
        draw.rectangle([wx, wy, wx + ww, wy + wh], fill=(240, 200, 120))
        draw.rectangle([wx, wy, wx + ww, wy + wh], outline=(74, 48, 24), width=max(2, width // 80))
    elif kind == 'posters':
        posters = (
            (0.06, 0.10, 0.12, 0.20, (196, 92, 106)),
            (0.20, 0.06, 0.10, 0.22, (58, 106, 154)),
            (0.32, 0.14, 0.08, 0.16, (212, 176, 74)),
            (0.10, 0.34, 0.11, 0.14, (74, 138, 98)),
        )
        for px, py, pw, ph, col in posters:
            x0, y0 = int(width * px), int(height * py)
            draw.rectangle(
                [x0, y0, x0 + int(width * pw), y0 + int(height * ph)],
                fill=col,
                outline=_mix_rgb(col, (0, 0, 0), 0.35),
            )
        wx, wy = int(width * 0.74), int(height * 0.07)
        ww, wh = int(width * 0.16), int(height * 0.26)
        draw.rectangle([wx, wy, wx + ww, wy + wh], fill=(142, 200, 255))
        draw.rectangle([wx, wy, wx + ww, wy + wh], outline=(90, 58, 40), width=max(2, width // 70))
    elif kind == 'carpet':
        band = max(8, width // 14)
        floor_y = int(height * 0.58)
        for x in range(0, width, band):
            col = (90, 40, 50) if (x // band + seed) % 2 else (40, 20, 30)
            draw.rectangle([x, floor_y, x + band, height], fill=_mix_rgb(col, accent, 0.15))
        x0, y0 = int(width * 0.08), int(height * 0.12)
        draw.rectangle(
            [x0, y0, x0 + int(width * 0.14), y0 + int(height * 0.22)],
            fill=(42, 74, 138),
        )
    elif kind == 'media':
        wx, wy = int(width * 0.76), int(height * 0.10)
        ww, wh = int(width * 0.14), int(height * 0.24)
        draw.rectangle([wx, wy, wx + ww, wy + wh], fill=(26, 56, 96))
        draw.rectangle([wx, wy, wx + ww, wy + wh], outline=(26, 36, 56), width=max(2, width // 90))
        stand_y = int(height * 0.72)
        draw.rectangle([int(width * 0.12), stand_y, int(width * 0.88), height], fill=(18, 24, 36))
    elif kind == 'marquee':
        draw.rectangle([0, 0, width, max(8, height // 10)], fill=accent)
        glow = _mix_rgb(accent, (37, 224, 255), 0.45)
        draw.ellipse(
            [int(width * 0.2), -int(height * 0.1), int(width * 0.8), int(height * 0.18)],
            fill=glow,
        )
    elif kind == 'phosphor':
        for y in range(0, height, max(3, height // 48)):
            draw.line([(0, y), (width, y)], fill=_mix_rgb(accent, (0, 0, 0), 0.75))
        wx, wy = int(width * 0.70), int(height * 0.08)
        ww, wh = int(width * 0.18), int(height * 0.20)
        draw.rectangle([wx, wy, wx + ww, wy + wh], fill=(200, 220, 232))
        draw.rectangle([wx, wy, wx + ww, wy + wh], outline=(74, 80, 72), width=max(2, width // 80))
    else:
        return

    # Floor band so every era cover has a "room" rather than a floating slab.
    floor_h = max(12, height // 5)
    for i in range(floor_h):
        t = i / max(floor_h - 1, 1)
        col = _mix_rgb(meta['bottom'], (0, 0, 0), 0.2 + t * 0.4)
        draw.line([(0, height - floor_h + i), (width, height - floor_h + i)], fill=col)
    _ = secondary, seed


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
