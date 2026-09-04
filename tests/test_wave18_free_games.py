"""Wave 18 free games — claim links, normalize, sync dedupe (mocked HTTP)."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from oneirodex.utils import free_games as fg


def test_normalize_store_map():
    assert fg.normalize_store('Steam') == 'steam'
    assert fg.normalize_store('Epic Games Store') == 'epic'
    assert fg.normalize_store('Prime Gaming') == 'amazon'
    assert fg.normalize_store('itch.io') == 'itch'
    assert fg.normalize_store('Unknown Portal') == 'other'


def test_claim_links_https_only_without_connection():
    offer = {
        'store': 'steam',
        'claim_url': 'https://store.steampowered.com/app/123/',
    }
    links = fg.claim_links(offer, connected_stores=set())
    assert links['https'] == 'https://store.steampowered.com/app/123/'
    assert links['protocol'] is None


def test_claim_links_steam_protocol_when_connected():
    offer = {
        'store': 'steam',
        'claim_url': 'https://store.steampowered.com/app/123/',
    }
    links = fg.claim_links(offer, connected_stores={'steam'})
    assert links['protocol'] == 'steam://openurl/https://store.steampowered.com/app/123/'


def test_claim_links_epic_protocol_when_connected():
    offer = {
        'store': 'epic',
        'claim_url': 'https://store.epicgames.com/en-US/p/some-game',
    }
    links = fg.claim_links(offer, connected_stores={'epic'})
    assert links['protocol'] == 'com.epicgames.launcher://store/en-US/p/some-game'


def test_fetch_epic_parses_promotions(monkeypatch):
    payload = {
        'data': {
            'Catalog': {
                'searchStore': {
                    'elements': [
                        {
                            'title': 'Free Epic Title',
                            'id': 'epic-1',
                            'productSlug': 'free-epic-title',
                            'description': 'A free game',
                            'keyImages': [
                                {'type': 'OfferImageWide', 'url': 'https://img.example/e-wide.jpg'},
                                {'type': 'OfferImageTall', 'url': 'https://img.example/e-tall.jpg'},
                            ],
                            'promotions': {
                                'promotionalOffers': [
                                    {
                                        'promotionalOffers': [
                                            {
                                                'startDate': '2026-07-01T00:00:00.000Z',
                                                'endDate': '2026-07-08T00:00:00.000Z',
                                                'discountSetting': {'discountPercentage': 0},
                                            }
                                        ]
                                    }
                                ]
                            },
                        },
                        {
                            'title': 'Paid Only',
                            'id': 'epic-2',
                            'productSlug': 'paid',
                            'promotions': {'promotionalOffers': []},
                        },
                    ]
                }
            }
        }
    }
    resp = MagicMock()
    resp.json.return_value = payload
    monkeypatch.setattr(fg, 'request_with_backoff', lambda *a, **k: resp)
    rows = fg.fetch_epic_free_games()
    assert len(rows) == 1
    assert rows[0]['store'] == 'epic'
    assert rows[0]['title'] == 'Free Epic Title'
    assert 'free-epic-title' in rows[0]['claim_url']
    # Discover tiles are 2×3 — tall key art wins over the wide banner.
    assert rows[0]['image_url'] == 'https://img.example/e-tall.jpg'


def test_fetch_gamerpower_filters_games(monkeypatch):
    payload = [
        {
            'id': 10,
            'title': 'GOG Freebie',
            'platforms': 'GOG',
            'status': 'Active',
            'open_giveaway_url': 'https://example.com/claim/gog',
            'description': 'Grab it',
            'worth': '$19.99',
            'thumbnail': 'https://img.example/g-thumb.png',
            'image': 'https://img.example/g-full.png',
            'end_date': '2026-08-01 00:00:00',
        },
        {
            'id': 11,
            'title': 'Expired',
            'platforms': 'Steam',
            'status': 'Expired',
            'open_giveaway_url': 'https://example.com/x',
        },
    ]
    resp = MagicMock()
    resp.json.return_value = payload
    monkeypatch.setattr(fg, 'request_with_backoff', lambda *a, **k: resp)
    rows = fg.fetch_gamerpower_giveaways()
    assert len(rows) == 1
    assert rows[0]['store'] == 'gog'
    assert rows[0]['external_id'] == 'gp-10'
    assert rows[0]['source'] == 'gamerpower'
    assert rows[0]['image_url'] == 'https://img.example/g-full.png'


def test_fetch_steam_100_percent_discount(monkeypatch):
    payload = {
        'specials': {
            'items': [
                {
                    'id': 4242,
                    'name': 'Steam Freebie',
                    'final': 0,
                    'original': 1999,
                    'discount_percent': 100,
                    'header_image': 'https://cdn.example/s.jpg',
                },
                {
                    'id': 99,
                    'name': 'Still paid',
                    'final': 999,
                    'original': 1999,
                    'discount_percent': 50,
                },
            ]
        }
    }
    resp = MagicMock()
    resp.json.return_value = payload
    monkeypatch.setattr(fg, 'request_with_backoff', lambda *a, **k: resp)
    rows = fg.fetch_steam_free_games()
    assert len(rows) == 1
    assert rows[0]['external_id'] == '4242'
    assert rows[0]['store'] == 'steam'


def test_external_app_id_steam():
    assert fg.external_app_id_for_offer({'store': 'steam', 'external_id': '4242', 'claim_url': ''}) == '4242'
    assert fg.external_app_id_for_offer({
        'store': 'steam',
        'external_id': 'gp-9',
        'claim_url': 'https://store.steampowered.com/app/555/',
    }) == '555'


def test_claim_assist_requires_connection(monkeypatch):
    offer = SimpleNamespace(
        store='steam',
        external_id='4242',
        title='Freebie',
        claim_url='https://store.steampowered.com/app/4242/',
        store_url='https://store.steampowered.com/app/4242/',
    )

    class FakeScalars:
        def first(self):
            return None

    class FakeResult:
        def scalars(self):
            return FakeScalars()

    monkeypatch.setattr(
        'oneirodex.db.session.execute',
        lambda *_a, **_k: FakeResult(),
    )
    result = fg.claim_assist_for_user(1, offer)
    assert result['ok'] is False
    assert result.get('needs_connect') is True


def test_dedupe_title_keys_strip_gamerpower_decoration():
    """GamerPower's "(Store) Giveaway" suffix must not read as a new title."""
    assert fg.dedupe_title_keys('Alone With You (Epic Games) Giveaway') & fg.dedupe_title_keys(
        'Alone With You'
    )
    assert fg.dedupe_title_keys("Evan's Remains (Mobile) Giveaway") & fg.dedupe_title_keys(
        "Evan's Remains"
    )
    assert fg.dedupe_title_keys('Superposition [Steam] Giveaway') & fg.dedupe_title_keys(
        'Superposition'
    )
    assert fg.dedupe_title_keys('Some Game - Free PC Giveaway') & fg.dedupe_title_keys('Some Game')


