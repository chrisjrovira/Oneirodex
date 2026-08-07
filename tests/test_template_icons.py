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

# Templates converted to the SVG macro set. Every template here must contain
# zero literal Font Awesome class strings (see test_no_font_awesome_left_in_converted_templates).
CONVERTED_TEMPLATES = [
    'base.html',
    'admin/admin_settings_shell.html',
    'admin/admin_dashboard.html',
    'admin/admin_manage_library_create.html',
    'admin/admin_server_status.html',
    'admin/admin_library_tools.html',
    'admin/arr_module.html',
    'admin/admin_manage_smtp_settings.html',
    'admin/detail_layout.html',
    'admin/integrations.html',
    'admin/attract_mode_settings.html',
    'admin/admin_manage_users.html',
    'admin/emulator_profiles.html',
    'admin/admin_manage_downloads.html',
    'admin/admin_manage_whitelist.html',
    'admin/admin_manage_filters.html',
    'admin/quality_profiles.html',
    'admin/admin_help.html',
    'admin/new_server_settings.html',
    'admin/ai_assist.html',
    'admin/admin_game_identify.html',
    'admin/admin_server_logs.html',
    'admin/storage.html',
    'admin/admin_manage_libraries.html',
    'admin/admin_manage_extensions.html',
    'admin/new_server_info.html',
    'admin/admin_discovery_sections.html',
    'games/game_details.html',
    'login/user_invites.html',
    'settings/modal_preferences.html',
    'settings/settings_password.html',
    'settings/settings_profile_edit.html',
    'settings/settings_profile_view.html',
    'partials/integrations/igdb_form.html',
    'partials/integrations/steamgriddb_status.html',
]

# Templates that intentionally still contain a handful of literal Font Awesome
# classes after the SVG conversion. Empty after O11 (local .gt-spinner).
DOCUMENTED_FA_LEFTOVERS = {}

# Matches any literal Font Awesome class pairing, e.g. "fas fa-trash",
# "fa fa-file-alt", "fa-solid fa-cog", "fa-brands fa-github".
FONT_AWESOME_CLASS_RE = re.compile(
    r'fa[srb]?\s+fa-[\w-]+|fa-(?:solid|brands|regular)\s+fa-[\w-]+'
)

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

    def test_no_undocumented_font_awesome_remains_anywhere(self):
        """Every remaining literal FA class in the whole template tree must be
        one of the animated spinners tracked in DOCUMENTED_FA_LEFTOVERS, with
        the exact count we expect. Anything else means a template regressed or
        a new template was added with FA instead of the SVG macro.
        """
        found_counts = {}
        for path in sorted(TEMPLATE_ROOT.rglob('*.html')):
            relative = path.relative_to(TEMPLATE_ROOT).as_posix()
            matches = FONT_AWESOME_CLASS_RE.findall(path.read_text(encoding='utf-8'))
            if matches:
                found_counts[relative] = len(matches)

        assert found_counts == DOCUMENTED_FA_LEFTOVERS, (
            f"Font Awesome usage drifted from the documented leftovers.\n"
            f"Found: {found_counts}\nExpected: {DOCUMENTED_FA_LEFTOVERS}"
        )

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

    def test_the_dashboard_is_a_react_shell_and_keeps_no_body(self):
        """This replaces a check for `gt-health-*` ids in this template.

        Those ids were real once. Wave 7 moved the dashboard body — library
        health widget included — into admin-app's React `DashboardPage`/
        `OpsPage`, leaving a five-line shell behind, so the old assertion had
        been failing against a template that is *correct*: it was pinning the
        pre-migration structure, and its failure said nothing about health
        widgets, which are covered by `opsWidgets.test.jsx`.

        What is worth pinning here is the shell contract itself. Putting markup
        back into this template would render it underneath the React hub rather
        than replacing it.
        """
        dashboard = read_template('admin/admin_dashboard.html')
        assert '{% block admin_render %}spa{% endblock %}' in dashboard
        body = dashboard.split('{% block content %}', 1)[1].split('{% endblock %}', 1)[0]
        markup = [line for line in body.splitlines() if line.strip() and '{#' not in line]
        assert not markup, f'dashboard shell grew a body again: {markup}'
