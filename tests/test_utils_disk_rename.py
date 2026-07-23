"""Tests for disk rename planner (temp dirs, no DB)."""

import os
from pathlib import Path

from sharewarez.utils.disk_rename import (
    apply_rename_template,
    build_rename_plan,
    apply_rename_plan,
    letter_bucket_for_title,
    sanitize_fs_name,
)


def test_sanitize_strips_illegal_chars():
    assert ':' not in sanitize_fs_name('Game: Subtitle?')
    assert sanitize_fs_name('   ') == 'Untitled'


def test_template_title_year():
    assert apply_rename_template('{title} ({year})', title='Barony', year=2015) == 'Barony (2015)'
    assert apply_rename_template('{title}', title="Assassin's Creed Shadows") == "Assassin's Creed Shadows"


def test_letter_bucket_for_title():
    assert letter_bucket_for_title('Sacred 2') == '_s'
    assert letter_bucket_for_title('007 First Light') == '_#'


def test_build_rename_plan_root_only(tmp_path):
    root = tmp_path / '_a' / 'Game [FitGirl Repack]'
    root.mkdir(parents=True)
    plan = build_rename_plan(
        str(root),
        title='Game',
        template='{title}',
        rename_root=True,
        rename_top_level_media=False,
        move_letter_bucket=False,
    )
    assert len(plan) == 1
    assert plan[0]['kind'] == 'root_folder'
    assert plan[0]['to_path'].endswith(os.path.join('_a', 'Game'))


def test_build_rename_plan_with_bucket_move(tmp_path):
    root = tmp_path / '_s' / 'sacred 2 remaster (87880)'
    root.mkdir(parents=True)
    plan = build_rename_plan(
        str(root),
        title='Alan Wake Remastered',
        template='{title}',
        rename_root=True,
        move_letter_bucket=True,
    )
    assert len(plan) == 1
    assert plan[0]['kind'] == 'root_folder'
    normalized = plan[0]['to_path'].replace('\\', '/')
    assert '/_a/Alan Wake Remastered' in normalized


def test_apply_rename_plan_safe(tmp_path):
    base = tmp_path / 'library'
    base.mkdir()
    src = base / 'Old Name'
    src.mkdir()
    dst = base / 'New Name'
    plan = [{'kind': 'root_folder', 'from_path': str(src), 'to_path': str(dst)}]
    results = apply_rename_plan(plan, allowed_bases=[str(tmp_path)])
    assert results[0]['ok'] is True
    assert dst.is_dir()
    assert not src.exists()


def test_apply_rename_plan_rejects_outside_base(tmp_path):
    src = tmp_path / 'in'
    src.mkdir()
    plan = [{'kind': 'root_folder', 'from_path': str(src), 'to_path': r'C:\Windows\Temp\evil'}]
    results = apply_rename_plan(plan, allowed_bases=[str(tmp_path)])
    assert results[0]['ok'] is False
