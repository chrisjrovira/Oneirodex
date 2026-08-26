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
# 14 (W27-C1 buttons): gt-appbar's .gt-cbtn gained a disabled state, a hover
# guard and the same focus ring as .gt-btn, and both focus rules gained a
# fallback so a theme without --gt-focus-ring loses the colour rather than the
# outline. A preset still carrying the old copy shows disabled chrome buttons
# as though they were live.
# 15 (W28-5 focus visibility): seven controls across gt-loading-motifs,
# form-components, settings/gt-account, admin-shell, admin_manage_themes,
# admin_manage_igdb_settings and admin_manage_scanjobs gained a real
# :focus-visible ring. A preset still carrying the old copies has controls a
# keyboard user cannot locate.
# 16 (UID-006 art packs): each preset now authors radius / space / type /
# shadow as a system visual language, not hue-only tint. Operators must
# Reset Themes so regenerated gt-tokens.css picks up the geometry.
# 17 (decade rooms): presets carry an era room (same setting language as the
# play shell) so chrome is wallpaper/window/floor, not a solid colour slab.
# The tree gained css/gt-era.css. Reset Themes so every pack copies it and
# regenerated gt-tokens.css picks up --gt-era.
GENERATOR_VERSION = 17

# Play-room id used when a theme does not name one (default + uploaded packs).
DEFAULT_ERA = 'wood_den_80s'

# Key written into each generated theme.json; also our ownership proof.
PRESET_MARKER_KEY = 'gametheca_preset'

# ---------------------------------------------------------------------------
# Stock avatars
# ---------------------------------------------------------------------------
#
# The seven shipped avatars are flat SVGs drawn in the *default* theme's palette
# — a green glyph on a near-black panel. They are served as <img>, so they can
# neither inherit `currentColor` nor read a CSS custom property: on Arcade Neon
# or Hot Cabinet the member's chosen avatar stayed default-green while every
# other pixel around it changed.
#
# So they are generated per preset, exactly like `gt-tokens.css` is. The source
# files carry these three colours and nothing else (verified: 24 accent, 7
# panel, 4 muted occurrences across all seven files), which is what makes a
# straight substitution safe rather than a guess.
#
# Anyone editing the source SVGs must stay inside this palette. `AVATAR_SOURCE_*`
# is the contract, and `tests/test_preset_avatars.py` fails if a file drifts off
# it — otherwise a new colour would silently survive into every preset unchanged
# and only ever be noticed as "that one avatar is still green".
AVATAR_SOURCE_ACCENT = '#2fd67b'
AVATAR_SOURCE_PANEL = '#12161c'
AVATAR_SOURCE_MUTED = '#8a94a3'

AVATAR_FILES = (
    'arcade.svg',
    'cartridge.svg',
    'controller.svg',
    'default.svg',
    'disc.svg',
    'dpad.svg',
    'joystick.svg',
)

# Files the generator writes for *every* preset, unconditionally. Two things
# follow from that: sync_theme_tree must never overwrite them from the source,
# and a preset missing any of them is stale and gets rebuilt.
PRESET_MANAGED_FILES = (
    'theme.json',
    'css/base.css',
    'css/gt-tokens.css',
)

# The recoloured avatars — protected from the sync exactly like the colour CSS,
# but deliberately *not* part of PRESET_MANAGED_FILES.
#
# The difference is that these are written only when the source tree actually
# ships `avatars/`. Folding them into the managed list made their absence mean
# "stale", so an install whose source predates them — or any caller passing a
# source tree without them — would rebuild all nine presets on every single
# boot, forever, trying to produce files that could never exist. Staleness has
# to be conditional on the source having something to generate from; see
# `preset_needs_rebuild`.
PRESET_AVATAR_FILES = tuple(f'avatars/{name}' for name in AVATAR_FILES)

