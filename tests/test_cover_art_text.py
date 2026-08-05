"""FEAT-D4 — cover title legibility and operator text overrides."""

from __future__ import annotations

import pytest

from gametheca.utils.cover_art_studio import _fit_title_font, render_cover_art


def _portrait_bounds(width=512, height=768):
    """Mirror the sizing the portrait branch computes."""
    short = min(width, height)
    min_title = max(20, short // 14)
    max_title = max(min_title, short // 6)
    pad = max(10, short // 12)
    return min_title, max_title, width - pad * 2


class TestLegibility:
    def test_floor_scales_with_the_canvas(self):
        """A flat 14px floor was ~2.7% of a 512px cover — unreadable once the
        tile is scaled down in the grid."""
        min_title, _, _ = _portrait_bounds()
        assert min_title >= 32

    def test_a_long_title_still_renders_large(self):
        min_title, max_title, max_w = _portrait_bounds()
        font = _fit_title_font(
            'Sid Meiers Civilization VI Gathering Storm Expansion',
            max_w, min_title, max_title,
        )
        # Previously collapsed toward the floor to fit 3 lines.
        assert getattr(font, 'size', 0) >= min_title * 2

    def test_short_title_takes_the_ceiling(self):
        min_title, max_title, max_w = _portrait_bounds()
        font = _fit_title_font('Portal 2', max_w, min_title, max_title)
        assert getattr(font, 'size', 0) == max_title

    def test_never_returns_below_the_floor(self):
        min_title, max_title, max_w = _portrait_bounds()
        font = _fit_title_font('W' * 400, max_w, min_title, max_title)
        assert getattr(font, 'size', 0) >= min_title


class TestOverrides:
    def test_renders_without_overrides(self):
        img = render_cover_art(320, 480, title='Portal 2', system='PC Windows')
        assert img.size == (320, 480)

    def test_headline_override_is_accepted(self):
        img = render_cover_art(
            320, 480, title='Portal 2', system='PC', headline_override='PORTAL II',
        )
        assert img.size == (320, 480)

    def test_blank_headline_override_falls_back_to_the_title(self):
        """An empty override is not an instruction to draw nothing."""
        plain = render_cover_art(320, 480, title='Portal 2', system='PC')
        blank = render_cover_art(
            320, 480, title='Portal 2', system='PC', headline_override='   ',
        )
        assert plain.tobytes() == blank.tobytes()

    def test_empty_subtitle_override_is_honoured(self):
        """'' means no subtitle, which differs from 'not supplied'."""
        with_sub = render_cover_art(320, 480, title='Portal 2', system='PC Windows')
        without = render_cover_art(
            320, 480, title='Portal 2', system='PC Windows', subtitle_override='',
        )
        assert with_sub.tobytes() != without.tobytes()

    def test_title_scale_changes_the_render(self):
        normal = render_cover_art(320, 480, title='Portal 2', system='PC')
        bigger = render_cover_art(320, 480, title='Portal 2', system='PC', title_scale=1.8)
        assert normal.tobytes() != bigger.tobytes()

    def test_absurd_scale_is_clamped_not_obeyed(self):
        """Clamping defends the legibility floor this module exists for."""
        tiny = render_cover_art(320, 480, title='Portal 2', system='PC', title_scale=0.01)
        floor = render_cover_art(320, 480, title='Portal 2', system='PC', title_scale=0.6)
        assert tiny.tobytes() == floor.tobytes()

        huge = render_cover_art(320, 480, title='Portal 2', system='PC', title_scale=99)
        ceiling = render_cover_art(320, 480, title='Portal 2', system='PC', title_scale=2.0)
        assert huge.tobytes() == ceiling.tobytes()

    def test_bad_scale_value_does_not_raise(self):
        img = render_cover_art(320, 480, title='Portal 2', system='PC', title_scale='nonsense')
        assert img.size == (320, 480)
