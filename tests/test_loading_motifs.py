"""Generated loading-motif catalogue must match LibraryPlatform."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_loading_motifs_catalogue_is_current():
    result = subprocess.run(
        [sys.executable, str(ROOT / 'scripts' / 'gen_loading_motifs.py'), '--check'],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, (result.stdout + result.stderr)
