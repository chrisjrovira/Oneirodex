"""Collapse copies of one title across systems into a single browse row.

The grid shows one tile per *row in one library*, so a household keeping Chrono
Trigger on SNES, PC and Switch sees three unrelated tiles. This is the grouping
that makes them one tile, with the copies reachable from the preview's
"Available on" list — which already existed and is the only place they were ever
shown as one title.

**Why title, not id.** `Game.igdb_id` and `Game.slug` are both `unique=True`, so
a cross-platform pair *cannot* share either: the second copy is a different row
with a different (or absent) IGDB id. The normalised title is what those rows
actually have in common. This is the same decision, and the same normalisation,
as `oneirodex.utils.game_editions` — the two must agree, or the tile would
collapse a set the preview then refuses to list. `test_title_grouping.py` pins
that parity.

**Why no migration.** The obvious implementation is a persisted `title_key`
column, and it is not needed: Postgres can compute the key inline, so grouping
happens in the query and pagination stays correct. An index on the expression is
a performance question for later, not a correctness one now.
"""

from __future__ import annotations

from sqlalchemy import case, func

from oneirodex.platform_recency import PLATFORM_LAUNCH_YEAR, platform_rank

#: The one pattern. `game_editions.normalize_title` compiles this for Python and
#: `title_key_expr` hands it to Postgres, so the two cannot drift.
TITLE_KEY_PATTERN = r'[^a-z0-9]+'


def title_key_expr(name_column):
    """SQL for `game_editions.normalize_title`, computed in the database.

    `lower()` then collapse every run of non-alphanumerics to one space, then
    trim — the same three steps, in the same order. Postgres `regexp_replace`
    needs the `g` flag to replace every run rather than only the first, which is
    the one place this is easy to get subtly wrong: without it, "Final Fantasy:
    VII" and "Final Fantasy VII" would not pair.
    """
    return func.trim(
        func.regexp_replace(func.lower(name_column), TITLE_KEY_PATTERN, ' ', 'g')
    )


def platform_rank_case(platform_column):
    """SQL CASE ranking a platform column by hardware recency; higher is newer.

    Built from `PLATFORM_LAUNCH_YEAR` rather than restated, so the table stays
    the single source of truth and `test_platform_recency.py` guards both uses.
    Anything unmatched falls to 0, which is how an unranked platform loses the
    representative slot instead of winning it by accident.
    """
    return case(
        {name: rank for name, rank in PLATFORM_LAUNCH_YEAR.items()},
        value=platform_column,
        else_=0,
    )


def platforms_newest_first(platform_keys) -> list[str]:
    """Distinct platforms ordered newest hardware first, ties alphabetical.

    The order is the payload's promise: the client reads element 0 as "the
    latest system this was released on" and never has to know about ranking.
    Ties are broken by name so a tile does not swap systems between page loads.
    """
    unique = {str(key) for key in (platform_keys or []) if key}
    return sorted(unique, key=lambda key: (-platform_rank(key), key))


def editions_by_title_key(rows) -> dict[str, list[str]]:
    """Group `(title_key, platform_key)` pairs into platforms per title.

    Takes the rows of one bulk lookup for a whole page rather than a query per
    tile: the page is at most `per_page` titles, so this is one extra round trip
    for the grid instead of up to a thousand.
    """
    grouped: dict[str, set[str]] = {}
    for title_key, platform_key in rows:
        if not title_key:
            continue
        grouped.setdefault(str(title_key), set())
        if platform_key:
            grouped[str(title_key)].add(str(platform_key))
    return {key: platforms_newest_first(values) for key, values in grouped.items()}
