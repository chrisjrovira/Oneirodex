"""Ops path issues must not treat Unraid RO games mounts as bad."""
from gametheca.utils.ops_summary import _path_problems


def test_games_ro_mount_is_not_a_path_problem():
    problems = _path_problems(
        {
            'DATA_FOLDER_GAMES': {
                'path': '/storage',
                'exists': True,
                'read': True,
                'write': False,
            },
            'UPLOAD_FOLDER': {
                'path': '/app/gametheca/static/library',
                'exists': True,
                'read': True,
                'write': True,
            },
        }
    )
    assert problems == []


def test_games_missing_still_reported():
    problems = _path_problems(
        {
            'DATA_FOLDER_GAMES': {
                'path': '/storage',
                'exists': False,
                'read': False,
                'write': False,
            }
        }
    )
    assert problems == [{'key': 'DATA_FOLDER_GAMES', 'reason': 'missing'}]


def test_upload_not_writable_is_reported():
    problems = _path_problems(
        {
            'UPLOAD_FOLDER': {
                'path': '/app/gametheca/static/library',
                'exists': True,
                'read': True,
                'write': False,
            }
        }
    )
    assert problems == [{'key': 'UPLOAD_FOLDER', 'reason': 'not writable'}]
