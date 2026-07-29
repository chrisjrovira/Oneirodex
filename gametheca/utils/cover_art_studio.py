"""Procedural cover art for GameTheca — aurora tokens, Pillow templates (no cloud AI)."""

from __future__ import annotations

import io
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


def _fit_title_font(headline: str, max_width: int, min_size: int, max_size: int) -> ImageFont.ImageFont:
    """Pick the largest font that keeps the title readable at tile size."""
    size = max_size
    while size >= min_size:
        font = _load_font(size)
        lines = _wrap_title(headline, font, max_width)
        widest = max((font.getbbox(line)[2] - font.getbbox(line)[0]) for line in lines)
        if widest <= max_width and len(lines) <= 3:
            return font
        size -= 1
    return _load_font(min_size)


def render_cover_art(
    width: int,
    height: int,
    *,
    title: str | None = None,
    system: str | None = None,
    variant: str = 'tile',
) -> Image.Image:
    """Render a branded placeholder/cover at the given size with per-system templates."""
    title = (title or '').strip()
    system = (system or '').strip()
    is_wide = width >= height and width / max(height, 1) >= 1.5
    is_square = width == height

    top, bottom, accent, glyph = resolve_system_template(system)
    img = _vertical_gradient(width, height, top=top, bottom=bottom)
    draw = ImageDraw.Draw(img)

    accent_h = max(4, height // 64)
    draw.rectangle([0, 0, width, accent_h], fill=accent)
    # Bottom accent bar for system identity at small tile sizes
    draw.rectangle([0, height - accent_h, width, height], fill=accent)

    inset = max(8, min(width, height) // 16)
    draw.rectangle(
        [inset, inset + accent_h, width - inset, height - inset - accent_h],
        outline=_lerp_color(accent, (255, 255, 255), 0.35),
        width=max(1, min(width, height) // 200),
    )

    mark_scale = min(width, height) / 280
    glyph_y = int(height * (0.26 if not is_wide else 0.32))
    _draw_system_glyph(draw, width // 2, glyph_y, mark_scale, glyph, accent)

    if not title:
        headline = 'GameTheca'
        subtitle = system or ('Library hero' if variant == 'wide' or is_wide else 'No cover art')
    else:
        headline = title
        subtitle = system or 'GameTheca'

    # Readable minimums: ≥14px title / ≥11px subtitle on 200×300 tiles
    min_title = 14 if min(width, height) >= 200 else 11
    max_title = max(min_title, min(width, height) // (9 if is_square else 10))
    pad = max(10, min(width, height) // 12)
    max_text_w = width - pad * 2
    title_font = _fit_title_font(headline, max_text_w, min_title, max_title)
    sub_size = max(11, title_font.size // 2 if hasattr(title_font, 'size') else min_title // 2)
    # FreeTypeFont exposes .size; default bitmap font may not — clamp safely
    try:
        sub_size = max(11, int(getattr(title_font, 'size', max_title) * 0.45))
    except (TypeError, ValueError):
        sub_size = 11
    sub_font = _load_font(sub_size)

    lines = _wrap_title(headline, title_font, max_text_w)
    line_heights = [title_font.getbbox(line)[3] - title_font.getbbox(line)[1] for line in lines]
    block_h = sum(line_heights) + (len(lines) - 1) * 4
    sub_bbox = sub_font.getbbox(subtitle)
    sub_h = sub_bbox[3] - sub_bbox[1]
    total_h = block_h + sub_h + 10
    y = int(height * (0.54 if not is_wide else 0.55)) - total_h // 2

    for line, lh in zip(lines, line_heights):
        bbox = title_font.getbbox(line)
        tw = bbox[2] - bbox[0]
        # Soft shadow for contrast on vivid system gradients
        draw.text(((width - tw) // 2 + 1, y + 1), line, fill=(0, 0, 0), font=title_font)
        draw.text(((width - tw) // 2, y), line, fill=GT_TEXT, font=title_font)
        y += lh + 4

    sw = sub_bbox[2] - sub_bbox[0]
    draw.text(((width - sw) // 2, y + 6), subtitle, fill=accent, font=sub_font)

    if is_wide:
        bar_w = int(width * 0.35)
        draw.rectangle([0, height - accent_h * 2, bar_w, height], fill=_lerp_color(top, accent, 0.35))

    return img


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


def safe_pack_file(pack_id: str, filename: str, package_root: str | Path | None = None) -> Path:
    if filename not in KNOWN_FILENAMES:
        raise ValueError('Unknown art filename')
    pack_dir = safe_pack_dir(pack_id, package_root)
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
    pack_dir = safe_pack_dir(pack_id, package_root)
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
    pack_dir = safe_pack_dir(pack_id, package_root)
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
    pack_dir = safe_pack_dir(pack_id, package_root)
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
    }


def bake_default_fallbacks(package_root: str | Path | None = None) -> dict[str, str]:
    """ART-1: write branded default_cover.jpg and default_library.jpg."""
    ns_root = newstyle_root(package_root)
    ns_root.mkdir(parents=True, exist_ok=True)
    cover = render_cover_art(600, 900, title='', variant='tile')
    library = render_cover_art(1920, 1080, title='', variant='wide')
    cover_path = ns_root / 'default_cover.jpg'
    library_path = ns_root / 'default_library.jpg'
    cover.save(cover_path, format='JPEG', quality=90, optimize=True)
    library.save(library_path, format='JPEG', quality=90, optimize=True)
    large_path = ns_root / 'default_library_large.jpg'
    large = render_cover_art(1920, 1080, title='', variant='wide')
    large.save(large_path, format='JPEG', quality=90, optimize=True)
    return {
        'default_cover': str(cover_path),
        'default_library': str(library_path),
        'default_library_large': str(large_path),
    }
