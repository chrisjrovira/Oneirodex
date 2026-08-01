"""W20-1b: CSV/JSON leaf library import preview (never auto-creates)."""

import os

from gametheca.utils.import_leaf_libraries import (
    preview_from_csv,
    preview_from_json,
    preview_import_rows,
    validate_import_row,
)
from gametheca.utils.propose_leaf_libraries import is_family_parent_name


def test_good_switch_json_row(tmp_path):
    leaf = tmp_path / 'NINTENDO' / 'Switch'
    leaf.mkdir(parents=True)
    path = str(leaf)

    result = preview_from_json(
        [{
            'path': path,
            'suggested_name': 'Nintendo Switch',
            'platform': 'SWITCH',
            'scan_mode': 'folders',
            'scan_depth': 1,
        }],
        allowed_bases=[str(tmp_path)],
    )

    assert result['auto_create'] is False
    assert result['error_count'] == 0
    assert result['count'] == 1
    c = result['candidates'][0]
    assert c['platform'] == 'SWITCH'
    assert c['scan_mode'] == 'folders'
    assert c['scan_depth'] == 1
    assert c['suggested_name'] == 'Nintendo Switch'
    assert os.path.normcase(c['path']) == os.path.normcase(os.path.normpath(path))
    # Module must never expose Library create
    import gametheca.utils.import_leaf_libraries as mod
    assert not hasattr(mod, 'Library')


def test_reject_family_parent(tmp_path):
    family = tmp_path / 'NINTENDO'
    family.mkdir()
    assert is_family_parent_name('NINTENDO')

    candidate, error = validate_import_row(
        {
            'path': str(family),
            'name': 'Nintendo mega',
            'platform': 'SWITCH',
            'scan_mode': 'folders',
            'scan_depth': 1,
        },
        index=0,
        allowed_bases=[str(tmp_path)],
    )
    assert candidate is None
    assert error is not None
    assert error['code'] == 'family_parent_rejected'

    result = preview_import_rows(
        [{'path': str(family), 'platform': 'SWITCH'}],
        allowed_bases=[str(tmp_path)],
    )
    assert result['auto_create'] is False
    assert result['count'] == 0
    assert result['error_count'] == 1
    assert result['errors'][0]['code'] == 'family_parent_rejected'


def test_reject_bad_platform(tmp_path):
    leaf = tmp_path / 'Switch'
    leaf.mkdir()

    result = preview_from_json(
        [{
            'path': str(leaf),
            'name': 'Bad Platform Lib',
            'platform': 'NOT_A_REAL_PLATFORM',
            'scan_mode': 'folders',
            'scan_depth': 1,
        }],
        allowed_bases=[str(tmp_path)],
    )
    assert result['auto_create'] is False
    assert result['count'] == 0
    assert result['error_count'] == 1
    assert result['errors'][0]['code'] == 'invalid_platform'


def test_reject_path_outside_allowed_bases(tmp_path):
    inside = tmp_path / 'allowed'
    inside.mkdir()
    leaf = inside / 'Switch'
    leaf.mkdir()
    outside = tmp_path / 'outside' / 'Switch'
    outside.mkdir(parents=True)

    result = preview_from_json(
        [
            {'path': str(leaf), 'platform': 'SWITCH', 'scan_mode': 'folders', 'scan_depth': 1},
            {'path': str(outside), 'platform': 'SWITCH', 'scan_mode': 'folders', 'scan_depth': 1},
        ],
        allowed_bases=[str(inside)],
    )
    assert result['auto_create'] is False
    assert result['count'] == 1
    assert result['error_count'] == 1
    assert result['errors'][0]['code'] == 'path_outside_allowed_bases'
    assert result['candidates'][0]['platform'] == 'SWITCH'


def test_csv_switch_and_family_mixed(tmp_path):
    switch = tmp_path / 'Switch'
    switch.mkdir()
    family = tmp_path / 'Sony'
    family.mkdir()

    csv_text = (
        'path,suggested_name,platform,scan_mode,scan_depth\n'
        f'{switch},Nintendo Switch,SWITCH,folders,1\n'
        f'{family},Sony Family,PSX,folders,1\n'
        f'{switch},Broken,FAKE_PLAT,folders,1\n'
    )
    result = preview_from_csv(csv_text, allowed_bases=[str(tmp_path)])
    assert result['auto_create'] is False
    assert result['count'] == 1
    assert result['candidates'][0]['platform'] == 'SWITCH'
    codes = {e['code'] for e in result['errors']}
    assert 'family_parent_rejected' in codes
    assert 'invalid_platform' in codes
