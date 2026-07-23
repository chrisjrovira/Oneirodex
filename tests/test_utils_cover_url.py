"""Unit tests for cover URL resolution (no database required)."""

from unittest.mock import patch

from sharewarez.utils.cover_url import resolve_cover_url


class _FakeImage:
    def __init__(self, url, download_url=None, is_downloaded=False):
        self.url = url
        self.download_url = download_url
        self.is_downloaded = is_downloaded


def _static_url(endpoint, filename=None, **_kwargs):
    assert endpoint == 'static'
    return f'/static/{filename}'


@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_default_when_missing(mock_url_for):
    assert resolve_cover_url(None) == '/static/newstyle/default_cover.jpg'
    assert resolve_cover_url(_FakeImage(url='')) == '/static/newstyle/default_cover.jpg'


@patch('sharewarez.utils.cover_url._local_cover_exists', return_value=False)
@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_uses_download_url_when_not_downloaded(mock_url_for, mock_exists):
    image = _FakeImage(
        url='cover_local.jpg',
        download_url='https://images.igdb.com/cover.jpg',
        is_downloaded=False,
    )
    assert resolve_cover_url(image) == 'https://images.igdb.com/cover.jpg'


@patch('sharewarez.utils.cover_url._local_cover_exists', return_value=True)
@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_local_static_when_downloaded(mock_url_for, mock_exists):
    image = _FakeImage(url='abc.jpg', is_downloaded=True)
    assert resolve_cover_url(image) == '/static/library/images/abc.jpg'


@patch('sharewarez.utils.cover_url._local_cover_exists', return_value=False)
@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_default_for_undownloaded_local_path(mock_url_for, mock_exists):
    image = _FakeImage(url='missing_local.jpg', is_downloaded=False)
    assert resolve_cover_url(image) == '/static/newstyle/default_cover.jpg'


@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_passes_through_http_url(mock_url_for):
    image = _FakeImage(url='https://cdn.example/a.jpg', is_downloaded=False)
    assert resolve_cover_url(image) == 'https://cdn.example/a.jpg'


@patch('sharewarez.utils.cover_url._local_cover_exists', return_value=False)
@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_falls_back_when_downloaded_file_missing(mock_url_for, mock_exists):
    image = _FakeImage(
        url='gone.jpg',
        download_url='//images.igdb.com/igdb/image/upload/t_original/co.jpg',
        is_downloaded=True,
    )
    assert resolve_cover_url(image) == 'https://images.igdb.com/igdb/image/upload/t_original/co.jpg'


@patch('sharewarez.utils.cover_url.url_for', side_effect=_static_url)
def test_resolve_cover_url_normalizes_protocol_relative_primary_url(mock_url_for):
    image = _FakeImage(url='//images.igdb.com/co.jpg', is_downloaded=False)
    assert resolve_cover_url(image) == 'https://images.igdb.com/co.jpg'
