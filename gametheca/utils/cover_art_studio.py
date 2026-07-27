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


def _vertical_gradient(width: int, height: int) -> Image.Image:
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(height - 1, 1)
        color = _lerp_color(GT_SURFACE, GT_BG, t * 0.85)
        draw.line([(0, y), (width, y)], fill=color)
    return img


def _draw_mark(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float) -> None:
    """Minimal GameTheca controller mark (matches gametheca_mark.svg)."""
    s = scale
    body = [
        cx - 22 * s,
        cy - 12 * s,
        cx + 22 * s,
        cy + 12 * s,
    ]
    draw.rounded_rectangle(body, radius=int(8 * s), outline=GT_ACCENT, width=max(2, int(3 * s)))
    draw.ellipse(
        [cx - 22 * s + 12 * s - 3.5 * s, cy - 3.5 * s, cx - 22 * s + 12 * s + 3.5 * s, cy + 3.5 * s],
        fill=GT_ACCENT,
    )
    draw.ellipse([cx + 8 * s - 2 * s, cy - 5 * s, cx + 8 * s + 2 * s, cy - 1 * s], fill=GT_TEXT)
    draw.ellipse([cx + 13 * s - 2 * s, cy, cx + 13 * s + 2 * s, cy + 4 * s], fill=GT_TEXT)
    draw.rectangle([cx - 2 * s, cy - 14 * s, cx + 2 * s, cy - 8 * s], fill=GT_ACCENT)


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


def render_cover_art(
    width: int,
    height: int,
    *,
    title: str | None = None,
    system: str | None = None,
    variant: str = 'tile',
) -> Image.Image:
    """Render a branded placeholder/cover at the given size."""
    title = (title or '').strip()
    system = (system or '').strip()
    is_wide = width >= height and width / max(height, 1) >= 1.5
    is_square = width == height

    img = _vertical_gradient(width, height)
    draw = ImageDraw.Draw(img)

    accent_h = max(4, height // 80)
    draw.rectangle([0, 0, width, accent_h], fill=GT_ACCENT)

    inset = max(8, min(width, height) // 16)
    draw.rectangle(
        [inset, inset + accent_h, width - inset, height - inset],
        outline=(255, 255, 255, 30),
        width=max(1, min(width, height) // 256),
    )

    mark_scale = min(width, height) / 320
    _draw_mark(draw, width // 2, int(height * (0.28 if not is_wide else 0.35)), mark_scale)

    if not title:
        headline = 'GameTheca'
        subtitle = 'Library hero' if variant == 'wide' or is_wide else 'No cover art'
    else:
        headline = title
        subtitle = system or 'GameTheca'

    title_size = max(14, min(width, height) // (10 if is_square else 12))
    sub_size = max(10, title_size // 2)
    title_font = _load_font(title_size)
    sub_font = _load_font(sub_size)

    pad = max(12, min(width, height) // 10)
    max_text_w = width - pad * 2
    lines = _wrap_title(headline, title_font, max_text_w)
    line_heights = [title_font.getbbox(line)[3] - title_font.getbbox(line)[1] for line in lines]
    block_h = sum(line_heights) + (len(lines) - 1) * 4
    sub_bbox = sub_font.getbbox(subtitle)
    sub_h = sub_bbox[3] - sub_bbox[1]
    total_h = block_h + sub_h + 8
    y = int(height * (0.52 if not is_wide else 0.55)) - total_h // 2

    for line, lh in zip(lines, line_heights):
        bbox = title_font.getbbox(line)
        tw = bbox[2] - bbox[0]
        draw.text(((width - tw) // 2, y), line, fill=GT_TEXT, font=title_font)
        y += lh + 4

    sw = sub_bbox[2] - sub_bbox[0]
    draw.text(((width - sw) // 2, y + 4), subtitle, fill=GT_TEXT_MUTED, font=sub_font)

    if is_wide:
        bar_w = int(width * 0.35)
        draw.rectangle([0, height - accent_h * 2, bar_w, height], fill=GT_SURFACE_2)

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
    db.session.commit()
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
