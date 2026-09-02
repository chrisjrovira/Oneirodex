"""The slot budget and cross-row dedupe.

Pure logic over row specs and candidate lists, so these run without a database.
That is deliberate: this is the stage with the most behaviour per line in the
whole feed, and it should be cheap enough to test exhaustively.
"""

from types import SimpleNamespace

import pytest

from oneirodex.utils.discover_feed import (
    CAPPED_FAMILIES,
    FAMILY_CAP,
    FEED_ROW_CAP,
    MAX_ADMIN_FORCED,
    MAX_MEMBER_PINS,
    assemble,
    excluded_for,
    manifest_from,
    order_candidates,
)


def game(uuid):
    return SimpleNamespace(uuid=uuid)


def row(identifier, *, family='chart', dedupe_mode='pool', min_fill=4, item_kind='games'):
    return SimpleNamespace(
        identifier=identifier,
        spec=SimpleNamespace(
            identifier=identifier,
            family=family,
            dedupe_mode=dedupe_mode,
            min_fill=min_fill,
            item_kind=item_kind,
        ),
    )


def games(*uuids):
    return [game(u) for u in uuids]


def kept_uuids(assembled, identifier):
    for entry in assembled:
        if entry.row.identifier == identifier:
            return [g.uuid for g in entry.games]
    return None


class TestSlotBudget:
    def test_caps_the_page(self):
        rows = [row(f'r{i}') for i in range(40)]
        selected = {r.identifier: games(*[f'{r.identifier}-{n}' for n in range(10)]) for r in rows}

        assembled = assemble(rows, selected, window=5)

        assert len(assembled) == FEED_ROW_CAP

    def test_a_shorter_feed_is_left_alone(self):
        rows = [row(f'r{i}') for i in range(3)]
        selected = {r.identifier: games(*[f'{r.identifier}-{n}' for n in range(10)]) for r in rows}

        assembled = assemble(rows, selected, window=5)

        assert len(assembled) == 3

    def test_admin_order_is_not_second_guessed(self):
        """Rows arrive in the order an admin arranged; inclusion is decided here,
        sequence is not. Re-sorting by an internal priority would make the
        Discovery Sections screen a lie."""
        rows = [row('c'), row('a'), row('b')]
        selected = {r.identifier: games(f'{r.identifier}-1') for r in rows}

        assembled = assemble(rows, selected, window=5)

        assert [e.row.identifier for e in assembled] == ['c', 'a', 'b']


class TestReservedBlocks:
    def test_forced_rows_lead(self):
        rows = [row('a'), row('b'), row('forced')]

        ordered = order_candidates(rows, forced=['forced'])

        assert ordered[0].identifier == 'forced'

    def test_member_pins_follow_forced_rows(self):
        rows = [row('a'), row('pinned'), row('forced')]

        ordered = order_candidates(rows, forced=['forced'], pinned=['pinned'])

        assert [r.identifier for r in ordered[:2]] == ['forced', 'pinned']

    def test_an_admin_cannot_take_more_than_their_share(self):
        """Capped so a member's pins can never be pushed below the fold."""
        forced = [f'f{i}' for i in range(10)]
        rows = [row(i) for i in forced] + [row('pinned')]

        ordered = order_candidates(rows, forced=forced, pinned=['pinned'])

        assert ordered[MAX_ADMIN_FORCED].identifier == 'pinned'

    def test_a_member_cannot_pin_more_than_three(self):
        pinned = [f'p{i}' for i in range(10)]
        rows = [row(i) for i in pinned] + [row('tail')]

        ordered = order_candidates(rows, pinned=pinned)

        assert [r.identifier for r in ordered[:MAX_MEMBER_PINS]] == pinned[:MAX_MEMBER_PINS]

    def test_a_row_named_in_a_block_is_not_considered_twice(self):
        rows = [row('a'), row('b')]

        ordered = order_candidates(rows, forced=['a'], pinned=['a'])

        assert [r.identifier for r in ordered] == ['a', 'b']

    def test_an_unknown_pin_is_ignored_rather_than_fatal(self):
        """A pinned row is allowed to stop existing — a genre row can go away."""
        rows = [row('a')]

        ordered = order_candidates(rows, pinned=['gone'])

        assert [r.identifier for r in ordered] == ['a']

    def test_a_pin_that_does_not_resolve_grants_nobody_an_exemption(self):
        """Reserved rows are first, not exempt.

        An earlier version counted reserved *entries* rather than the rows they
        resolved to, so one dead pin silently exempted the first ordinary row
        from dedupe — which would have shown its duplicates and claimed nothing.
        """
        rows = [row('first'), row('second')]
        selected = {
            'first': games('a', 'b', 'c', 'd'),
            'second': games('a', 'b', 'e', 'f', 'g', 'h'),
        }

        assembled = assemble(rows, selected, window=4, pinned=['gone'], forced=['also-gone'])

        assert kept_uuids(assembled, 'first') == ['a', 'b', 'c', 'd']
        assert kept_uuids(assembled, 'second') == ['e', 'f', 'g', 'h']

    def test_a_pinned_row_still_dedupes_it_just_picks_first(self):
        rows = [row('chart'), row('pinned')]
        selected = {
            'chart': games('a', 'b', 'c', 'd', 'e'),
            'pinned': games('a', 'b', 'c', 'd'),
        }

        assembled = assemble(rows, selected, window=4, pinned=['pinned'])

        # Pinned went first, so it took the titles it shares with the chart.
        assert kept_uuids(assembled, 'pinned') == ['a', 'b', 'c', 'd']
        assert kept_uuids(assembled, 'chart') is None or 'a' not in kept_uuids(assembled, 'chart')


