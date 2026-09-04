"""Which sites gaming headlines come from.

The feed list was a hardcoded tuple, so a household that did not care for one
of the three — or wanted a site of its own — had no say at all.
"""

import pytest

from oneirodex.utils.gaming_news import (
    DEFAULT_FEED_URLS,
    feed_urls,
    source_name,
)


class TestFeedUrls:
    def test_defaults_when_unset(self, monkeypatch):
        monkeypatch.delenv('ONEIRODEX_NEWS_FEEDS', raising=False)
        monkeypatch.delenv('ONEIRODEX_NEWS_FEEDS', raising=False)
        assert feed_urls() == DEFAULT_FEED_URLS

    def test_blank_falls_back_rather_than_disabling_news(self, monkeypatch):
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', '   ')
        assert feed_urls() == DEFAULT_FEED_URLS

    def test_the_env_replaces_the_list_entirely(self, monkeypatch):
        monkeypatch.delenv('ONEIRODEX_NEWS_FEEDS', raising=False)
        monkeypatch.setenv(
            'ONEIRODEX_NEWS_FEEDS',
            'https://example.com/rss, https://two.example/feed',
        )
        assert feed_urls() == ('https://example.com/rss', 'https://two.example/feed')

    def test_oneirodex_prefix_wins(self, monkeypatch):
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', 'https://legacy.example/f')
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', 'https://new.example/f')
        assert feed_urls() == ('https://new.example/f',)

    def test_pipes_work_like_commas(self, monkeypatch):
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', 'https://a.example/f|https://b.example/f')
        assert len(feed_urls()) == 2

    def test_duplicates_collapse(self, monkeypatch):
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', 'https://a.example/f,https://a.example/f')
        assert feed_urls() == ('https://a.example/f',)

    @pytest.mark.parametrize('hostile', [
        'file:///etc/passwd',
        'ftp://example.com/feed',
        'not-a-url',
    ])
    def test_only_http_urls_are_accepted(self, monkeypatch, hostile):
        # The server fetches this list, so a file:// entry would be a read of
        # the server's own disk dressed up as a news source.
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', hostile)
        assert feed_urls() == DEFAULT_FEED_URLS

    def test_a_hostile_entry_does_not_take_the_good_ones_with_it(self, monkeypatch):
        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', 'file:///etc/passwd,https://ok.example/f')
        assert feed_urls() == ('https://ok.example/f',)


class TestSourceName:
    def test_is_the_bare_host(self):
        assert source_name('https://www.polygon.com/rss/index.xml') == 'polygon.com'
        assert source_name('https://rockpapershotgun.com/feed') == 'rockpapershotgun.com'


class TestFeedApi:
    def test_response_lists_the_configured_sources(self, client, db_session, monkeypatch):
        from uuid import uuid4

        from oneirodex.models import User

        monkeypatch.setenv('ONEIRODEX_NEWS_FEEDS', 'https://a.example/f,https://b.example/f')
        suffix = str(uuid4())[:8]
        user = User(
            name=f'reader_{suffix}',
            email=f'reader_{suffix}@example.com',
            password_hash='x',
            role='user',
            user_id=str(uuid4()),
            invite_quota=0,
        )
        user.set_password('a good long password')
        db_session.add(user)
        db_session.commit()

        with client.session_transaction() as session:
            session['_user_id'] = str(user.id)
            session['_fresh'] = True

        body = client.get('/api/news/gaming').get_json()
        # Sources travel with the headlines so a site that is quiet today is
        # still listed — and therefore still switchable — in the UI.
        assert body['sources'] == ['a.example', 'b.example']
