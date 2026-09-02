"""GT-B2 / UID-007 — firmware upload validation.

Firmware lands on a mounted volume from an operator-supplied file, so
store_bios_file is treated as an untrusted-input boundary. Before this pass it
accepted any filename secure_filename() would tolerate, at any size.
"""

import io
import os

import pytest
from flask import Flask
from werkzeug.datastructures import FileStorage

from oneirodex.utils.emulator_bios import (
    ALLOWED_BIOS_EXTENSIONS,
    DEFAULT_BIOS_MAX_BYTES,
    store_bios_file,
)


@pytest.fixture()
def app(tmp_path):
    application = Flask(__name__)
    application.config['EMULATOR_BIOS_PATH'] = str(tmp_path)
    return application


def upload(name, data=b'\x00' * 32):
    return FileStorage(stream=io.BytesIO(data), filename=name)


def test_accepts_a_normal_bios_file(app, tmp_path):
    with app.app_context():
        row = store_bios_file(upload('scph5501.bin'))

    assert row['name'] == 'scph5501.bin'
    assert row['size'] == 32
    assert os.path.isfile(tmp_path / 'scph5501.bin')


@pytest.mark.parametrize('name', ['payload.exe', 'script.sh', 'notes.txt', 'noextension'])
def test_rejects_types_no_core_can_consume(app, name):
    with app.app_context():
        with pytest.raises(ValueError, match='Unsupported firmware file type'):
            store_bios_file(upload(name))


def test_rejects_empty_file(app):
    with app.app_context():
        with pytest.raises(ValueError, match='empty'):
            store_bios_file(upload('scph5501.bin', data=b''))


def test_rejects_oversized_file(app):
    app.config['EMULATOR_BIOS_MAX_BYTES'] = 1024
    with app.app_context():
        with pytest.raises(ValueError, match='limit is'):
            store_bios_file(upload('big.bin', data=b'\x00' * 2048))


def test_traversal_filename_cannot_escape_the_volume(app, tmp_path):
    """secure_filename flattens the path; assert nothing lands outside root."""
    with app.app_context():
        row = store_bios_file(upload('../../etc/evil.bin'))

    assert os.sep not in row['name']
    assert os.path.isfile(tmp_path / row['name'])
    assert not os.path.exists(tmp_path.parent.parent / 'etc' / 'evil.bin')


def test_blank_filename_rejected(app):
    with app.app_context():
        with pytest.raises(ValueError, match='Filename required'):
            store_bios_file(upload(''))


def test_default_cap_is_sane_and_allowlist_covers_the_known_cores():
    assert DEFAULT_BIOS_MAX_BYTES == 64 * 1024 * 1024
    # Every filename in BIOS_REQUIREMENTS must be uploadable, or the panel
    # reports a missing file the operator has no way to supply.
    #
    # Two tracks, because some firmware names cannot be expressed as an
    # extension: the VICE C64 ROMs have no suffix, and citra's key file is a
    # plain .txt. Those are allowed by exact name so the volume does not have to
    # accept every extensionless or text upload — see ALLOWED_BIOS_EXACT_NAMES.
    from oneirodex.utils.emulator_bios import (
        ALLOWED_BIOS_EXACT_NAMES,
        BIOS_REQUIREMENTS,
    )

    for core, required in BIOS_REQUIREMENTS.items():
        for name in required:
            extension = os.path.splitext(name)[1].lower()
            assert (
                extension in ALLOWED_BIOS_EXTENSIONS
                or name.lower() in ALLOWED_BIOS_EXACT_NAMES
            ), f'{core} requires {name!r}, which the upload allowlist would reject'
