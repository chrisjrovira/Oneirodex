"""WCAG contrast guarantees for the --gt-* semantic status tokens.

The admin stylesheets render status text (scan failed, log level error, server
resource warnings) directly in --od-success/--od-danger/--od-warning/--od-info.
Those tokens live only in the source od-tokens.css and are inherited unchanged
by every preset, so a single value has to stay legible on the darkest and the
lightest surface any preset produces. These tests pin that down: nudging a
token or adding a preset with a lighter surface fails here rather than in a
user's browser.

Filesystem-only — reads the tracked source theme, never the runtime output.
"""

import os
import re

import pytest

from oneirodex.utils.preset_themes import PRESET_THEMES, preset_tokens

SOURCE_TOKENS_CSS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'oneirodex', 'setup', 'default_theme', 'css', 'od-tokens.css',
)

# WCAG 2.1 minimums.
AA_BODY = 4.5
AA_LARGE_AND_UI = 3.0

SEMANTIC_TOKENS = ('od-success', 'od-danger', 'od-warning', 'od-info')


def _srgb_to_linear(channel):
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _rgb(hex_colour):
    h = hex_colour.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def relative_luminance(hex_colour):
    r, g, b = (_srgb_to_linear(c) for c in _rgb(hex_colour))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(foreground, background):
    a, b = relative_luminance(foreground), relative_luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def read_source_tokens():
    """The --gt-* values as declared in the tracked default theme."""
    with open(SOURCE_TOKENS_CSS, 'r', encoding='utf-8') as fh:
        css = fh.read()
    return dict(re.findall(r'--(gt-[a-z0-9-]+)\s*:\s*([^;]+);', css))


def all_surfaces():
    """Every opaque backdrop a token can be painted on.

    The shipped defaults, plus the od-surface-2 each preset derives — that is
    the lightest real backdrop and therefore the worst case for these colours.
    """
    tokens = read_source_tokens()
    surfaces = {
        f'default {name}': tokens[name]
        for name in ('od-bg', 'od-surface', 'od-surface-2')
    }
    for preset in PRESET_THEMES:
        derived = preset_tokens(preset)
        surfaces[f"{preset['slug']} od-surface-2"] = derived['od-surface-2']
        surfaces[f"{preset['slug']} od-bg"] = derived['od-bg']
    return surfaces


class TestContrastHelpers:
    """Guard the maths itself, so a failing assertion below means a real regression."""

    def test_black_on_white_is_maximum_contrast(self):
        assert contrast_ratio('#000000', '#ffffff') == pytest.approx(21.0, abs=0.01)

    def test_identical_colours_have_no_contrast(self):
        assert contrast_ratio('#141820', '#141820') == pytest.approx(1.0, abs=0.001)

    def test_ratio_is_symmetric(self):
        assert contrast_ratio('#5ac8fa', '#141820') == pytest.approx(
            contrast_ratio('#141820', '#5ac8fa')
        )

    def test_shorthand_hex_expands(self):
        assert relative_luminance('#fff') == pytest.approx(relative_luminance('#ffffff'))


class TestSemanticTokensExist:

    @pytest.mark.parametrize('token', SEMANTIC_TOKENS)
    def test_token_is_declared(self, token):
        assert token in read_source_tokens(), (
            f'--{token} is missing from od-tokens.css; the admin stylesheets '
            f'fall back to Bootstrap literals without it.'
        )

    @pytest.mark.parametrize('token', SEMANTIC_TOKENS)
    def test_token_is_a_plain_hex_value(self, token):
        value = read_source_tokens()[token].strip()
        assert re.fullmatch(r'#[0-9a-fA-F]{3,6}', value), (
            f'--{token} is {value!r}; keep it a literal hex so contrast is '
            f'statically checkable.'
        )

    def test_semantic_tokens_are_not_overridden_per_preset(self):
        """Red must stay red. Presets may only retheme surfaces and the accent."""
        for preset in PRESET_THEMES:
            overridden = set(preset_tokens(preset)) & set(SEMANTIC_TOKENS)
            assert not overridden, (
                f"preset {preset['slug']} overrides {sorted(overridden)}; status "
                f'colours are deliberately theme-invariant.'
            )


class TestSemanticTokenContrast:

    @pytest.mark.parametrize('token', SEMANTIC_TOKENS)
    def test_readable_as_body_text_on_every_surface(self, token):
        colour = read_source_tokens()[token].strip()
        failures = [
            (name, surface, round(contrast_ratio(colour, surface), 2))
            for name, surface in all_surfaces().items()
            if contrast_ratio(colour, surface) < AA_BODY
        ]
        assert not failures, (
            f'--{token} ({colour}) drops below {AA_BODY}:1 on: {failures}'
        )

    def test_muted_text_is_readable_on_every_surface(self):
        colour = read_source_tokens()['od-text-muted'].strip()
        for name, surface in all_surfaces().items():
            ratio = contrast_ratio(colour, surface)
            assert ratio >= AA_BODY, f'--od-text-muted on {name}: {ratio:.2f}:1'

    def test_body_text_is_readable_on_every_surface(self):
        colour = read_source_tokens()['od-text'].strip()
        for name, surface in all_surfaces().items():
            ratio = contrast_ratio(colour, surface)
            assert ratio >= AA_BODY, f'--od-text on {name}: {ratio:.2f}:1'

    @pytest.mark.parametrize('token', SEMANTIC_TOKENS)
    def test_distinguishable_from_body_text(self, token):
        """A status colour that reads as ordinary text conveys nothing."""
        colour = read_source_tokens()[token].strip()
        body = read_source_tokens()['od-text'].strip()
        assert colour.lower() != body.lower()


class TestAccentContrast:
    """--od-accent-contrast is the label colour on accent-filled buttons."""

    def test_default_accent_pairs_with_its_contrast_token(self):
        tokens = read_source_tokens()
        ratio = contrast_ratio(tokens['od-accent-contrast'].strip(),
                               tokens['od-accent'].strip())
        assert ratio >= AA_BODY, f'default accent pair is only {ratio:.2f}:1'

    @pytest.mark.parametrize('preset', PRESET_THEMES, ids=lambda p: p['slug'])
    def test_each_preset_accent_pairs_with_its_contrast_token(self, preset):
        derived = preset_tokens(preset)
        ratio = contrast_ratio(derived['od-accent-contrast'], derived['od-accent'])
        assert ratio >= AA_LARGE_AND_UI, (
            f"{preset['slug']}: {derived['od-accent-contrast']} on "
            f"{derived['od-accent']} is only {ratio:.2f}:1"
        )
