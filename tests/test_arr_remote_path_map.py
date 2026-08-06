"""Remote path mapping for the arr → hardlink pipeline.

The bug this closes: qBittorrent normally runs in its own container and reports
paths from *its* mounts. GameTheca stats those paths directly, finds nothing,
and reports "no source file found" — technically true, thoroughly unhelpful,
and it makes the hardlink pipeline look broken when the file is right there.
"""

from __future__ import annotations

import os

import pytest

from gametheca.utils.arr_hardlink_pipeline import map_remote_path, parse_remote_path_map


class TestParsing:
    def test_parses_pairs(self):
        pairs = parse_remote_path_map('/downloads=>/storage/dl|/data=>/mnt/data')
        assert ('/downloads', '/storage/dl') in pairs
        assert ('/data', '/mnt/data') in pairs

    def test_longest_remote_prefix_first(self):
        """A more specific mapping must win over a shorter one that also matches."""
        pairs = parse_remote_path_map('/data=>/mnt/a|/data/torrents=>/mnt/b')
        assert pairs[0][0] == '/data/torrents'

    def test_ignores_junk_without_separator(self):
        assert parse_remote_path_map('nonsense|/a=>/b') == [('/a', '/b')]

    def test_empty_and_none_are_no_mapping(self):
        assert parse_remote_path_map('') == []
        assert parse_remote_path_map(None) == []

    def test_windows_paths_survive_because_separator_is_not_colon(self):
        pairs = parse_remote_path_map(r'D:\dl=>Z:\library')
        assert pairs == [(r'D:\dl', r'Z:\library')]


class TestMapping:
    def test_rewrites_prefix(self):
        pairs = [('/downloads', '/storage/dl')]
        assert map_remote_path('/downloads/Game/x.iso', pairs) == os.path.join(
            '/storage/dl', 'Game', 'x.iso')

    def test_exact_prefix_match_maps_to_root(self):
        assert map_remote_path('/downloads', [('/downloads', '/storage/dl')]) == '/storage/dl'

    def test_does_not_match_a_partial_directory_name(self):
        """/downloads must not match /downloads-old — the prefix ends at a separator."""
        pairs = [('/downloads', '/storage/dl')]
        assert map_remote_path('/downloads-old/x.iso', pairs) == '/downloads-old/x.iso'

    def test_unmapped_path_is_returned_unchanged(self):
        """Single-container installs need no mapping and must be unaffected."""
        assert map_remote_path('/elsewhere/x', [('/downloads', '/storage')]) == '/elsewhere/x'

    def test_no_mappings_is_a_passthrough(self):
        assert map_remote_path('/downloads/x', []) == '/downloads/x'

    def test_empty_path_is_safe(self):
        assert map_remote_path('', [('/a', '/b')]) == ''

    def test_trailing_slashes_do_not_break_matching(self):
        pairs = parse_remote_path_map('/downloads/=>/storage/dl/')
        assert map_remote_path('/downloads/Game/x.iso', pairs) == os.path.join(
            '/storage/dl', 'Game', 'x.iso')

    def test_backslash_client_paths_match_forward_slash_config(self):
        """qBittorrent on Windows reports backslashes; config may use either."""
        pairs = [('D:/dl', '/mnt/dl')]
        assert map_remote_path(r'D:\dl\Game\x.iso', pairs) == os.path.join(
            '/mnt/dl', 'Game', 'x.iso')

    def test_first_matching_pair_wins_by_specificity(self):
        pairs = parse_remote_path_map('/data=>/mnt/a|/data/torrents=>/mnt/b')
        assert map_remote_path('/data/torrents/x', pairs) == os.path.join('/mnt/b', 'x')
        assert map_remote_path('/data/other/x', pairs) == os.path.join('/mnt/a', 'other', 'x')


class TestConfigWiring:
    def test_reads_config_when_no_mappings_passed(self, app):
        with app.app_context():
            app.config['ARR_REMOTE_PATH_MAP'] = '/downloads=>/storage/dl'
            assert map_remote_path('/downloads/x.iso') == os.path.join('/storage/dl', 'x.iso')

    def test_unset_config_is_a_passthrough(self, app):
        with app.app_context():
            app.config['ARR_REMOTE_PATH_MAP'] = ''
            assert map_remote_path('/downloads/x.iso') == '/downloads/x.iso'