class TestDedupe:
    def test_a_later_row_does_not_repeat_an_earlier_one(self):
        rows = [row('first'), row('second')]
        selected = {
            'first': games('a', 'b', 'c', 'd'),
            'second': games('a', 'b', 'e', 'f', 'g', 'h'),
        }

        assembled = assemble(rows, selected, window=4)

        assert kept_uuids(assembled, 'first') == ['a', 'b', 'c', 'd']
        assert kept_uuids(assembled, 'second') == ['e', 'f', 'g', 'h']

    def test_the_row_backfills_from_its_own_depth(self):
        """Dropping a duplicate pulls the next candidate up rather than leaving
        a gap, which is why rows over-fetch."""
        rows = [row('first'), row('second')]
        selected = {
            'first': games('a', 'b', 'c', 'd'),
            'second': games('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'),
        }

        assembled = assemble(rows, selected, window=4)

        assert len(kept_uuids(assembled, 'second')) == 4

    def test_an_exempt_row_neither_filters_nor_claims(self):
        """Continue playing shows what you play, even if it is everywhere else."""
        rows = [
            row('charts'),
            row('continue', dedupe_mode='exempt'),
            row('after'),
        ]
        selected = {
            'charts': games('a', 'b', 'c', 'd'),
            'continue': games('a', 'b'),
            'after': games('a', 'e', 'f', 'g', 'h'),
        }

        assembled = assemble(rows, selected, window=4)

        # It kept the duplicates...
        assert kept_uuids(assembled, 'continue') == ['a', 'b']
        # ...and did not claim anything, so `a` is still only blocked by charts.
        assert 'a' not in kept_uuids(assembled, 'after')
        assert kept_uuids(assembled, 'after') == ['e', 'f', 'g', 'h']

    def test_a_row_starved_by_dedupe_is_dropped(self):
        rows = [row('first'), row('second', min_fill=4)]
        selected = {
            'first': games('a', 'b', 'c', 'd'),
            'second': games('a', 'b', 'c', 'd', 'e'),
        }

        assembled = assemble(rows, selected, window=4)

        assert kept_uuids(assembled, 'second') is None

    def test_a_row_that_was_always_short_is_kept(self):
        """A curated three-game zone is not a starved row. Hiding it would be
        the feed overruling whoever built it."""
        rows = [row('first'), row('curated', min_fill=4)]
        selected = {
            'first': games('x', 'y'),
            'curated': games('a', 'b', 'c'),
        }

        assembled = assemble(rows, selected, window=4)

        assert kept_uuids(assembled, 'curated') == ['a', 'b', 'c']

    def test_dropping_a_starved_row_frees_its_slot(self):
        """The reason the budget and dedupe cannot run as separate passes."""
        rows = [row('first')] + [row(f'dup{i}') for i in range(5)] + [
            row(f'r{i}') for i in range(FEED_ROW_CAP)
        ]
        selected = {'first': games('a', 'b', 'c', 'd')}
        for i in range(5):
            # Entirely duplicates of `first` — every one of these starves.
            selected[f'dup{i}'] = games('a', 'b', 'c', 'd')
        for i in range(FEED_ROW_CAP):
            selected[f'r{i}'] = games(*[f'r{i}-{n}' for n in range(6)])

        assembled = assemble(rows, selected, window=4)

        identifiers = [e.row.identifier for e in assembled]
        assert not any(i.startswith('dup') for i in identifiers)
        # The freed slots went to rows that would otherwise have missed the cut.
        assert len(assembled) == FEED_ROW_CAP

    def test_a_row_claims_what_it_renders_not_its_whole_depth(self):
        """Claiming full depth would let two rows empty a modest library."""
        rows = [row('first'), row('second')]
        selected = {
            'first': games('a', 'b', 'c', 'd', 'e', 'f'),
            'second': games('e', 'f', 'g', 'h'),
        }

        assembled = assemble(rows, selected, window=2)

        # `first` renders a, b — so only those are claimed and e/f stay free.
        assert kept_uuids(assembled, 'second') == ['e', 'f', 'g', 'h']


