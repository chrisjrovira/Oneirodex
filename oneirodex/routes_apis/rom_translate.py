"""Admin API for offline ROM translate capabilities (stubs only)."""

from flask import jsonify
from flask_login import login_required

from oneirodex.utils.auth import admin_required
from oneirodex.utils.rom_translate import list_rom_translate_capabilities

from . import apis_bp


@apis_bp.route('/rom-translate/capabilities', methods=['GET'])
@login_required
@admin_required
def rom_translate_capabilities():
    return jsonify(
        {
            'offline_enabled': False,
            'note': (
                'Offline dump→MT→rebuild is stubbed. Prefer RetroArch AI Service overlay '
                'or curated translation patches. See docs/user/translation-patches.md'
            ),
            'platforms': list_rom_translate_capabilities(),
        }
    )
