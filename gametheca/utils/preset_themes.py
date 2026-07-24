"""Install ~10 selectable UI theme presets derived from the default theme."""

from __future__ import annotations

import json
import os
import re
import shutil
from datetime import date

# Folder slug must match how preferences / theme_asset resolve paths.
PRESET_THEMES = [
    {
        'slug': 'aurora',
        'name': 'Aurora',
        'description': 'Cool cyan accent on deep slate.',
        'btn_primary': '#22d3ee',
        'btn_primary_hover': '#06b6d4',
        'bg_dark_40': 'rgba(10, 24, 32, 0.94)',
        'bg_dark_30': 'rgba(6, 16, 24, 0.97)',
    },
    {
        'slug': 'ember',
        'name': 'Ember',
        'description': 'Warm amber accent for late-night browsing.',
        'btn_primary': '#f59e0b',
        'btn_primary_hover': '#d97706',
        'bg_dark_40': 'rgba(28, 18, 12, 0.94)',
        'bg_dark_30': 'rgba(18, 10, 6, 0.97)',
    },
    {
        'slug': 'violet',
        'name': 'Violet',
        'description': 'Soft violet accent with indigo glass.',
        'btn_primary': '#a78bfa',
        'btn_primary_hover': '#8b5cf6',
        'bg_dark_40': 'rgba(22, 16, 36, 0.94)',
        'bg_dark_30': 'rgba(14, 10, 28, 0.97)',
    },
    {
        'slug': 'forest',
        'name': 'Forest',
        'description': 'Moss green accent and deep woodland tone.',
        'btn_primary': '#4ade80',
        'btn_primary_hover': '#22c55e',
        'bg_dark_40': 'rgba(12, 24, 18, 0.94)',
        'bg_dark_30': 'rgba(8, 16, 12, 0.97)',
    },
    {
        'slug': 'ocean',
        'name': 'Ocean',
        'description': 'Deep blue accent for a calm library feel.',
        'btn_primary': '#3b82f6',
        'btn_primary_hover': '#2563eb',
        'bg_dark_40': 'rgba(10, 18, 36, 0.94)',
        'bg_dark_30': 'rgba(6, 12, 28, 0.97)',
    },
    {
        'slug': 'rose',
        'name': 'Rose',
        'description': 'Muted rose accent on charcoal glass.',
        'btn_primary': '#fb7185',
        'btn_primary_hover': '#f43f5e',
        'bg_dark_40': 'rgba(28, 14, 20, 0.94)',
        'bg_dark_30': 'rgba(18, 8, 14, 0.97)',
    },
    {
        'slug': 'mono',
        'name': 'Mono',
        'description': 'Neutral gray accent — minimal chrome.',
        'btn_primary': '#94a3b8',
        'btn_primary_hover': '#64748b',
        'bg_dark_40': 'rgba(18, 18, 22, 0.94)',
        'bg_dark_30': 'rgba(10, 10, 14, 0.97)',
    },
    {
        'slug': 'sunset',
        'name': 'Sunset',
        'description': 'Coral-orange accent with dusk backgrounds.',
        'btn_primary': '#fb923c',
        'btn_primary_hover': '#f97316',
        'bg_dark_40': 'rgba(32, 16, 12, 0.94)',
        'bg_dark_30': 'rgba(22, 10, 8, 0.97)',
    },
    {
        'slug': 'ice',
        'name': 'Ice',
        'description': 'Pale sky accent on cold navy glass.',
        'btn_primary': '#7dd3fc',
        'btn_primary_hover': '#38bdf8',
        'bg_dark_40': 'rgba(12, 20, 32, 0.94)',
        'bg_dark_30': 'rgba(8, 14, 24, 0.97)',
    },
]


def _replace_css_var(css: str, name: str, value: str) -> str:
    pattern = re.compile(rf'(--{re.escape(name)}:\s*)([^;]+)(;)')
    if not pattern.search(css):
        return css
    return pattern.sub(rf'\g<1>{value}\g<3>', css, count=1)


def _write_theme_json(path: str, *, name: str, description: str) -> None:
    payload = {
        'name': name,
        'author': 'GameTheca',
        'description': description,
        'version': '1.0.0',
        'release_date': date.today().isoformat(),
    }
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, indent=2)
        fh.write('\n')


def install_preset_themes(themes_path: str, default_source: str, *, force: bool = False) -> int:
    """
    Copy default theme into each preset folder and recolor key CSS tokens.

    Returns the number of presets newly installed or refreshed.
    """
    if not os.path.isdir(default_source):
        return 0

    os.makedirs(themes_path, exist_ok=True)
    installed = 0

    for preset in PRESET_THEMES:
        slug = preset['slug']
        target = os.path.join(themes_path, slug)
        theme_json = os.path.join(target, 'theme.json')

        if os.path.exists(theme_json) and not force:
            continue

        if os.path.exists(target):
            shutil.rmtree(target)
        shutil.copytree(default_source, target)

        _write_theme_json(
            theme_json,
            name=preset['name'],
            description=preset['description'],
        )

        base_css_path = os.path.join(target, 'css', 'base.css')
        if os.path.isfile(base_css_path):
            with open(base_css_path, 'r', encoding='utf-8') as fh:
                css = fh.read()
            css = _replace_css_var(css, 'btn-primary', preset['btn_primary'])
            css = _replace_css_var(css, 'btn-primary-hover', preset['btn_primary_hover'])
            css = _replace_css_var(css, 'bg-dark-40', preset['bg_dark_40'])
            css = _replace_css_var(css, 'bg-dark-30', preset['bg_dark_30'])
            with open(base_css_path, 'w', encoding='utf-8') as fh:
                fh.write(css)

        installed += 1

    return installed
