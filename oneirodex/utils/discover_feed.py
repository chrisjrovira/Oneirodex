"""Feed assembly — which rows make the page, and who gets each title.

This is the stage the old ``if/elif`` chain had nowhere to put. Selecting rows
one at a time can decide what a row contains, but not whether the page has too
many rows, and not whether the row above already showed the same title. Both
questions need a point where every row is visible at once. This is it.

Two rules run together rather than in sequence, because they interact: dedupe
can thin a row below the point where it is worth showing, which drops it, which
frees a slot the budget can give to a row that missed the cut. Running them as
separate passes leaves holes in the feed.

Ordering is deliberately **not** re-derived here. Every row reaches this module
through a ``DiscoverySection`` whose ``display_order`` an admin arranged on the
Discovery Sections screen, and quietly re-sorting by an internal priority would
make that screen a lie. What this stage decides is *inclusion*, not sequence.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Sequence

#: Rows on the page. The ceiling exists so that later, generated rows compete
#: for a finite page rather than extending it.
FEED_ROW_CAP = 20

#: Reserved blocks at the top. Both are capped so neither side can starve the
#: other: an admin keeps a dependable announcement position, and a member's
#: pins can never be pushed below the fold on their own home page.
MAX_ADMIN_FORCED = 3
MAX_MEMBER_PINS = 3

#: At most this many rows from any one capped family.
FAMILY_CAP = 4

#: Families the diversity cap applies to — the ones the *system* generates.
#:
#: Rows a person configured are exempt on purpose. Every row today comes from a
#: section an admin arranged and can hide, and silently dropping the sixth zone
#: they curated would be the feed overruling them. The cap exists for what
#: Phase 5 generates, where nobody chose the sixth row.
CAPPED_FAMILIES = frozenset({'ml', 'genre'})


@dataclass
class AssembledRow:
    """A row that made the page, with the titles it kept."""

    row: object
    games: list
    #: Titles this row claimed, so the row endpoint can exclude them elsewhere.
    claimed: list[str]


def _uuid(game) -> str | None:
    return getattr(game, 'uuid', None)


def order_candidates(rows, *, forced: Sequence[str] = (), pinned: Sequence[str] = ()):
    """Rows in the sequence the budget considers them.

    Reserved blocks first — admin-forced, then member pins — and everything else
    in the order the admin arranged. A row named in a reserved block is not
    considered twice.
    """
    by_identifier = {row.identifier: row for row in rows}
    ordered = []
    taken = set()

    for identifier in list(forced)[:MAX_ADMIN_FORCED]:
        row = by_identifier.get(identifier)
        if row is not None and identifier not in taken:
            ordered.append(row)
            taken.add(identifier)

    for identifier in list(pinned)[:MAX_MEMBER_PINS]:
        row = by_identifier.get(identifier)
        if row is not None and identifier not in taken:
            ordered.append(row)
            taken.add(identifier)

    for row in rows:
        if row.identifier not in taken:
            ordered.append(row)
            taken.add(row.identifier)

    return ordered


def assemble(
    rows,
    selected: dict,
    *,
    window: int,
    cap: int = FEED_ROW_CAP,
    forced: Sequence[str] = (),
    pinned: Sequence[str] = (),
) -> list[AssembledRow]:
    """Pick the rows that make the page and strip titles already shown above.

    ``selected`` maps a row identifier to the games it selected, deepest-first.
    ``window`` is how many tiles a row actually renders — see the note on
    claiming below.
    """
    # Reserved rows get no dedupe exemption — they are simply considered first,
    # which means they claim their titles first and win them. Nothing else is
    # needed, and a special case here would have to guess how many reserved
    # entries actually resolved to a row.
    ordered = order_candidates(rows, forced=forced, pinned=pinned)

    seen: set[str] = set()
    family_counts: Counter = Counter()
    admitted: list[AssembledRow] = []

    for row in ordered:
        if len(admitted) >= cap:
            break

        family = row.spec.family
        if family in CAPPED_FAMILIES and family_counts[family] >= FAMILY_CAP:
            continue

        candidates = list(selected.get(row.identifier, []))
        # An exempt row neither filters nor claims: what the member is playing
        # right now belongs on that row whether or not it appears elsewhere, and
        # claiming it would strip the charts of exactly the titles most likely
        # to be in them.
        exempt = row.spec.dedupe_mode == 'exempt'

        if exempt:
            kept = candidates
        else:
            kept = [game for game in candidates if _uuid(game) not in seen]

            # A row thinned *by dedupe* below the point where it is worth
            # showing is dropped. A row that was always that short is not —
            # that is a curated three-game zone, and hiding it would be the
            # feed overruling whoever built it.
            floor = getattr(row.spec, 'min_fill', 1) or 1
            if len(kept) < floor <= len(candidates):
                continue

        claimed = [uuid for uuid in (_uuid(game) for game in kept[:window]) if uuid]
        if not exempt:
            # A row claims what it *renders*, not everything it could reach by
            # scrolling. Claiming the full depth would let the first two rows
            # empty a modest library, and the complaint dedupe answers is about
            # visible repetition. Scrolling one row deeply can still reach a
            # title another row showed; that is the deliberate trade.
            seen.update(claimed)

        family_counts[family] += 1
        admitted.append(AssembledRow(row=row, games=kept, claimed=claimed))

    return admitted


def manifest_from(assembled: Iterable[AssembledRow]) -> dict[str, list[str]]:
    """What each row claimed, for the cached feed manifest.

    Without this the dedupe above is cosmetic: the moment a member scrolls a row
    far enough to fetch its next window, the server has forgotten what the rows
    above it showed and hands back the duplicates that were just removed.
    """
    return {entry.row.identifier: list(entry.claimed) for entry in assembled}


def excluded_for(manifest: dict, identifier: str) -> set[str]:
    """Titles other rows already claimed, which ``identifier`` should skip."""
    excluded: set[str] = set()
    for row_identifier, uuids in (manifest or {}).items():
        if row_identifier != identifier:
            excluded.update(uuids)
    return excluded
