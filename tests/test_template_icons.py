"""
Template-level checks for the shared inline SVG icon set.

These render templates/partials/icons.html through a bare Jinja environment,
so they need neither a Flask app nor a database and stay fast.
"""

import re
from pathlib import Path
from xml.etree import ElementTree

import pytest
from jinja2 import Environment, FileSystemLoader

from gametheca.routes_admin_ext.settings import SETTINGS_SHELL_SECTIONS

TEMPLATE_ROOT = Path(__file__).resolve().parents[1] / 'gametheca' / 'templates'

# Templates converted to the SVG macro set by WP3. Other admin templates still
# use the Font Awesome webfont on purpose and are deliberately not asserted on.
CONVERTED_TEMPLATES = [
    'base.html',
    'admin/admin_settings_shell.html',
    'admin/admin_dashboard.html',
]

# Rendered only when icon() is handed a name it does not know. Matched in full
# because several real glyphs also use r="2" circles.
FALLBACK_GLYPH = '<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>'


@pytest.fixture(scope='module')
def icon():
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_ROOT)))
    return env.get_template('partials/icons.html').module.icon


def read_template(relative_path):
    return (TEMPLATE_ROOT / relative_path).read_text(encoding='utf-8')


class TestIconMacro:
    """The macro itself: shape, theming, and graceful failure."""

    def test_mirrors_the_member_spa_svg_contract(self, icon):
        svg = icon('library')
        assert 'stroke="currentColor"' in svg
        assert 'stroke-width="2"' in svg
        assert 'viewBox="0 0 24 24"' in svg
        assert 'fill="none"' in svg
        assert 'class="gt-icon"' in svg

    def test_pins_no_colour_of_its_own(self, icon):
        """Every glyph must inherit the theme via currentColor."""
        for name in ('discover', 'palette', 'robot', 'more'):
            svg = icon(name)
            assert 'color:' not in svg
            assert not re.search(r'#[0-9a-fA-F]{3,6}', svg)

    def test_decorative_by_default_labelled_on_request(self, icon):
        assert 'aria-hidden="true"' in icon('user')
        labelled = icon('user', title='Profile')
        assert 'role="img"' in labelled
        assert 'aria-label="Profile"' in labelled
        assert '<title>Profile</title>' in labelled

    def test_size_is_caller_controlled(self, icon):
        assert 'width="18"' in icon('cogs')
        assert 'width="28"' in icon('cogs', size=28)

    def test_extra_class_is_appended_not_replaced(self, icon):
        assert 'class="gt-icon user-expand-icon"' in icon('chevron-up', extra_class='user-expand-icon')

    def test_unknown_name_degrades_to_a_dot(self, icon):
        svg = icon('definitely-not-an-icon')
        assert svg.startswith('<svg')
        assert FALLBACK_GLYPH in svg


class TestIconCoverage:
    """Every name the templates ask for must actually exist."""

    def test_every_defined_glyph_is_well_formed_svg(self, icon):
        source = (TEMPLATE_ROOT / 'partials' / 'icons.html').read_text(encoding='utf-8')
        names = sorted({
            name
            for branch in re.findall(r"name (?:==|in) ([^\n]+?)\s*-%\}", source)
            for name in re.findall(r"'([a-z0-9-]+)'", branch)
        })
        assert names, 'could not find any icon branches to check'
        for name in names:
            root = ElementTree.fromstring(str(icon(name)))
            assert len(root), f"{name} renders an empty <svg>"
            assert root.get('stroke') == 'currentColor'

    def test_settings_sections_all_resolve(self, icon):
        missing = [
            key for key, section in SETTINGS_SHELL_SECTIONS.items()
            if FALLBACK_GLYPH in icon(section['icon'])
        ]
        assert not missing, f"Sections falling back to the placeholder glyph: {missing}"

    def test_literal_icon_names_in_converted_templates_all_resolve(self, icon):
        unknown = set()
        for relative_path in CONVERTED_TEMPLATES:
            for name in re.findall(r"icons\.icon\(\s*'([^']+)'", read_template(relative_path)):
                if FALLBACK_GLYPH in icon(name):
                    unknown.add((relative_path, name))
        assert not unknown, f"Unknown icon names: {sorted(unknown)}"


class TestConvertedTemplates:
    """Regression guards for the WP3 conversion."""

    def test_no_font_awesome_left_in_converted_templates(self):
        offenders = [p for p in CONVERTED_TEMPLATES if 'fas fa-' in read_template(p)]
        assert not offenders, f"Font Awesome markup still present in: {offenders}"

    def test_base_html_does_not_hardcode_icon_colour(self):
        assert 'color: white' not in read_template('base.html')

    def test_sidebar_ids_the_inline_js_depends_on_survive(self):
        base = read_template('base.html')
        for required in ('id="sidebar"', 'id="content"', 'id="toggleSidebar"',
                         'id="userAccountIcon"', 'id="userAccountMenu"',
                         'id="preferencesModalContainer"'):
            assert required in base, f"base.html lost {required}, which its inline JS queries"

    def test_sidebar_hook_classes_survive_the_icon_swap(self, icon):
        """These moved onto SVG elements, so check the rendered class attribute."""
        base = read_template('base.html')
        for hook in ('user-expand-icon', 'icon-chevron'):
            assert f"extra_class='{hook}'" in base, f"base.html no longer emits .{hook}"
            assert f'class="gt-icon {hook}"' in icon('chevron-up', extra_class=hook)

    def test_settings_shell_has_no_second_vertical_nav(self):
        shell = read_template('admin/admin_settings_shell.html')
        assert 'settings-shell-nav' not in shell
        assert 'settings-shell-layout' not in shell

    def test_health_widget_ids_survive_on_the_dashboard(self):
        dashboard = read_template('admin/admin_dashboard.html')
        for required in ('id="gt-health-summary"', 'id="gt-health-worst"',
                         'id="gt-health-library"', 'id="gt-health-refresh"',
                         'id="gt-health-updated"', 'id="gt-library-health-widget"'):
            assert required in dashboard, f"admin_dashboard.html lost {required}"