class TestFamilyDiversity:
    def test_generated_families_are_capped(self):
        family = sorted(CAPPED_FAMILIES)[0]
        rows = [row(f'g{i}', family=family) for i in range(FAMILY_CAP + 4)]
        selected = {r.identifier: games(*[f'{r.identifier}-{n}' for n in range(6)]) for r in rows}

        assembled = assemble(rows, selected, window=4)

        assert len(assembled) == FAMILY_CAP

    def test_configured_rows_are_not_capped(self):
        """Every row today comes from a section an admin arranged and can hide.
        Silently dropping their sixth zone would be the feed overruling them."""
        rows = [row(f'z{i}', family='editorial') for i in range(FAMILY_CAP + 4)]
        selected = {r.identifier: games(*[f'{r.identifier}-{n}' for n in range(6)]) for r in rows}

        assembled = assemble(rows, selected, window=4)

        assert len(assembled) == FAMILY_CAP + 4


class TestManifest:
    def test_records_what_each_row_rendered(self):
        rows = [row('first'), row('second')]
        selected = {
            'first': games('a', 'b', 'c', 'd'),
            'second': games('e', 'f', 'g', 'h'),
        }

        manifest = manifest_from(assemble(rows, selected, window=2))

        assert manifest['first'] == ['a', 'b']
        assert manifest['second'] == ['e', 'f']

    def test_exclusion_covers_other_rows_only(self):
        manifest = {'first': ['a', 'b'], 'second': ['c', 'd']}

        assert excluded_for(manifest, 'second') == {'a', 'b'}

    def test_a_missing_manifest_excludes_nothing(self):
        """A cacheless install still gets a feed; it just loses dedupe on
        pagination, which is a degradation rather than a failure."""
        assert excluded_for({}, 'anything') == set()
        assert excluded_for(None, 'anything') == set()


class TestPathologicalInput:
    def test_a_row_with_no_candidates_does_not_crash_the_feed(self):
        rows = [row('empty'), row('full')]
        selected = {'full': games('a', 'b', 'c', 'd')}

        assembled = assemble(rows, selected, window=4)

        assert kept_uuids(assembled, 'full') == ['a', 'b', 'c', 'd']

    def test_candidates_without_uuids_are_not_claimed(self):
        rows = [row('odd'), row('after')]
        selected = {
            'odd': [SimpleNamespace(uuid=None), SimpleNamespace(uuid=None)],
            'after': games('a', 'b', 'c', 'd'),
        }

        manifest = manifest_from(assemble(rows, selected, window=4))

        assert manifest['odd'] == []
        assert manifest['after'] == ['a', 'b', 'c', 'd']
