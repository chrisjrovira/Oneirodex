"""Multi-source metadata cascade.

Every source here is monkeypatched — these tests must never touch the network.
What matters is the *walk*: which sources get asked, in what order, when it
stops, and what it refuses to guess.
"""

from __future__ import annotations

import pytest

from gametheca.utils import metadata_cascade as mc


def _hit(name, **extra):
    return {'source': 'test', 'name': name, **extra}


@pytest.fixture
def spy(monkeypatch):
    """Record which sources were queried, and control what each returns."""
    calls: list[str] = []
    responses: dict[str, object] = {}

    def make_search(source_id):
        def _search(name, limit=10):
            calls.append(source_id)
            value = responses.get(source_id, [])
            if isinstance(value, Exception):
                raise value
            return value
        return _search

    def make_detail(source_id):
        def _detail(name, *args, **kwargs):
            calls.append(source_id)
            value = responses.get(source_id)
            if isinstance(value, Exception):
                raise value
            return value
        return _detail

    patched = {
        'steam': ('_STEAM', make_detail('steam'), 'detail_fn'),
        'rawg': ('_RAWG', make_detail('rawg'), 'detail_fn'),
        'gog': ('_GOG', make_search('gog'), 'search_fn'),
        'epic': ('_EPIC', make_search('epic'), 'search_fn'),
        'itch': ('_ITCH', make_search('itch'), 'search_fn'),
        'giantbomb': ('_GIANTBOMB', make_search('giantbomb'), 'search_fn'),
        'mobygames': ('_MOBYGAMES', make_search('mobygames'), 'search_fn'),
        'thegamesdb': ('_THEGAMESDB', make_search('thegamesdb'), 'search_fn'),
    }

    import dataclasses

    for source_id, (attr, fn, field_name) in patched.items():
        original = getattr(mc, attr)
        monkeypatch.setattr(mc, attr, dataclasses.replace(original, **{field_name: fn}))

    # Rebuild the order tuples so they hold the patched specs.
    monkeypatch.setattr(mc, 'PC_ORDER', (
        mc._STEAM, mc._GOG, mc._EPIC, mc._ITCH,
        mc._GIANTBOMB, mc._MOBYGAMES, mc._RAWG, mc._THEGAMESDB,
    ))
    monkeypatch.setattr(mc, 'CONSOLE_ORDER', (
        mc._THEGAMESDB, mc._MOBYGAMES, mc._GIANTBOMB, mc._RAWG,
    ))

    return {'calls': calls, 'responses': responses}


COMPLETE = {
    'summary': 'A complete blurb.',
    'genres': ['Action'],
    'developer': 'Some Studio',
}


class TestWalkOrder:
    def test_stops_as_soon_as_core_fields_are_filled(self, spy):
        spy['responses']['steam'] = dict(COMPLETE)
        metadata, trace = mc.cascade_metadata('Thing', library_platform='PCWIN')

        assert metadata['summary'] == 'A complete blurb.'
        assert trace.stopped_early is True
        # The whole point: nothing after the source that answered gets asked.
        assert spy['calls'] == ['steam']

    def test_keeps_going_when_a_source_misses(self, spy):
        spy['responses']['steam'] = None
        spy['responses']['gog'] = []
        spy['responses']['epic'] = [_hit('Thing', **COMPLETE)]

        metadata, trace = mc.cascade_metadata('Thing', library_platform='PCWIN')

        assert metadata['summary'] == 'A complete blurb.'
        assert spy['calls'] == ['steam', 'gog', 'epic']
        assert trace.contributed == ['epic']

    def test_walks_every_source_when_none_answer(self, spy):
        metadata, trace = mc.cascade_metadata('Nothing', library_platform='PCWIN')

        assert metadata == {}
        assert trace.contributed == []
        # Capped at max_sources, not the full list.
        assert len(spy['calls']) == 6

    def test_max_sources_caps_outbound_requests(self, spy):
        mc.cascade_metadata('Nothing', library_platform='PCWIN', max_sources=2)
        assert spy['calls'] == ['steam', 'gog']


class TestPlatformAwareOrder:
    def test_console_never_queries_pc_storefronts(self, spy):
        """A SNES ROM is not on Steam; asking can only cost time or mislead."""
        mc.cascade_metadata('Some ROM', library_platform='SNES')

        for pc_only in ('steam', 'gog', 'epic', 'itch'):
            assert pc_only not in spy['calls']
        assert spy['calls'][0] == 'thegamesdb'

    def test_pc_asks_steam_first(self, spy):
        mc.cascade_metadata('Some Game', library_platform='PCWIN')
        assert spy['calls'][0] == 'steam'

    def test_unknown_platform_uses_the_pc_order(self, spy):
        mc.cascade_metadata('Some Game', library_platform=None)
        assert spy['calls'][0] == 'steam'

    @pytest.mark.parametrize('platform', ['PCWIN', 'PCDOS', 'MAC', 'OTHER'])
    def test_pc_family_platforms_all_use_pc_order(self, platform):
        assert mc.source_order(platform) is mc.PC_ORDER

    @pytest.mark.parametrize('platform', ['SNES', 'PSX', 'SEGA_MD', 'ARCADE', 'GBA'])
    def test_console_platforms_all_use_console_order(self, platform):
        assert mc.source_order(platform) is mc.CONSOLE_ORDER


