"""Tests for true-duplicate vs IGDB-collision classification."""

from types import SimpleNamespace

from oneirodex.utils.duplicate_check import (
    normalize_disk_path,
    should_mark_as_duplicate,
)


def test_normalize_disk_path_slashes():
    a = normalize_disk_path(r'/storage/_a/Alan Wake')
    b = normalize_disk_path(r'/storage/_a/Alan Wake/')
    assert a == b


def test_true_duplicate_same_title():
    existing = SimpleNamespace(
        name='Arizona Sunshine VR',
        full_disk_path='/storage/_a/Arizona Sunshine VR [FitGirl Repack]',
    )
    assert should_mark_as_duplicate(
        existing,
        '/storage/_b/Arizona Sunshine VR',
        'Arizona Sunshine VR',
    )


def test_false_duplicate_complete_collection():
    existing = SimpleNamespace(
        name='Alan Wake',
        full_disk_path='/storage/_a/Alan Wake',
    )
    assert not should_mark_as_duplicate(
        existing,
        '/storage/_a/Alan Wake Complete Collection',
        'Alan Wake Complete Collection',
    )


def test_false_duplicate_unrelated_vr_bundle():
    existing = SimpleNamespace(
        name='Some Other Game',
        full_disk_path='/storage/_z/Some Other Game',
    )
    assert not should_mark_as_duplicate(
        existing,
        '/storage/_a/ALL IN ONE ADVENTURE VR',
        'ALL IN ONE ADVENTURE VR',
    )
