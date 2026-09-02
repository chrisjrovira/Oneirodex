"""Source-scan guards for classic theme JS and the member library grid.

Theme JS only reaches the browser after Reset Themes copies
``setup/default_theme`` into ``static/library/themes``. These tests read the
*source* so a regression is caught in CI even when the served copy is stale.

See docs/admin/themes-reset.md.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME_JS = ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'js'
MEMBER_SRC = ROOT / 'frontend' / 'member-app' / 'src'


def test_scan_tab_uses_href_selector_not_a_hardcoded_tab_id():
    src = (THEME_JS / 'admin_manage_scanjobs.js').read_text(encoding='utf-8')
    assert 'function showScanTab' in src
    assert "querySelector('#autoScan-tab')" not in src
    assert '[data-bs-toggle="tab"][href="' in src


def test_scan_jobs_poll_patches_progress_instead_of_wiping_the_table():
    """A live scan changes processed/percentage every tick. Folding that into
    the skip-if-identical guard meant the table never skipped, so Libraries
    & scans froze while the main thread rebuilt every row (and the unmatched
    list, even on the Libraries pane)."""
    src = (THEME_JS / 'admin_manage_scanjobs.js').read_text(encoding='utf-8')
    assert "from './scanJobsDom.js'" in src
    assert 'scanJobsStructureSignature' in src
    assert 'patchScanJobProgressRows' in src
    assert 'isScanPaneActive' in src
    helpers = (THEME_JS / 'scanJobsDom.js').read_text(encoding='utf-8')
    assert 'export function scanJobsStructureSignature' in helpers
    assert 'export function scanJobsPollMs' in helpers


def test_game_edit_images_does_not_interpolate_urls_into_innerhtml():
    src = (THEME_JS / 'game_edit_images.js').read_text(encoding='utf-8')
    assert 'src="${data.url}"' not in src
    assert 'onclick="deleteImage(${data.image_id})"' not in src
    assert 'function buildEditorImageNode' in src


def test_library_game_grid_stays_auto_fill():
    src = (MEMBER_SRC / 'components' / 'GameGrid.css').read_text(encoding='utf-8')
    assert re.search(r'repeat\(\s*auto-fill', src), (
        'library grid must keep CSS auto-fill (multiline repeat() still counts)'
    )
    assert 'do NOT change this to auto-fit' in src