# What the sync pass must leave alone: everything the generator owns, whether
# or not its absence would trigger a rebuild.
PRESET_PROTECTED_FILES = PRESET_MANAGED_FILES + PRESET_AVATAR_FILES

# Folder slug must match how preferences / theme_asset resolve paths.
# Wave 2d: each preset owns a colour language *and* a paired icon pack
# (plus --gt-icon-* token overrides) so packs are not near-identical hues.
# Avoid warm orange accents that clash with the default green system chrome.
PRESET_THEMES = [
    {
        'slug': 'aurora',
        'name': 'Arcade Neon',
        'description': '8-bit cabinet — square corners, tight tiles, CRT scan.',
        'group': 'cabinet',
        'era': 'arcade_cabinet',
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
        'description': 'Coin-op cabinet — pill chips, deep shadow, filled glyphs.',
        'group': 'cabinet',
        'era': 'arcade_cabinet',
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
        'description': 'Sixth-gen glass — large radius, heavy blur, thin strokes.',
        'group': 'cabinet',
        'era': 'media_center_00s',
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
        'description': 'Vector monitor — zero radius, tight type, phosphor green.',
        'group': 'cabinet',
        'era': 'desk',
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
        'description': 'Seventh-gen chrome — medium radius, duotone fill.',
        'group': 'cabinet',
        'era': 'media_center_00s',
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
        'description': 'Handheld — compact space, serif display, soft strokes.',
        'group': 'cabinet',
        'era': 'teen_bedroom_90s',
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
        'description': 'Home computer — 0 radius, no shadow, dense mono blocks.',
        'group': 'cabinet',
        'era': 'desk',
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
        'description': 'Medal cabinet — warm gold, large shadow, chunky type.',
        'group': 'cabinet',
        'era': 'wood_den_80s',
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
        'description': 'HD-era frost — max radius, airy space, high blur.',
        'group': 'cabinet',
        'era': 'media_center_00s',
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
    {
        'slug': 'era-80s',
        'name': '1980s wood den',
        'description': 'Family television, wood panel, harvest lamp — when a lot of households started.',
        'group': 'decade',
        'era': 'wood_den_80s',
        'btn_primary': '#e8c07d',
        'btn_primary_hover': '#d4a85c',
        'bg_dark_40': 'rgba(26, 20, 16, 0.88)',
        'bg_dark_30': 'rgba(14, 10, 8, 0.92)',
        'icon_pack': 'pixel',
        'tokens': {
            'gt-text': '#f4e6d0',
            'gt-text-muted': '#c8a878',
            'gt-border': 'rgba(232, 192, 125, 0.22)',
            'gt-accent-2': '#ffb765',
            'gt-glass-bg': 'rgba(28, 18, 12, 0.72)',
            'gt-glass-border': 'rgba(232, 192, 125, 0.28)',
            'gt-glass-blur': '6px',
            'gt-crt-opacity': '0.1',
            'gt-tile-gap': '8px',
            'font-display': '"Press Start 2P", "Lucida Console", monospace',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '2.5',
            'gt-icon-linecap': 'square',
            'gt-icon-linejoin': 'miter',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
    {
        'slug': 'era-90s',
        'name': '1990s teen bedroom',
        'description': 'Posters, carpet, afternoon window — 16-bit on the floor.',
        'group': 'decade',
        'era': 'teen_bedroom_90s',
        'btn_primary': '#c9a0d4',
        'btn_primary_hover': '#b084c0',
        'bg_dark_40': 'rgba(28, 21, 36, 0.88)',
        'bg_dark_30': 'rgba(16, 12, 22, 0.92)',
        'icon_pack': 'filled',
        'tokens': {
            'gt-text': '#f3e8f8',
            'gt-text-muted': '#d4a0c8',
            'gt-border': 'rgba(201, 160, 212, 0.22)',
            'gt-accent-2': '#d4a574',
            'gt-glass-bg': 'rgba(32, 20, 40, 0.74)',
            'gt-glass-border': 'rgba(201, 160, 212, 0.28)',
            'gt-glass-blur': '8px',
            'gt-crt-opacity': '0.06',
            'gt-tile-gap': '10px',
            'font-display': '"Arial Black", "Segoe UI", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.4',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '0.88',
        },
    },
    {
        'slug': 'era-late90s',
        'name': 'Late-90s carpet den',
        'description': 'Basement rec room, disc cases, tube still in the corner.',
        'group': 'decade',
        'era': 'carpet_den_late_90s',
        'btn_primary': '#8aa4ff',
        'btn_primary_hover': '#6a88ee',
        'bg_dark_40': 'rgba(18, 16, 24, 0.9)',
        'bg_dark_30': 'rgba(10, 8, 16, 0.94)',
        'icon_pack': 'duotone',
        'tokens': {
            'gt-text': '#e8ecff',
            'gt-text-muted': '#9bb0ff',
            'gt-border': 'rgba(138, 164, 255, 0.22)',
            'gt-accent-2': '#6a8cff',
            'gt-glass-bg': 'rgba(20, 16, 32, 0.76)',
            'gt-glass-border': 'rgba(138, 164, 255, 0.28)',
            'gt-glass-blur': '8px',
            'gt-crt-opacity': '0.05',
            'gt-tile-gap': '10px',
            'font-display': '"Orbitron", "Segoe UI", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.7',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '0.22',
        },
    },
    {
        'slug': 'era-00s',
        'name': '2000s media centre',
        'description': 'Silver-black stand, tray-loading boxes, evening window.',
        'group': 'decade',
        'era': 'media_center_00s',
        'btn_primary': '#3f9bff',
        'btn_primary_hover': '#2b7fe0',
        'bg_dark_40': 'rgba(11, 18, 32, 0.88)',
        'bg_dark_30': 'rgba(6, 10, 20, 0.94)',
        'icon_pack': 'soft',
        'tokens': {
            'gt-text': '#e8f2ff',
            'gt-text-muted': '#7fd3ff',
            'gt-border': 'rgba(63, 155, 255, 0.22)',
            'gt-accent-2': '#7fd3ff',
            'gt-glass-bg': 'rgba(10, 18, 36, 0.7)',
            'gt-glass-border': 'rgba(63, 155, 255, 0.28)',
            'gt-glass-blur': '10px',
            'gt-crt-opacity': '0.02',
            'gt-tile-gap': '11px',
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
        'slug': 'era-arcade',
        'name': 'Arcade floor',
        'description': 'Dark room, marquee overhead, coins on the bezel.',
        'group': 'decade',
        'era': 'arcade_cabinet',
        'btn_primary': '#ff2d6f',
        'btn_primary_hover': '#e01858',
        'bg_dark_40': 'rgba(12, 8, 18, 0.9)',
        'bg_dark_30': 'rgba(6, 4, 12, 0.95)',
        'icon_pack': 'filled',
        'tokens': {
            'gt-text': '#ffe8f0',
            'gt-text-muted': '#ff8ab0',
            'gt-border': 'rgba(255, 45, 111, 0.24)',
            'gt-accent-2': '#25e0ff',
            'gt-glass-bg': 'rgba(16, 6, 18, 0.78)',
            'gt-glass-border': 'rgba(255, 45, 111, 0.32)',
            'gt-glass-blur': '6px',
            'gt-crt-opacity': '0.08',
            'gt-tile-gap': '8px',
            'font-display': '"Arial Black", "Impact", sans-serif',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '1.5',
            'gt-icon-linecap': 'round',
            'gt-icon-linejoin': 'round',
            'gt-icon-fill': 'currentColor',
            'gt-icon-fill-opacity': '0.9',
        },
    },
    {
        'slug': 'era-desk',
        'name': 'Computer desk',
        'description': 'Home computer, desk lamp, phosphor glow.',
        'group': 'decade',
        'era': 'desk',
        'btn_primary': '#5ef08a',
        'btn_primary_hover': '#3ed46c',
        'bg_dark_40': 'rgba(13, 20, 16, 0.9)',
        'bg_dark_30': 'rgba(8, 12, 10, 0.94)',
        'icon_pack': 'outline',
        'tokens': {
            'gt-text': '#e8f8ee',
            'gt-text-muted': '#a9f7c1',
            'gt-border': 'rgba(94, 240, 138, 0.2)',
            'gt-accent-2': '#a9f7c1',
            'gt-glass-bg': 'rgba(8, 20, 14, 0.82)',
            'gt-glass-border': 'rgba(94, 240, 138, 0.24)',
            'gt-glass-blur': '4px',
            'gt-crt-opacity': '0.07',
            'gt-tile-gap': '9px',
            'font-display': '"VT323", "Courier New", monospace',
            'font-ui': '"Segoe UI", "Helvetica Neue", sans-serif',
            'gt-icon-stroke': '2',
            'gt-icon-linecap': 'butt',
            'gt-icon-linejoin': 'miter',
            'gt-icon-fill': 'none',
            'gt-icon-fill-opacity': '0',
        },
    },
]

PRESET_SLUGS = tuple(preset['slug'] for preset in PRESET_THEMES)
PRESET_BY_SLUG = {preset['slug']: preset for preset in PRESET_THEMES}


def era_for_theme(slug: str | None) -> str:
    """Play-room / UI atmosphere id for a theme folder slug."""
    key = (slug or '').strip() or 'default'
    if key == 'default':
        return DEFAULT_ERA
    preset = PRESET_BY_SLUG.get(key)
    if preset:
        return str(preset.get('era') or DEFAULT_ERA)
    return DEFAULT_ERA


def theme_picker_groups(choices) -> list[dict]:
    """Group Preferences theme choices into decade rooms, colour cabinets, uploads.

    *choices* is the WTForms ``(value, label)`` list. Unknown / uploaded slugs
    land in Installed so the picker still covers every installed folder.
    """
    groups = {
        'decade': {
            'id': 'decade',
            'label': 'Decade rooms',
            'hint': 'The room you started in — same scenery language as browser play.',
            'items': [],
        },
        'cabinet': {
            'id': 'cabinet',
            'label': 'Colour cabinets',
            'hint': 'Palette packs that still sit in an era room, not a flat colour.',
            'items': [],
        },
        'installed': {
            'id': 'installed',
            'label': 'Installed',
            'hint': 'Themes uploaded on this server.',
            'items': [],
        },
    }
    for value, label in choices:
        slug = str(value)
        name = str(label)
        preset = PRESET_BY_SLUG.get(slug)
        if slug == 'default':
            groups['cabinet']['items'].append({
                'slug': slug,
                'name': name,
                'description': 'System default — wood den scenery, green glass.',
                'era': DEFAULT_ERA,
                'icon_pack': 'outline',
            })
            continue
        if preset:
            gid = str(preset.get('group') or 'cabinet')
            if gid not in groups:
                gid = 'installed'
            groups[gid]['items'].append({
                'slug': slug,
                'name': name,
                'description': str(preset.get('description') or ''),
                'era': str(preset.get('era') or DEFAULT_ERA),
                'icon_pack': preset_icon_pack(preset),
            })
            continue
        groups['installed']['items'].append({
            'slug': slug,
            'name': name,
            'description': 'Uploaded theme.',
            'era': DEFAULT_ERA,
            'icon_pack': '',
        })
    return [group for group in (groups['decade'], groups['cabinet'], groups['installed']) if group['items']]


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
    tokens['gt-era'] = str(preset.get('era') or DEFAULT_ERA)
    for name, value in _system_geometry(str(preset.get('slug') or '')).items():
        tokens[name] = value
    return tokens


def _system_geometry(slug: str) -> dict:
    """Per-preset radius / space / type / shadow — the system visual language.

    Colour and icon stroke already live on each preset's ``tokens`` dict.
    These keys are what made packs read as tint-only: nothing overrode the
    shared scales. Slugs stay stable (preference keys); geometry is the pack.
    """
    packs = {
        'aurora': {
            'gt-radius-xs': '0px',
            'gt-radius-sm': '0px',
            'gt-radius-md': '2px',
            'gt-radius-lg': '2px',
            'gt-radius-xl': '4px',
            'gt-radius-2xl': '4px',
            'gt-radius-3xl': '4px',
            'gt-space-4': '0.5rem',
            'gt-space-5': '0.65rem',
            'gt-font-base': '0.95rem',
            'gt-shadow-md': '0 2px 0 rgba(0, 0, 0, 0.55)',
            'gt-motion-base': '80ms',
        },
        'ember': {
            'gt-radius-xs': '6px',
            'gt-radius-sm': '8px',
            'gt-radius-md': '12px',
            'gt-radius-lg': '16px',
            'gt-radius-xl': '20px',
            'gt-radius-2xl': '24px',
            'gt-radius-3xl': '28px',
            'gt-space-5': '1.05rem',
            'gt-shadow-md': '0 8px 24px rgba(0, 0, 0, 0.5)',
            'gt-shadow-lg': '0 18px 40px rgba(0, 0, 0, 0.55)',
        },
        'violet': {
            'gt-radius-xs': '8px',
            'gt-radius-sm': '10px',
            'gt-radius-md': '14px',
            'gt-radius-lg': '18px',
            'gt-radius-xl': '22px',
            'gt-radius-2xl': '28px',
            'gt-radius-3xl': '32px',
            'gt-space-5': '1.15rem',
            'gt-shadow-md': '0 6px 20px rgba(20, 10, 40, 0.45)',
        },
        'forest': {
            'gt-radius-xs': '0px',
            'gt-radius-sm': '0px',
            'gt-radius-md': '0px',
            'gt-radius-lg': '0px',
            'gt-radius-xl': '0px',
            'gt-radius-2xl': '0px',
            'gt-radius-3xl': '0px',
            'gt-space-4': '0.45rem',
            'gt-space-5': '0.7rem',
            'gt-font-base': '0.92rem',
            'gt-shadow-sm': 'none',
            'gt-shadow-md': 'none',
            'gt-motion-base': '90ms',
        },
        'ocean': {
            'gt-radius-xs': '4px',
            'gt-radius-sm': '6px',
            'gt-radius-md': '10px',
            'gt-radius-lg': '12px',
            'gt-radius-xl': '14px',
            'gt-radius-2xl': '18px',
            'gt-radius-3xl': '22px',
            'gt-space-5': '1rem',
            'gt-shadow-md': '0 4px 16px rgba(0, 20, 48, 0.4)',
        },
        'rose': {
            'gt-radius-xs': '6px',
            'gt-radius-sm': '8px',
            'gt-radius-md': '12px',
            'gt-radius-lg': '14px',
            'gt-radius-xl': '16px',
            'gt-radius-2xl': '20px',
            'gt-radius-3xl': '24px',
            'gt-space-4': '0.55rem',
            'gt-space-5': '0.85rem',
            'gt-font-lg': '1.05rem',
        },
        'mono': {
            'gt-radius-xs': '0px',
            'gt-radius-sm': '0px',
            'gt-radius-md': '0px',
            'gt-radius-lg': '0px',
            'gt-radius-xl': '0px',
            'gt-radius-2xl': '0px',
            'gt-radius-3xl': '0px',
            'gt-space-2': '0.3rem',
            'gt-space-5': '0.8rem',
            'gt-shadow-sm': 'none',
            'gt-shadow-md': 'none',
            'gt-shadow-lg': 'none',
            'gt-font-base': '0.9rem',
        },
        'sunset': {
            'gt-radius-xs': '4px',
            'gt-radius-sm': '8px',
            'gt-radius-md': '14px',
            'gt-radius-lg': '18px',
            'gt-radius-xl': '22px',
            'gt-radius-2xl': '26px',
            'gt-radius-3xl': '30px',
            'gt-font-2xl': '1.65rem',
            'gt-shadow-md': '0 8px 20px rgba(40, 20, 0, 0.5)',
            'gt-shadow-lg': '0 20px 44px rgba(40, 16, 0, 0.55)',
        },
        'ice': {
            'gt-radius-xs': '10px',
            'gt-radius-sm': '14px',
            'gt-radius-md': '18px',
            'gt-radius-lg': '22px',
            'gt-radius-xl': '26px',
            'gt-radius-2xl': '32px',
            'gt-radius-3xl': '36px',
            'gt-space-5': '1.2rem',
            'gt-space-6': '1.75rem',
            'gt-font-base': '1.05rem',
            'gt-shadow-sm': '0 1px 8px rgba(120, 180, 220, 0.18)',
            'gt-shadow-md': '0 8px 28px rgba(10, 30, 50, 0.35)',
        },
        'era-80s': {
            'gt-radius-xs': '0px',
            'gt-radius-sm': '2px',
            'gt-radius-md': '2px',
            'gt-radius-lg': '4px',
            'gt-radius-xl': '4px',
            'gt-radius-2xl': '4px',
            'gt-radius-3xl': '6px',
            'gt-space-4': '0.5rem',
            'gt-space-5': '0.7rem',
            'gt-font-base': '0.95rem',
            'gt-shadow-md': '0 2px 0 rgba(0, 0, 0, 0.55)',
            'gt-motion-base': '80ms',
        },
        'era-90s': {
            'gt-radius-xs': '4px',
            'gt-radius-sm': '6px',
            'gt-radius-md': '10px',
            'gt-radius-lg': '14px',
            'gt-radius-xl': '18px',
            'gt-radius-2xl': '22px',
            'gt-radius-3xl': '26px',
            'gt-space-5': '1rem',
            'gt-shadow-md': '0 8px 22px rgba(40, 16, 48, 0.48)',
        },
        'era-late90s': {
            'gt-radius-xs': '3px',
            'gt-radius-sm': '6px',
            'gt-radius-md': '10px',
            'gt-radius-lg': '12px',
            'gt-radius-xl': '16px',
            'gt-radius-2xl': '20px',
            'gt-radius-3xl': '24px',
            'gt-shadow-md': '0 6px 18px rgba(16, 12, 32, 0.5)',
        },
        'era-00s': {
            'gt-radius-xs': '6px',
            'gt-radius-sm': '8px',
            'gt-radius-md': '12px',
            'gt-radius-lg': '16px',
            'gt-radius-xl': '20px',
            'gt-radius-2xl': '24px',
            'gt-radius-3xl': '28px',
            'gt-space-5': '1.05rem',
            'gt-shadow-md': '0 6px 20px rgba(8, 20, 40, 0.42)',
        },
        'era-arcade': {
            'gt-radius-xs': '2px',
            'gt-radius-sm': '4px',
            'gt-radius-md': '8px',
            'gt-radius-lg': '12px',
            'gt-radius-xl': '16px',
            'gt-radius-2xl': '20px',
            'gt-radius-3xl': '24px',
            'gt-space-4': '0.5rem',
            'gt-shadow-md': '0 8px 24px rgba(40, 0, 20, 0.55)',
            'gt-shadow-lg': '0 18px 40px rgba(40, 0, 24, 0.6)',
        },
        'era-desk': {
            'gt-radius-xs': '0px',
            'gt-radius-sm': '0px',
            'gt-radius-md': '0px',
            'gt-radius-lg': '0px',
            'gt-radius-xl': '0px',
            'gt-radius-2xl': '0px',
            'gt-radius-3xl': '0px',
            'gt-space-4': '0.45rem',
            'gt-space-5': '0.7rem',
            'gt-font-base': '0.92rem',
            'gt-shadow-sm': 'none',
            'gt-shadow-md': 'none',
            'gt-motion-base': '90ms',
        },
    }
    return packs.get(slug, {})


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


def preset_needs_rebuild(
    target: str, preset: dict, fingerprint: str, source_root: str | None = None
) -> bool:
    """True when the preset on disk was generated from a different source.

    ``source_root`` is optional and only widens the check: given one, a preset
    is also stale when the source ships avatars that the target is missing.
    Without it the avatars are ignored entirely, which is what keeps a source
    tree with no ``avatars/`` folder from looking permanently stale.
    """
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
    required = list(PRESET_MANAGED_FILES)

    # Same argument for the avatars — the sync skips those too — but only for
    # the ones the source could actually regenerate. Asking for a file the
    # generator will not write is how a rebuild loop starts.
    if source_root and os.path.isdir(os.path.join(source_root, 'avatars')):
        required += [
            rel
            for rel in PRESET_AVATAR_FILES
            if os.path.isfile(os.path.join(source_root, *rel.split('/')))
        ]

    return any(
        not os.path.isfile(os.path.join(target, *rel.split('/')))
        for rel in required
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
    era: str = DEFAULT_ERA,
    group: str = 'cabinet',
) -> None:
    payload = {
        'name': name,
        'author': 'GameTheca',
        'description': description,
        'version': '1.0.0',
        'release_date': date.today().isoformat(),
        'default_icon_pack': icon_pack,
        'era': era,
        'group': group,
        PRESET_MARKER_KEY: {
            'slug': slug,
            'generator': GENERATOR_VERSION,
            'source': fingerprint,
            'icon_pack': icon_pack,
            'era': era,
            'group': group,
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


def _write_preset_avatars(source_root: str, target: str, preset: dict) -> None:
    """Recolour the shipped avatars into this preset's palette.

    Substitution rather than templating, because the source files are plain art
    with three known colours and no markup we control — see the palette note at
    the top of this module.

    A missing source folder is not an error: an install that predates the themed
    avatars keeps serving the ones under `static/newstyle/avatars/`, which is
    what `avatar_url` falls back to.
    """
    source_dir = os.path.join(source_root, 'avatars')
    if not os.path.isdir(source_dir):
        return

    tokens = preset_tokens(preset)
    replacements = (
        (AVATAR_SOURCE_ACCENT, tokens.get('gt-accent') or AVATAR_SOURCE_ACCENT),
        (AVATAR_SOURCE_PANEL, tokens.get('gt-surface') or AVATAR_SOURCE_PANEL),
        (AVATAR_SOURCE_MUTED, tokens.get('gt-text-muted') or AVATAR_SOURCE_MUTED),
    )

    target_dir = os.path.join(target, 'avatars')
    os.makedirs(target_dir, exist_ok=True)

    for name in AVATAR_FILES:
        source_file = os.path.join(source_dir, name)
        if not os.path.isfile(source_file):
            continue
        with open(source_file, 'r', encoding='utf-8') as fh:
            svg = fh.read()
        for source_colour, themed in replacements:
            # Case-insensitively, because SVG hex is case-free and the source
            # files are hand-edited art.
            svg = re.sub(re.escape(source_colour), themed, svg, flags=re.IGNORECASE)
        with open(os.path.join(target_dir, name), 'w', encoding='utf-8') as fh:
            fh.write(svg)


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
        era=str(preset.get('era') or DEFAULT_ERA),
        group=str(preset.get('group') or 'cabinet'),
    )
    _write_preset_base_css(target, preset)
    _write_preset_tokens_css(source_root, target, preset)
    _write_preset_avatars(source_root, target, preset)


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

        if force or preset_needs_rebuild(target, preset, fingerprint, default_source):
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
        written += sync_theme_tree(default_source, target, protected=PRESET_PROTECTED_FILES)
    return written
