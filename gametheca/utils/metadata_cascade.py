"""Multi-source metadata cascade — keep asking until the core fields are filled.

The problem this closes
-----------------------
Enrichment used to stop after two sources. ``enrich_game_metadata`` tried Steam
then RAWG; the live scan path was narrower still — ``hydrate_game_from_steam``
only ran when a Steam App ID was already known, so a title identified through
**GOG** (or any non-Steam route) landed with whatever thin data the search hit
carried: no summary, no genres, no developer. Meanwhile the codebase already
implemented searches for GOG, Epic, itch, GiantBomb, MobyGames and TheGamesDB —
all reachable from *manual* identify only.

This module walks those sources in order and stops as soon as the title has the
fields that matter.

Three rules it follows
----------------------
* **Exact titles only.** A fuzzy hit would attach some other game's summary to
  this row, which is worse than leaving it blank. Every source is filtered to
  case-insensitive exact name matches, and an ambiguous multi-hit is skipped.
* **Order follows the platform.** A SNES ROM is not on Steam, GOG, Epic or itch;
  querying them costs four round trips per title and can only produce a wrong
  answer. Console libraries go straight to the catalogue databases.
* **Fill, never clobber.** Merging only writes fields that are still empty, so
  an earlier, better source always wins over a later one.

Sources needing an API key already return an empty list when unkeyed, so the
cascade does not special-case them — an unconfigured source is just a miss.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from gametheca.utils.secondary_scrapers import (
    fetch_rawg_data,
    fetch_steam_data,
    merge_metadata,
    missing_core_fields,
    search_epic_games,
    search_giantbomb_games,
    search_gog_games,
    search_itch_games,
    search_mobygames_games,
    search_thegamesdb_games,
)

# Platforms whose titles plausibly exist on a PC storefront. Everything else is
# console/handheld/arcade and goes straight to the catalogue databases.
PC_PLATFORMS = frozenset({'PCWIN', 'PCDOS', 'MAC', 'OTHER', 'LINUX'})

# Store/catalogue ids assert *which product this is*, which is the identify
# path's job. Enrichment fills descriptive content only — see
# ``hydrate_game_from_cascade``.
IDENTITY_FIELDS = frozenset({
    'steam_app_id', 'gog_id', 'mobygames_id', 'thegamesdb_id', 'name',
})


@dataclass(frozen=True)
class SourceSpec:
    """One metadata source.

    ``detail_fn`` returns a normalized metadata dict directly (rich sources with
    a details endpoint). ``search_fn`` returns search hits, which carry less —
    usually a summary and a cover — but are still far better than nothing.
    """

    id: str
    label: str
    detail_fn: Callable[[str], dict | None] | None = None
    search_fn: Callable[..., list[dict]] | None = None


# Richest first within each group; a source that answers early ends the walk.
_STEAM = SourceSpec('steam', 'Steam', detail_fn=fetch_steam_data)
_RAWG = SourceSpec('rawg', 'RAWG', detail_fn=fetch_rawg_data)
_GOG = SourceSpec('gog', 'GOG', search_fn=search_gog_games)
_EPIC = SourceSpec('epic', 'Epic Games Store', search_fn=search_epic_games)
_ITCH = SourceSpec('itch', 'itch.io', search_fn=search_itch_games)
_GIANTBOMB = SourceSpec('giantbomb', 'Giant Bomb', search_fn=search_giantbomb_games)
_MOBYGAMES = SourceSpec('mobygames', 'MobyGames', search_fn=search_mobygames_games)
_THEGAMESDB = SourceSpec('thegamesdb', 'TheGamesDB', search_fn=search_thegamesdb_games)

# PC: storefronts first (they have the title and the marketing copy), then the
# catalogue databases as backstop.
PC_ORDER: tuple[SourceSpec, ...] = (
    _STEAM, _GOG, _EPIC, _ITCH, _GIANTBOMB, _MOBYGAMES, _RAWG, _THEGAMESDB,
)

# Console / handheld / arcade: catalogue databases only. Steam and GOG are
# skipped deliberately — a console ROM matching a PC store listing by exact
# title is far more likely to be a different product than the same one.
CONSOLE_ORDER: tuple[SourceSpec, ...] = (
    _THEGAMESDB, _MOBYGAMES, _GIANTBOMB, _RAWG,
)


def source_order(library_platform: str | None) -> tuple[SourceSpec, ...]:
    """Which sources to try, in order, for this platform."""
    key = (library_platform or '').strip().upper()
    if not key or key in PC_PLATFORMS:
        return PC_ORDER
    return CONSOLE_ORDER


def _casefold(value: str | None) -> str:
    return (value or '').casefold().strip()


def _exact_hits(query: str, hits: list[dict] | None) -> list[dict]:
    needle = _casefold(query)
    if not needle:
        return []
    return [
        hit for hit in (hits or [])
        if isinstance(hit, dict) and _casefold(hit.get('name')) == needle
    ]


def hit_to_metadata(hit: dict) -> dict:
    """Normalize a search hit into our metadata field names.

    Search hits are thin by nature — most carry a summary and a cover and little
    else — so this maps what is there and omits the rest rather than inventing
    empty keys that would look like real misses downstream.
    """
    if not isinstance(hit, dict):
        return {}
    out: dict = {}
    for src_key, dest_key in (
        ('summary', 'summary'),
        ('cover_url', 'cover_url'),
        ('release_date', 'release_date'),
        ('developer', 'developer'),
        ('publisher', 'publisher'),
    ):
        value = hit.get(src_key)
        if value:
            out[dest_key] = value
    genres = hit.get('genres')
    if genres:
        out['genres'] = [g for g in genres if g]
    # Carry store ids so a later identify can link back to where this came from.
    for id_key in ('steam_app_id', 'gog_id', 'mobygames_id', 'thegamesdb_id'):
        if hit.get(id_key):
            out[id_key] = hit[id_key]
    return out


@dataclass
class CascadeTrace:
    """What the walk actually did — so scan logs can be honest about it."""

    queried: list[str] = field(default_factory=list)
    contributed: list[str] = field(default_factory=list)
    skipped_ambiguous: list[str] = field(default_factory=list)
    errored: list[str] = field(default_factory=list)
    stopped_early: bool = False

    def as_dict(self) -> dict:
        return {
            'queried': list(self.queried),
            'contributed': list(self.contributed),
            'skipped_ambiguous': list(self.skipped_ambiguous),
            'errored': list(self.errored),
            'stopped_early': self.stopped_early,
        }


def cascade_metadata(
    game_name: str,
    *,
    seed: dict | None = None,
    library_platform: str | None = None,
    max_sources: int = 6,
) -> tuple[dict, CascadeTrace]:
    """Walk sources until the core fields are filled.

    ``seed`` is metadata already known (e.g. from IGDB); it is never overwritten.
    ``max_sources`` caps outbound requests so one unidentifiable title in a large
    scan cannot fan out into a dozen store calls.

    Returns ``(metadata, trace)``. Never raises: a source that fails is recorded
    and the walk continues, because a metadata miss must not undo an import.
    """
    metadata: dict = dict(seed or {})
    trace = CascadeTrace()

    name = (game_name or '').strip()
    if not name:
        return metadata, trace

    if not missing_core_fields(metadata):
        trace.stopped_early = True
        return metadata, trace

    for spec in source_order(library_platform)[:max_sources]:
        trace.queried.append(spec.id)
        try:
            found: dict | None = None

            if spec.detail_fn is not None:
                found = spec.detail_fn(name)
            elif spec.search_fn is not None:
                exact = _exact_hits(name, spec.search_fn(name, limit=10))
                if len(exact) > 1:
                    # Two different games share this exact title on this source;
                    # picking one would be a coin flip written to the database.
                    trace.skipped_ambiguous.append(spec.id)
                    continue
                if exact:
                    found = hit_to_metadata(exact[0])

            if found:
                before = {k: v for k, v in metadata.items() if v}
                metadata = merge_metadata(metadata, found)
                if any(metadata.get(k) and not before.get(k) for k in found):
                    trace.contributed.append(spec.id)
        except Exception as exc:  # noqa: BLE001
            # Never let one flaky store abort enrichment for the rest.
            trace.errored.append(spec.id)
            print(f"[cascade] {spec.id} failed for {name!r}: {exc}")
            continue

        if not missing_core_fields(metadata):
            trace.stopped_early = True
            break

    return metadata, trace


def hydrate_game_from_cascade(
    game,
    *,
    name: str | None = None,
    library_platform: str | None = None,
    seed: dict | None = None,
    max_sources: int = 6,
) -> dict:
    """Run the cascade for a Game row and apply what it finds.

    Applies through the same fill-don't-clobber mapper the Steam path uses, so
    hand-entered or IGDB-sourced values are never overwritten.

    Returns ``{'applied': report, 'trace': {...}}``; an empty report when there
    was nothing to add. Swallows failures for the same reason the Steam hydrate
    does — identification must survive a metadata miss.
    """
    if game is None:
        return {'applied': {}, 'trace': CascadeTrace().as_dict()}

    title = (name or getattr(game, 'name', '') or '').strip()
    platform = library_platform
    if platform is None:
        platform = getattr(getattr(game, 'library', None), 'platform', None)
        platform = getattr(platform, 'name', platform)

    metadata, trace = cascade_metadata(
        title,
        seed=seed,
        library_platform=platform,
        max_sources=max_sources,
    )
    if not metadata:
        return {'applied': {}, 'trace': trace.as_dict()}

    # Enrichment must not rewrite *identity*. A title identified through GOG
    # would otherwise pick up a Steam App ID (and store URL) merely because the
    # cascade asked Steam for a blurb and got an exact title match — quietly
    # turning a GOG game into a Steam one. Store ids come from the identify
    # path; this pass only fills descriptive content.
    metadata = {k: v for k, v in metadata.items() if k not in IDENTITY_FIELDS}

    try:
        from gametheca.utils.steam_metadata import (
            apply_steam_metadata_to_game,
            parse_steam_release_date,
        )

        # Sources report release dates as strings; the mapper wants a datetime.
        if metadata.get('release_date') and not metadata.get('first_release_date'):
            parsed = parse_steam_release_date(str(metadata['release_date']))
            if parsed is not None:
                metadata['first_release_date'] = parsed

        report = apply_steam_metadata_to_game(game, metadata)
    except Exception as exc:  # noqa: BLE001
        print(f"[cascade] apply failed for {title!r}: {exc}")
        return {'applied': {}, 'trace': trace.as_dict()}

    return {'applied': report, 'trace': trace.as_dict()}
