"""Install ~10 selectable UI theme presets derived from the default theme.

Presets live under ``static/library/themes/<slug>`` which is runtime state (a
Docker volume in production), while the tracked source of truth is
``gametheca/setup/default_theme``.  Every preset is a copy of that source with
a handful of *managed* files rewritten to carry the preset's colours:

    theme.json        identity + the provenance marker used for staleness checks
    css/base.css      --btn-primary / --bg-dark-* recoloured
    css/gt-tokens.css the --gt-* design tokens the rest of the CSS keys on

Everything else in a preset must stay byte-identical to the source, which is
what lets :func:`sync_theme_tree` refresh presets in place without undoing
their colours.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from datetime import date

# Bump when the generator's output format changes so existing presets rebuild.
# 11 (GT-A1): gt-tokens gained radius / spacing / type / shadow / motion scales
# and the tree gained gt-primitives.css. source_fingerprint() would catch the
# file changes on its own, but the bump makes the token-layer break explicit for
# operators reading theme.json markers, and forces a rebuild of any preset whose
# folder was hand-edited.
# 12 (GT-A2/A4/A5): gt-tokens gained the upper type steps and --gt-radius-3xl
# that base.css's legacy scales now alias onto; gt-primitives gained the
# canonical --secondary / --ghost button variants; and the tree gained
# gt-bootstrap-bridge.css, which the base templates link and every preset
# therefore needs on disk. source_fingerprint() would notice the file changes
# anyway, but the bump makes the new required asset explicit for operators
# reading theme.json markers.
# 13 (UX-C8/W27-C2): the tree gained gt_sortable_table.js, which both base
# templates load, and table-components.css gained the .gt-sort-btn rules it
# builds. Same reasoning as 12 — a preset missing the script has tables whose
# headers simply do not respond, which reads as the feature never shipping.
GENERATOR_VERSION = 13

# Key written into each generated theme.json; also our ownership proof.
PRESET_MARKER_KEY = 'gametheca_preset'

# Files the generator owns per preset. sync_theme_tree must never overwrite
# these from the source, and a preset missing any of them is stale.
PRESET_MANAGED_FILES = ('theme.json', 'css/base.css', 'css/gt-tokens.css')

# Folder slug must match how preferences / theme_asset resolve paths.
# Wave 2d: each preset owns a colour language *and* a paired icon pack
# (plus --gt-icon-* token overrides) so packs are not near-identical hues.
# Avoid warm orange accents that clash with the default green system chrome.
PRESET_THEMES = [
    {
        'slug': 'aurora',
        'name': 'Arcade Neon',
        'description': 'CRT cyan glow — chunky pixel icons, scanline glass.',
        'btn_primary': '#22d3ee',
        'btn_primary_hover': '#06b6d4',
        'bg_dark_40': 'rgba(10, 24, 32, 0.94)',
        'bg_dark_30': 'rgba(6, 16, 24, 0.97)',
        'icon_pack': 'pixel',
        'tokens': {
            'gt-text': '#e0f7fa',
            'gt-text-muted': '#7dd3e8',
            'gt-border': 'rgba(34, 211, 238, 0.22)',
            'gt-accent-2': '#a5f3fc',
            'gt-glass-bg': 'rgba(6, 28, 36, 0.78)',
            'gt-glass-border': 'rgba(34, 211, 238, 0.28)',
            'gt-glass-blur': '10px',
            'gt-crt-opacity': '0.09',
            'gt-tile-gap': '8px',
            'font-display': '"Lucida Console", "Courier New", monospace',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '2.75',
            'gt-icon-linecap': 'square',
            'gt-icon-linejoin': 'miter',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
    {
        'slug': 'ember',
        'name': 'Hot Cabinet',
        'description': 'Arcade magenta — solid filled glyphs on cabinet black.',
        'btn_primary': '#f472b6',
        'btn_primary_hover': '#ec4899',
        'bg_dark_40': 'rgba(28, 10, 22, 0.94)',
        'bg_dark_30': 'rgba(18, 6, 14, 0.97)',
        'icon_pack': 'filled',
        'tokens': {
            'gt-text': '#fce7f3',
            'gt-text-muted': '#f9a8d4',
            'gt-border': 'rgba(244, 114, 182, 0.24)',
            'gt-accent-2': '#fb7185',
            'gt-glass-bg': 'rgba(36, 8, 24, 0.8)',
            'gt-glass-border': 'rgba(244, 114, 182, 0.3)',
            'gt-glass-blur': '14px',
            'gt-crt-opacity': '0.06',
            'gt-tile-gap': '10px',
            'font-display': '"Arial Black", "Segoe UI", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.25',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '0.92',
        },
    },
    {
        'slug': 'violet',
        'name': 'Modern Violet',
        'description': 'Soft violet glass — thin soft stroke icons.',
        'btn_primary': '#a78bfa',
        'btn_primary_hover': '#8b5cf6',
        'bg_dark_40': 'rgba(22, 16, 36, 0.94)',
        'bg_dark_30': 'rgba(14, 10, 28, 0.97)',
        'icon_pack': 'soft',
        'tokens': {
            'gt-text': '#f5f3ff',
            'gt-text-muted': '#c4b5fd',
            'gt-border': 'rgba(167, 139, 250, 0.2)',
            'gt-accent-2': '#c4b5fd',
            'gt-glass-bg': 'rgba(24, 16, 48, 0.7)',
            'gt-glass-border': 'rgba(167, 139, 250, 0.26)',
            'gt-glass-blur': '18px',
            'gt-crt-opacity': '0.02',
            'gt-tile-gap': '12px',
            'font-display': '"Segoe UI Semibold", "Segoe UI", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.35',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
    {
        'slug': 'forest',
        'name': 'Vector Green',
        'description': 'Phosphor green — crisp outline icons, low glass.',
        'btn_primary': '#4ade80',
        'btn_primary_hover': '#22c55e',
        'bg_dark_40': 'rgba(12, 24, 18, 0.94)',
        'bg_dark_30': 'rgba(8, 16, 12, 0.97)',
        'icon_pack': 'outline',
        'tokens': {
            'gt-text': '#ecfdf5',
            'gt-text-muted': '#86efac',
            'gt-border': 'rgba(74, 222, 128, 0.18)',
            'gt-accent-2': '#86efac',
            'gt-glass-bg': 'rgba(8, 28, 16, 0.88)',
            'gt-glass-border': 'rgba(74, 222, 128, 0.22)',
            'gt-glass-blur': '6px',
            'gt-crt-opacity': '0.07',
            'gt-tile-gap': '9px',
            'font-display': '"Courier New", "Lucida Console", monospace',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '2',
            'gt-icon-linecap': 'butt',
            'gt-icon-linejoin': 'miter',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
    {
        'slug': 'ocean',
        'name': 'Modern Ocean',
        'description': 'Deep blue chrome — duotone fill icons.',
        'btn_primary': '#3b82f6',
        'btn_primary_hover': '#2563eb',
        'bg_dark_40': 'rgba(10, 18, 36, 0.94)',
        'bg_dark_30': 'rgba(6, 12, 28, 0.97)',
        'icon_pack': 'duotone',
        'tokens': {
            'gt-text': '#eff6ff',
            'gt-text-muted': '#93c5fd',
            'gt-border': 'rgba(59, 130, 246, 0.2)',
            'gt-accent-2': '#60a5fa',
            'gt-glass-bg': 'rgba(8, 20, 44, 0.74)',
            'gt-glass-border': 'rgba(59, 130, 246, 0.28)',
            'gt-glass-blur': '14px',
            'gt-crt-opacity': '0.015',
            'gt-tile-gap': '11px',
            'font-display': '"Segoe UI", "Helvetica Neue", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.75',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '0.22',
        },
    },
    {
        'slug': 'rose',
        'name': 'Modern Rose',
        'description': 'Muted rose charcoal — soft thin strokes.',
        'btn_primary': '#fb7185',
        'btn_primary_hover': '#f43f5e',
        'bg_dark_40': 'rgba(28, 14, 20, 0.94)',
        'bg_dark_30': 'rgba(18, 8, 14, 0.97)',
        'icon_pack': 'soft',
        'tokens': {
            'gt-text': '#fff1f2',
            'gt-text-muted': '#fda4af',
            'gt-border': 'rgba(251, 113, 133, 0.2)',
            'gt-accent-2': '#fda4af',
            'gt-glass-bg': 'rgba(32, 12, 20, 0.72)',
            'gt-glass-border': 'rgba(251, 113, 133, 0.26)',
            'gt-glass-blur': '16px',
            'gt-crt-opacity': '0.025',
            'gt-tile-gap': '12px',
            'font-display': '"Georgia", "Times New Roman", serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.4',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
    {
        'slug': 'mono',
        'name': 'Modern Mono',
        'description': 'Neutral slate — heavy mono block icons.',
        'btn_primary': '#94a3b8',
        'btn_primary_hover': '#64748b',
        'bg_dark_40': 'rgba(18, 18, 22, 0.94)',
        'bg_dark_30': 'rgba(10, 10, 14, 0.97)',
        'icon_pack': 'mono',
        'tokens': {
            'gt-text': '#f8fafc',
            'gt-text-muted': '#94a3b8',
            'gt-border': 'rgba(148, 163, 184, 0.18)',
            'gt-accent-2': '#cbd5e1',
            'gt-glass-bg': 'rgba(16, 16, 20, 0.82)',
            'gt-glass-border': 'rgba(255, 255, 255, 0.1)',
            'gt-glass-blur': '8px',
            'gt-crt-opacity': '0.01',
            'gt-tile-gap': '10px',
            'font-display': '"Segoe UI", "Helvetica Neue", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '0.5',
            'gt-icon-linecap': 'square',
            'gt-icon-linejoin': 'miter',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '1',
        },
    },
    {
        'slug': 'sunset',
        'name': 'Coin Gold',
        'description': 'Coin-slot gold — filled glyphs, warm cabinet CRT.',
        'btn_primary': '#fbbf24',
        'btn_primary_hover': '#eab308',
        'bg_dark_40': 'rgba(24, 18, 8, 0.94)',
        'bg_dark_30': 'rgba(14, 10, 4, 0.97)',
        'icon_pack': 'filled',
        'tokens': {
            'gt-text': '#fffbeb',
            'gt-text-muted': '#fcd34d',
            'gt-border': 'rgba(251, 191, 36, 0.22)',
            'gt-accent-2': '#fde68a',
            'gt-glass-bg': 'rgba(28, 20, 6, 0.8)',
            'gt-glass-border': 'rgba(251, 191, 36, 0.3)',
            'gt-glass-blur': '12px',
            'gt-crt-opacity': '0.08',
            'gt-tile-gap': '8px',
            'font-display': '"Arial Black", "Impact", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.5',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '0.88',
        },
    },
    {
        'slug': 'ice',
        'name': 'Modern Ice',
        'description': 'Pale sky on cold navy — soft stroke, high blur.',
        'btn_primary': '#7dd3fc',
        'btn_primary_hover': '#38bdf8',
        'bg_dark_40': 'rgba(12, 20, 32, 0.94)',
        'bg_dark_30': 'rgba(8, 14, 24, 0.97)',
        'icon_pack': 'soft',
        'tokens': {
            'gt-text': '#f0f9ff',
            'gt-text-muted': '#7dd3fc',
            'gt-border': 'rgba(125, 211, 252, 0.2)',
            'gt-accent-2': '#bae6fd',
            'gt-glass-bg': 'rgba(10, 22, 40, 0.68)',
            'gt-glass-border': 'rgba(125, 211, 252, 0.28)',
            'gt-glass-blur': '20px',
            'gt-crt-opacity': '0.02',
            'gt-tile-gap': '12px',
            'font-display': '"Segoe UI Light", "Segoe UI", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.25',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
]

PRESET_SLUGS = tuple(preset['slug'] for preset in PRESET_THEMES)


# --------------------------------------------------------------------------
# File-tree helpers (hash based, shared with the boot-time sync)
# --------------------------------------------------------------------------

def iter_tree_files(root: str):
    """Yield every file under *root* as a '/'-separated relative path."""
    if not os.path.isdir(root):
        return
    for dirpath, _dirs, files in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        for name in sorted(files):
            rel = name if rel_dir == '.' else os.path.join(rel_dir, name)
            yield rel.replace(os.sep, '/')


def file_digest(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()


def source_fingerprint(root: str) -> str:
    """Content fingerprint of a theme source tree.

    Changes whenever a tracked file is added, removed or edited, which is what
    tells us a preset generated from an older snapshot is stale.
    """
    digest = hashlib.sha256()
    digest.update(f'generator={GENERATOR_VERSION}\n'.encode('utf-8'))
    for rel in sorted(iter_tree_files(root)):
        digest.update(f'{rel}:{file_digest(os.path.join(root, *rel.split("/")))}\n'.encode('utf-8'))
    return digest.hexdigest()


def _files_match(src: str, dest: str) -> bool:
    try:
        if os.path.getsize(src) != os.path.getsize(dest):
            return False
    except OSError:
        return False
    return file_digest(src) == file_digest(dest)


def sync_theme_tree(source_root: str, target_root: str, *, protected=()) -> int:
    """Copy every source file whose content differs at the target.

    Files listed in *protected* are skipped entirely: those are the ones a
    preset legitimately owns.  Extra files at the target are left alone so a
    hand-added asset is never deleted.  Returns the number of files written.
    """
    if not os.path.isdir(source_root):
        return 0

    protected_set = {p.replace('\\', '/') for p in protected}
    written = 0
    for rel in iter_tree_files(source_root):
        if rel in protected_set:
            continue
        parts = rel.split('/')
        src = os.path.join(source_root, *parts)
        dest = os.path.join(target_root, *parts)
        if os.path.isfile(dest) and _files_match(src, dest):
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(src, dest)
        written += 1
    return written


# --------------------------------------------------------------------------
# Colour helpers
# --------------------------------------------------------------------------

def _replace_css_var(css: str, name: str, value: str) -> str:
    pattern = re.compile(rf'(--{re.escape(name)}:\s*)([^;]+)(;)')
    if not pattern.search(css):
        return css
    return pattern.sub(rf'\g<1>{value}\g<3>', css, count=1)


def _upsert_css_var(css: str, name: str, value: str) -> str:
    """Replace a CSS variable, adding it to the first :root block if absent."""
    pattern = re.compile(rf'(--{re.escape(name)}:\s*)([^;]+)(;)')
    if pattern.search(css):
        return pattern.sub(rf'\g<1>{value}\g<3>', css, count=1)

    root = re.search(r':root\s*\{', css)
    if root:
        insert_at = root.end()
        return f'{css[:insert_at]}\n  --{name}: {value};{css[insert_at:]}'
    return f':root {{\n  --{name}: {value};\n}}\n{css}'


def _rgba_to_hex(value: str) -> str | None:
    """'rgba(10, 24, 32, 0.94)' -> '#0a1820' (alpha dropped)."""
    match = re.search(r'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)', value or '')
    if not match:
        return None
    channels = [max(0, min(255, int(round(float(c))))) for c in match.groups()]
    return '#{:02x}{:02x}{:02x}'.format(*channels)


def _hex_to_rgb(value: str):
    value = value.lstrip('#')
    if len(value) == 3:
        value = ''.join(ch * 2 for ch in value)
    if len(value) != 6:
        return None
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def _lighten(hex_color: str, amount: float) -> str:
    rgb = _hex_to_rgb(hex_color)
    if rgb is None:
        return hex_color
    lifted = [min(255, int(round(c + (255 - c) * amount))) for c in rgb]
    return '#{:02x}{:02x}{:02x}'.format(*lifted)


def _relative_luminance(hex_color: str) -> float:
    rgb = _hex_to_rgb(hex_color)
    if rgb is None:
        return 0.0
    channels = []
    for raw in rgb:
        c = raw / 255
        channels.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = channels
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def preset_tokens(preset: dict) -> dict:
    """The --gt-* overrides that make this preset visually distinct.

    Base colours always derive from btn_primary / bg_dark_*. Optional
    ``tokens`` on the preset expand glass, typography, CRT, and icon geometry
    so packs diverge beyond accent hue alone.
    """
    accent = preset['btn_primary']
    surface = _rgba_to_hex(preset.get('bg_dark_40', '')) or '#141820'
    tokens = {
        'gt-bg': _rgba_to_hex(preset.get('bg_dark_30', '')) or '#0b0d10',
        'gt-surface': surface,
        'gt-surface-2': _lighten(surface, 0.10),
        'gt-accent': accent,
        # Text drawn on top of the accent needs to flip with accent brightness.
        'gt-accent-contrast': '#0b0d10' if _relative_luminance(accent) > 0.30 else '#f2f4f8',
    }
    extra = preset.get('tokens') or {}
    if isinstance(extra, dict):
        for name, value in extra.items():
            if value is None or value == '':
                continue
            tokens[str(name)] = str(value)
    return tokens


def preset_icon_pack(preset: dict) -> str:
    """Paired icon pack id for a colour preset (outline if unset)."""
    pack = preset.get('icon_pack') or 'outline'
    return str(pack).strip() or 'outline'


# --------------------------------------------------------------------------
# Preset ownership + staleness
# --------------------------------------------------------------------------

def _read_theme_json(path: str):
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def is_managed_preset(target: str, preset: dict) -> bool:
    """True when the folder at a preset slug was generated by us.

    A user can upload a custom theme whose name collides with a preset slug;
    regenerating over it would destroy their work.  We only claim a folder if
    it carries our marker, or — for presets written before the marker existed —
    if its theme.json still matches the identity we would have written.
    """
    theme_json = os.path.join(target, 'theme.json')
    if not os.path.isfile(theme_json):
        # No theme.json means no usable theme here, so there is nothing to lose.
        return True

    data = _read_theme_json(theme_json)
    if data is None:
        return False

    marker = data.get(PRESET_MARKER_KEY)
    if isinstance(marker, dict):
        return marker.get('slug') == preset['slug']

    return (
        data.get('author') == 'GameTheca'
        and data.get('name') == preset['name']
        and data.get('description') == preset['description']
    )


def preset_needs_rebuild(target: str, preset: dict, fingerprint: str) -> bool:
    """True when the preset on disk was generated from a different source."""
    theme_json = os.path.join(target, 'theme.json')
    data = _read_theme_json(theme_json)
    if data is None:
        return True

    marker = data.get(PRESET_MARKER_KEY)
    if not isinstance(marker, dict):
        return True
    if marker.get('generator') != GENERATOR_VERSION:
        return True
    if marker.get('source') != fingerprint:
        return True

    # A managed file deleted at runtime cannot be restored by the sync pass
    # (the sync deliberately skips managed files), so rebuild instead.
    return any(
        not os.path.isfile(os.path.join(target, *rel.split('/')))
        for rel in PRESET_MANAGED_FILES
    )


# --------------------------------------------------------------------------
# Generation
# --------------------------------------------------------------------------

def _write_theme_json(
    path: str,
    *,
    name: str,
    description: str,
    slug: str,
    fingerprint: str,
    icon_pack: str = 'outline',
) -> None:
    payload = {
        'name': name,
        'author': 'GameTheca',
        'description': description,
        'version': '1.0.0',
        'release_date': date.today().isoformat(),
        'default_icon_pack': icon_pack,
        PRESET_MARKER_KEY: {
            'slug': slug,
            'generator': GENERATOR_VERSION,
            'source': fingerprint,
            'icon_pack': icon_pack,
        },
    }
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, indent=2)
        fh.write('\n')


def _write_preset_base_css(target: str, preset: dict) -> None:
    base_css_path = os.path.join(target, 'css', 'base.css')
    if not os.path.isfile(base_css_path):
        return

    with open(base_css_path, 'r', encoding='utf-8') as fh:
        css = fh.read()

    css = _replace_css_var(css, 'btn-primary', preset['btn_primary'])
    css = _replace_css_var(css, 'btn-primary-hover', preset['btn_primary_hover'])
    css = _replace_css_var(css, 'bg-dark-40', preset['bg_dark_40'])
    css = _replace_css_var(css, 'bg-dark-30', preset['bg_dark_30'])

    with open(base_css_path, 'w', encoding='utf-8') as fh:
        fh.write(css)


def _write_preset_tokens_css(source_root: str, target: str, preset: dict) -> None:
    """Write the preset's own gt-tokens.css, derived from the source tokens.

    Starting from the source file (rather than a hand-written stub) means any
    token added upstream automatically reaches every preset on the next
    regeneration.
    """
    rel_parts = ('css', 'gt-tokens.css')
    source_tokens = os.path.join(source_root, *rel_parts)
    if os.path.isfile(source_tokens):
        with open(source_tokens, 'r', encoding='utf-8') as fh:
            css = fh.read()
    else:
        css = ':root {\n}\n'

    for name, value in preset_tokens(preset).items():
        css = _upsert_css_var(css, name, value)

    target_tokens = os.path.join(target, *rel_parts)
    os.makedirs(os.path.dirname(target_tokens), exist_ok=True)
    with open(target_tokens, 'w', encoding='utf-8') as fh:
        fh.write(css)


def build_preset(source_root: str, target: str, preset: dict, fingerprint: str) -> None:
    """Regenerate one preset from scratch."""
    if os.path.exists(target):
        shutil.rmtree(target)
    shutil.copytree(source_root, target)

    _write_theme_json(
        os.path.join(target, 'theme.json'),
        name=preset['name'],
        description=preset['description'],
        slug=preset['slug'],
        fingerprint=fingerprint,
        icon_pack=preset_icon_pack(preset),
    )
    _write_preset_base_css(target, preset)
    _write_preset_tokens_css(source_root, target, preset)


def install_preset_themes(themes_path: str, default_source: str, *, force: bool = False) -> int:
    """
    Generate/refresh the preset themes under *themes_path*.

    Presets are rebuilt when they are missing, were generated by an older
    generator, or were generated from a different snapshot of *default_source* —
    which is how an edited stylesheet reaches a preset's own colour files.
    Presets that are still current are left to :func:`sync_preset_themes`.

    Folders occupying a preset slug that we did not generate (e.g. a theme the
    admin uploaded) are left untouched.

    Returns the number of presets rebuilt.
    """
    if not os.path.isdir(default_source):
        return 0

    os.makedirs(themes_path, exist_ok=True)
    fingerprint = source_fingerprint(default_source)
    rebuilt = 0

    for preset in PRESET_THEMES:
        target = os.path.join(themes_path, preset['slug'])

        if os.path.isdir(target) and not is_managed_preset(target, preset):
            continue

        if force or preset_needs_rebuild(target, preset, fingerprint):
            build_preset(default_source, target, preset, fingerprint)
            rebuilt += 1

    return rebuilt


def sync_preset_themes(themes_path: str, default_source: str) -> int:
    """Refresh the shared (non-colour) files of every installed preset.

    Returns the number of files written across all presets.
    """
    if not os.path.isdir(default_source) or not os.path.isdir(themes_path):
        return 0

    written = 0
    for preset in PRESET_THEMES:
        target = os.path.join(themes_path, preset['slug'])
        if not os.path.isdir(target) or not is_managed_preset(target, preset):
            continue
        written += sync_theme_tree(default_source, target, protected=PRESET_MANAGED_FILES)
    return written
