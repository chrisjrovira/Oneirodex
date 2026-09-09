"""Scan orchestration (thin re-export shim).

Historically a ~1084-line root module; the scan worker, schedule math, queue
drain/fail helpers and the auto/manual scan Flask form handlers moved to
``oneirodex/utils/services/scan_orchestration.py`` in wave A2.3. Every
``from oneirodex.utilities import X`` still resolves through the star re-export
below, and every attribute a test patches as ``oneirodex.utilities.<name>`` is
still reachable here.
"""
from oneirodex import db  # noqa: F401  -- re-export: `patch('oneirodex.utilities.db.*')`

from oneirodex.utils.services.scan_orchestration import *  # noqa: F401,F403
from oneirodex.utils.services.scan_orchestration import __all__  # noqa: F401

# Incidental module-level names the old module exposed; kept so existing
# ``patch('oneirodex.utilities.<name>')`` call sites keep resolving even though
# the code that reads them now lives in services/scan_orchestration.py.
import os  # noqa: F401
from flask import current_app, flash, redirect, url_for, session  # noqa: F401
from oneirodex.utils.security import is_safe_path, get_allowed_base_directories  # noqa: F401
from oneirodex.utils.scanning import is_scan_job_running  # noqa: F401
from oneirodex.utils.gamenames import get_game_names_from_folder, get_game_names_from_files  # noqa: F401
from oneirodex.utils.helpers.scan_filters import load_scanning_filter_patterns  # noqa: F401
from oneirodex.utils.services.game_delete import remove_from_lib  # noqa: F401