class TestRefusesToGuess:
    def test_ambiguous_exact_titles_are_skipped_not_picked(self, spy):
        """Two different games with the same title — choosing is a coin flip."""
        spy['responses']['steam'] = None
        spy['responses']['gog'] = [
            _hit('Thing', summary='First one'),
            _hit('Thing', summary='Second one'),
        ]
        metadata, trace = mc.cascade_metadata('Thing', library_platform='PCWIN')

        assert 'summary' not in metadata
        assert 'gog' in trace.skipped_ambiguous
        assert 'gog' not in trace.contributed

    def test_fuzzy_hits_are_ignored(self, spy):
        """A near match would attach another game's blurb to this row."""
        spy['responses']['steam'] = None
        spy['responses']['gog'] = [_hit('Thing 2: Revenge', summary='Sequel blurb')]

        metadata, _ = mc.cascade_metadata('Thing', library_platform='PCWIN')
        assert 'summary' not in metadata

    def test_match_is_case_insensitive(self, spy):
        spy['responses']['steam'] = None
        spy['responses']['gog'] = [_hit('THING', summary='Right one')]

        metadata, _ = mc.cascade_metadata('thing', library_platform='PCWIN')
        assert metadata['summary'] == 'Right one'

    def test_blank_name_queries_nothing(self, spy):
        metadata, trace = mc.cascade_metadata('   ', library_platform='PCWIN')
        assert metadata == {}
        assert spy['calls'] == []


class TestResilience:
    def test_a_failing_source_does_not_abort_the_walk(self, spy):
        spy['responses']['steam'] = RuntimeError('store on fire')
        spy['responses']['gog'] = [_hit('Thing', **COMPLETE)]

        metadata, trace = mc.cascade_metadata('Thing', library_platform='PCWIN')

        assert metadata['summary'] == 'A complete blurb.'
        assert trace.errored == ['steam']
        assert trace.contributed == ['gog']

    def test_every_source_failing_returns_the_seed_untouched(self, spy):
        for source in ('steam', 'gog', 'epic', 'itch', 'giantbomb', 'mobygames'):
            spy['responses'][source] = RuntimeError('down')

        metadata, trace = mc.cascade_metadata(
            'Thing', seed={'summary': 'Known'}, library_platform='PCWIN',
        )
        assert metadata == {'summary': 'Known'}
        assert len(trace.errored) == 6


class TestSeedIsAuthoritative:
    def test_seed_values_are_never_overwritten(self, spy):
        spy['responses']['steam'] = {
            'summary': 'Store blurb', 'genres': ['Action'], 'developer': 'Studio',
        }
        metadata, _ = mc.cascade_metadata(
            'Thing', seed={'summary': 'Curated blurb'}, library_platform='PCWIN',
        )
        assert metadata['summary'] == 'Curated blurb'
        # but the gaps still get filled
        assert metadata['developer'] == 'Studio'

    def test_a_complete_seed_queries_nothing_at_all(self, spy):
        metadata, trace = mc.cascade_metadata(
            'Thing', seed=dict(COMPLETE), library_platform='PCWIN',
        )
        assert spy['calls'] == []
        assert trace.stopped_early is True
        assert metadata == COMPLETE


class TestHitMapping:
    def test_maps_the_fields_a_search_hit_carries(self):
        out = mc.hit_to_metadata({
            'name': 'X', 'summary': 'S', 'cover_url': 'C',
            'release_date': '2020', 'thegamesdb_id': 7,
        })
        assert out == {
            'summary': 'S', 'cover_url': 'C',
            'release_date': '2020', 'thegamesdb_id': 7,
        }

    def test_omits_absent_fields_rather_than_writing_empties(self):
        """Empty keys would look like real misses to everything downstream."""
        out = mc.hit_to_metadata({'name': 'X', 'summary': None, 'cover_url': ''})
        assert out == {}

    def test_non_dict_input_is_survivable(self):
        assert mc.hit_to_metadata(None) == {}
        assert mc.hit_to_metadata('nope') == {}


class TestEnrichmentNeverRewritesIdentity:
    """A GOG-identified game must not become a Steam game via enrichment.

    The cascade asks Steam for a blurb; Steam answers with an exact title match
    that carries an App ID. Writing that App ID would silently reassign the
    game's store identity — and stamp a Steam store URL on a GOG title.
    """

    def test_store_ids_are_stripped_before_apply(self, spy, monkeypatch):
        spy['responses']['steam'] = {
            'summary': 'Blurb', 'genres': ['RPG'], 'developer': 'Studio',
            'steam_app_id': 292030,
        }

        applied: dict = {}

        class FakeGame:
            name = 'The Witcher 3'
            library = None

        def fake_apply(game, metadata):
            applied.update(metadata)
            return {'summary': True}

        import gametheca.utils.steam_metadata as sm
        monkeypatch.setattr(sm, 'apply_steam_metadata_to_game', fake_apply)

        mc.hydrate_game_from_cascade(FakeGame(), library_platform='PCWIN')

        assert applied['summary'] == 'Blurb'
        assert 'steam_app_id' not in applied
        for identity_key in ('gog_id', 'mobygames_id', 'thegamesdb_id', 'name'):
            assert identity_key not in applied

    def test_identity_fields_still_reach_plain_cascade_callers(self, spy):
        """cascade_metadata itself keeps ids — only the apply step strips them,
        so an identify caller can still use them deliberately."""
        spy['responses']['steam'] = {
            'summary': 'Blurb', 'genres': ['RPG'], 'developer': 'Studio',
            'steam_app_id': 292030,
        }
        metadata, _ = mc.cascade_metadata('Thing', library_platform='PCWIN')
        assert metadata['steam_app_id'] == 292030
