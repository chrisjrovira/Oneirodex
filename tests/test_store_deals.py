"""Deep-discount Discover row (CheapShark, read-only)."""

from __future__ import annotations

from oneirodex.utils import store_deals


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def test_list_deep_discount_articles_keeps_steep_savings_and_skips_owned(monkeypatch):
    store_deals._cache['at'] = 0.0
    store_deals._cache['rows'] = []

    payload = [
        {
            'dealID': 'a1',
            'title': 'Owned Steam Hit',
            'storeID': '1',
            'savings': '90.0',
            'salePrice': '1.99',
            'normalPrice': '19.99',
            'steamAppID': '42',
            'thumb': 'https://example.test/a.jpg',
        },
        {
            'dealID': 'b2',
            'title': 'Deep Cut Adventure',
            'storeID': '7',
            'savings': '80.0',
            'salePrice': '2.00',
            'normalPrice': '10.00',
            'steamAppID': None,
            'thumb': 'https://example.test/b.jpg',
        },
        {
            'dealID': 'c3',
            'title': 'Mild Sale',
            'storeID': '1',
            'savings': '20.0',
            'salePrice': '8.00',
            'normalPrice': '10.00',
            'steamAppID': '99',
            'thumb': None,
        },
    ]
    monkeypatch.setattr(
        store_deals,
        'request_with_backoff',
        lambda *args, **kwargs: _FakeResponse(payload),
    )
    monkeypatch.setattr(
        store_deals,
        '_owned_keys',
        lambda _user: ({('steam', '42')}, {'owned steam hit'}),
    )

    articles = store_deals.list_deep_discount_articles(object(), limit=10)
    assert len(articles) == 1
    assert articles[0]['kind'] == 'deal'
    assert articles[0]['title'] == 'Deep Cut Adventure'
    assert articles[0]['store'] == 'gog'
    assert articles[0]['savings'] == 80
    assert articles[0]['href'].startswith('https://www.cheapshark.com/redirect?dealID=')


def test_store_deals_row_is_registered():
    from oneirodex.utils.discover_providers import _REGISTRY

    assert 'store_deals' in _REGISTRY
    spec, _selector = _REGISTRY['store_deals']
    assert spec.item_kind == 'articles'