def test_dedupe_title_keys_keep_distinct_titles_apart():
    """Trimming must not fold a sequel or a numbered entry into its base name."""
    assert not fg.dedupe_title_keys('Portal 2') & fg.dedupe_title_keys('Portal')
    assert not fg.dedupe_title_keys('Doom Eternal') & fg.dedupe_title_keys('Doom')
    assert not fg.dedupe_title_keys('Celeste 64') & fg.dedupe_title_keys('Celeste')


def test_collect_remote_offers_drops_gamerpower_repost(monkeypatch):
    monkeypatch.setattr(
        fg,
        'fetch_epic_free_games',
        lambda: [{'store': 'epic', 'title': 'Alone With You'}],
    )
    monkeypatch.setattr(fg, 'fetch_steam_free_games', lambda: [])
    monkeypatch.setattr(
        fg,
        'fetch_gamerpower_giveaways',
        lambda: [
            {'store': 'epic', 'title': 'Alone With You (Epic Games) Giveaway'},
            {'store': 'epic', 'title': 'A Different Game (Epic Games) Giveaway'},
        ],
    )

    by_source = fg.collect_remote_offers()

    assert [o['title'] for o in by_source['epic']] == ['Alone With You']
    assert [o['title'] for o in by_source['gamerpower']] == [
        'A Different Game (Epic Games) Giveaway'
    ]


def test_collect_remote_offers_keeps_offer_on_another_store(monkeypatch):
    """Same title, different store is a different offer — both must survive."""
    monkeypatch.setattr(
        fg,
        'fetch_epic_free_games',
        lambda: [{'store': 'epic', 'title': 'Alone With You'}],
    )
    monkeypatch.setattr(fg, 'fetch_steam_free_games', lambda: [])
    monkeypatch.setattr(
        fg,
        'fetch_gamerpower_giveaways',
        lambda: [{'store': 'gog', 'title': 'Alone With You (GOG) Giveaway'}],
    )

    by_source = fg.collect_remote_offers()

    assert len(by_source['gamerpower']) == 1
