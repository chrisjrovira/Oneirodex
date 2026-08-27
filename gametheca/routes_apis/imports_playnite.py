"""Playnite library import API (register-only ownership marks)."""

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.api_response import api_error
from gametheca.utils.playnite_import import import_playnite_csv, import_playnite_json

from . import apis_bp


@apis_bp.route('/imports/playnite', methods=['POST'])
@login_required
def import_playnite():
    """
    Import a Playnite library export.

    JSON body: raw Playnite export object/list, or multipart file (.json/.csv).
    Creates store='playnite' ownership rows and matches local games by name.
    Never downloads or installs from stores.
    """
    upload = request.files.get('file')
    if upload:
        filename = (upload.filename or '').lower()
        raw = upload.read()
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            return api_error('File must be UTF-8 text', code='bad_request')
        if filename.endswith('.csv'):
            result = import_playnite_csv(current_user.id, text)
        else:
            result = import_playnite_json(current_user.id, text)
    else:
        data = request.get_json(silent=True)
        if data is None:
            return api_error('JSON body or file upload required', code='bad_request')
        result = import_playnite_json(current_user.id, data)

    if result.errors and result.imported == 0 and result.matched == 0:
        return jsonify(result.to_dict()), 400
    return jsonify(result.to_dict()), 200
