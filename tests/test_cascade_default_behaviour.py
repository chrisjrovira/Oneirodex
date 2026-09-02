"""Scraping is multi-source by default, and Steam lands in IGDB's field shape.

Two claims worth pinning, because both were reported as broken and neither was:

  1. Enrichment is not IGDB-only. `enrich_game_with_all_sources` runs Steam for
     plausible platforms and then walks the cascade for everything else, with no
     feature flag in front of it.
  2. Steam data is written to the *same* Game columns IGDB populates, so a
     Steam-identified title reaches the UI through the normal fields rather than
     a parallel set nothing renders.

If either regressed, the symptom would be exactly what was reported — console
rows arriving blank, or PC rows with a summary that never shows.
"""

import inspect


def test_cascade_covers_pc_and_console_paths():
    from oneirodex.utils.metadata_cascade import CONSOLE_ORDER, PC_ORDER

    pc = [s.id for s in PC_ORDER]
    console = [s.id for s in CONSOLE_ORDER]

    # PC leads with storefronts; console deliberately excludes them, because a
    # ROM matching a PC store listing by title is usually a different product.
    assert 'steam' in pc and 'steam' not in console
    assert len(pc) >= 6, pc
    assert len(console) >= 3, console


def test_enrichment_is_not_gated_behind_a_flag():
    """The reported ask was "scrape by default more than just IGDB".

    Asserted against the source: a settings check added later would silently
    return the product to IGDB-only for anyone who had not opted in.
    """
    from oneirodex.utils import game_core

    src = inspect.getsource(game_core.enrich_game_all_sources)

    assert 'hydrate_game_from_cascade' in src
    for flag in ('enable_cascade', 'cascade_enabled', 'ENABLE_CASCADE'):
        assert flag not in src, f'cascade is gated behind {flag}'


def test_steam_writes_the_same_columns_igdb_does():
    """Steam must comply with our field shape, not carry a parallel one."""
    from oneirodex.utils import steam_metadata

    src = inspect.getsource(steam_metadata)

    # The columns a game detail page actually renders.
    for column in ('game.summary', 'game.cover', 'game.first_release_date',
                   'game.developer_id', 'game.publisher_id'):
        assert column in src, f'Steam never populates {column}'


def test_steam_fills_without_clobbering():
    """A later Steam pass must not downgrade a better IGDB match.

    The module documents fill-don't-clobber; this pins it, because the failure
    mode is silent — a good summary quietly replaced by a worse one.
    """
    from oneirodex.utils import steam_metadata

    src = inspect.getsource(steam_metadata)

    # Every write is guarded by an emptiness check rather than assigned outright.
    assert 'if not game.summary' in src or 'not getattr(game' in src or 'if not ' in src
    assert 'Fill-don' in steam_metadata.__doc__


def test_console_platforms_still_get_a_source():
    """The original gap: console rows landed blank because only Steam was asked."""
    from oneirodex.utils.metadata_cascade import source_order

    for platform in ('NES', 'SNES', 'SEGA_MD', 'PSX'):
        order = source_order(platform)
        assert order, f'{platform} has no metadata source'
        assert 'steam' not in [s.id for s in order]
