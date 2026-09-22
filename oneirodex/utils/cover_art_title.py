"""Title typography for the procedural cover renderer: motif, wrapping,
font fitting and the title block.

Split out of ``cover_art_studio`` in the v11 cycle (H-D.4) as a pure move.
"""
from __future__ import annotations

import math

from PIL import ImageDraw, ImageFont
from oneirodex.utils.cover_art_paint import _title_initials
from oneirodex.utils.cover_art_paint import _load_font
from oneirodex.utils.cover_art_paint import _mix_rgb
from oneirodex.utils.cover_art_tokens import OD_TEXT
from oneirodex.utils.cover_art_tokens import DEFAULT_TITLE_SCALE
from oneirodex.utils.cover_art_tokens import clamp_title_scale



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
    draw.text((mx, my), initials, fill=_mix_rgb(ghost, OD_TEXT, 0.25), font=mono_font)

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
        return ['Oneirodex']
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


def _fit_subtitle_font(
    subtitle: str,
    max_width: int,
    preferred_size: int,
    min_size: int = 9,
) -> ImageFont.ImageFont:
    """Largest subtitle font that still fits on one line.

    The subtitle is a single unwrapped line, so unlike the title it has no way
    to absorb overflow — without this it simply runs off both edges of the
    canvas. Long platform names ("Nintendo Entertainment System (NES)") are the
    normal case here, not an edge case.
    """
    if not subtitle:
        return _load_font(preferred_size)
    size = max(preferred_size, min_size)
    while size > min_size:
        font = _load_font(size)
        bbox = font.getbbox(subtitle)
        if (bbox[2] - bbox[0]) <= max_width:
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
    title_scale: float = DEFAULT_TITLE_SCALE,
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

    # Operator scaling, clamped: below TITLE_SCALE_MIN the type drops under the
    # legibility floor this function exists to defend, and above 2x it overruns
    # the canvas.
    scale = clamp_title_scale(title_scale)
    if scale != 1.0:
        min_title = max(10, int(min_title * scale))
        max_title = max(min_title, int(max_title * scale))

    title_font = _fit_title_font(headline, max_text_w, min_title, max_title)
    try:
        sub_size = max(11, int(getattr(title_font, 'size', max_title) * 0.42))
    except (TypeError, ValueError):
        sub_size = 11
    sub_font = _fit_subtitle_font(subtitle, max_text_w, sub_size)

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
        draw.text((x, y), line, fill=OD_TEXT, font=title_font)
        y += lh + 4

    # `line_heights` is ink height (bbox[3]-bbox[1]), which omits the descent —
    # advancing by it alone drops the subtitle onto the title's descenders.
    # Clear the last line's descent before placing the subtitle.
    last_descent = max(0, title_font.getbbox(lines[-1])[3] - line_heights[-1]) if lines else 0
    sw = sub_bbox[2] - sub_bbox[0]
    if text_left is not None:
        sx = text_left
    else:
        sx = (width - sw) // 2
    # Never let the subtitle start past the left margin or run off the right.
    sx = max(pad if text_left is None else text_left, sx)
    draw.text((sx, y + last_descent + 10), subtitle, fill=accent, font=sub_font)
