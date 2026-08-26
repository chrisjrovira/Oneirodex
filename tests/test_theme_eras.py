"""Decade-room themes: era mapping, picker groups, atmosphere CSS.

Filesystem-only — no app, no database.
"""

from pathlib import Path

from gametheca.utils.play_rooms import ROOMS
from gametheca.utils.preset_themes import (
    DEFAULT_ERA,
    PRESET_THEMES,
    era_for_theme,
    preset_tokens,
    theme_picker_groups,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
THEME_SOURCE = REPO_ROOT / 'gametheca' / 'setup' / 'default_theme'
TEMPLATES = REPO_ROOT / 'gametheca' / 'templates'


def test_default_and_unknown_themes_use_the_wood_den():
    assert era_for_theme('default') == DEFAULT_ERA
    assert era_for_theme('') == DEFAULT_ERA
    assert era_for_theme(None) == DEFAULT_ERA
    assert era_for_theme('some-upload') == DEFAULT_ERA
    assert DEFAULT_ERA in ROOMS


def test_every_preset_names_a_real_play_room():
    for preset in PRESET_THEMES:
        era = era_for_theme(preset['slug'])
        assert era in ROOMS, f"{preset['slug']} era {era} is not a play room"
        assert preset_tokens(preset)['gt-era'] == era


def test_decade_presets_cover_every_play_room():
    decade = {p['era'] for p in PRESET_THEMES if p.get('group') == 'decade'}
    assert decade == set(ROOMS)


def test_picker_groups_decade_rooms_ahead_of_cabinets():
    choices = (
        [('default', 'Default (system)')]
        + [(p['slug'], p['name']) for p in PRESET_THEMES]
        + [('custom-pack', 'Household upload')]
    )
    groups = theme_picker_groups(choices)
    assert [g['id'] for g in groups] == ['decade', 'cabinet', 'installed']
    decade_slugs = {item['slug'] for item in groups[0]['items']}
    assert 'era-80s' in decade_slugs
    assert 'era-90s' in decade_slugs
    cabinet_slugs = {item['slug'] for item in groups[1]['items']}
    assert 'default' in cabinet_slugs
    assert 'aurora' in cabinet_slugs
    assert groups[2]['items'][0]['slug'] == 'custom-pack'


def test_era_css_and_atmosphere_are_wired_into_every_shell():
    era_css = (THEME_SOURCE / 'css' / 'gt-era.css').read_text(encoding='utf-8')
    assert 'html[data-era=' in era_css
    assert '#gt-era-atmosphere' in era_css
    assert 'gt-era-wall-drift' in era_css
    assert '--gt-era-furniture' in era_css
    for room_id in ROOMS:
        assert f"data-era='{room_id}'" in era_css
    blob = ' '.join(ROOMS[r]['label'] + ' ' + ROOMS[r]['blurb'] for r in ROOMS).lower()
    for brand in ('nintendo', 'sega', 'sony', 'playstation', 'xbox', 'atari'):
        assert brand not in blob
        assert brand not in era_css.lower()

    atmosphere = (TEMPLATES / 'partials' / 'era_atmosphere.html').read_text(encoding='utf-8')
    assert 'id="gt-era-atmosphere"' in atmosphere
    assert 'gt-era-stand' in atmosphere
    for name in ('base.html', 'base_admin.html', 'base_empty.html'):
        html = (TEMPLATES / name).read_text(encoding='utf-8')
        assert 'data-era=' in html
        assert 'css/gt-era.css' in html
        assert "partials/era_atmosphere.html" in html
        assert html.index('css/gt-shell.css') < html.index('css/gt-era.css')


def test_decade_accents_are_unique():
    accents = [p['btn_primary'].lower() for p in PRESET_THEMES]
    assert len(accents) == len(set(accents))


def test_decade_copy_does_not_name_manufacturers():
    blob = ' '.join(
        f"{p['name']} {p['description']}" for p in PRESET_THEMES
    ).lower()
    for brand in ('nintendo', 'sega', 'sony', 'playstation', 'xbox', 'atari'):
        assert brand not in blob
