"""The preferences modal script must not bind to elements that do not exist yet.

base.html loads js/preferences_modal.js from <head> and injects the modal markup
only when the user opens Preferences, so any listener attached to #themeSelect
or to an individual swatch at load time attaches to nothing.  The static check
below enforces delegation from `document`; the Node harness proves it end to end
against a DOM where the modal really does arrive after DOMContentLoaded.
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'js' / 'preferences_modal.js'
HARNESS = Path(__file__).parent / 'js' / 'preferences_modal_delegation.test.mjs'

NODE = shutil.which('node')
requires_node = pytest.mark.skipif(NODE is None, reason='node is not installed')


def source() -> str:
    return SCRIPT.read_text(encoding='utf-8')


def test_every_listener_is_delegated_from_document():
    receivers = set(re.findall(r'(\w+)\.addEventListener\(', source()))

    assert receivers == {'document'}, (
        'listeners must hang off document; anything inside the modal is absent '
        'when this file runs'
    )


def test_swatch_handlers_are_not_bound_per_element():
    assert not re.search(r'\.theme-swatch[^\n]*\)\.forEach\([^\n]*addEventListener', source())


@requires_node
def test_script_is_syntactically_valid():
    subprocess.run([NODE, '--check', str(SCRIPT)], check=True, capture_output=True)


@requires_node
def test_picker_still_works_when_the_modal_is_injected_after_load():
    result = subprocess.run(
        [NODE, str(HARNESS)], capture_output=True, text=True, cwd=str(REPO_ROOT)
    )

    assert result.returncode == 0, result.stdout + result.stderr
