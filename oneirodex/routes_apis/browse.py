# /oneirodex/routes_apis/browse.py
from flask import jsonify, request, current_app
import os, sys
from flask_login import login_required
from oneirodex.utils.auth import admin_required
from oneirodex.utils.api_response import api_error, api_ok
from oneirodex.utils.library_roots import (
    library_roots,
    resolve_library_root,
    root_availability,
)
from oneirodex.utils.security import is_safe_path, get_allowed_base_directories
from . import apis_bp


def _list_directory(folder_path):
    """List directory contents; distinguish between files and directories."""
    contents = [{'name': item,
                 'isDir': os.path.isdir(os.path.join(folder_path, item)),
                 'ext': os.path.splitext(item)[1][1:].lower() if not os.path.isdir(os.path.join(folder_path, item)) else None,
                 'size': os.path.getsize(os.path.join(folder_path, item)) if not os.path.isdir(os.path.join(folder_path, item)) else None
                 }
                for item in sorted(os.listdir(folder_path))]
    return sorted(contents, key=lambda x: (not x['isDir'], x['name'].lower()))


@apis_bp.route('/library_roots')
@login_required
@admin_required
def library_roots_list():
    """Scan locations the folder browser may start from.

    Availability is probed per root because the interesting failure is a share
    that is configured but not mounted: without the probe that root browses as
    an empty folder and reads as "my games disappeared".
    """
    roots = [root_availability(root) for root in library_roots(current_app)]
    return api_ok({'roots': roots})


@apis_bp.route('/browse_folders_ss')
@login_required
@admin_required
def browse_folders_ss():
    # Select base by operating system, unless the caller picked a declared root
    # (extra mount / NAS share). No root argument keeps the historical
    # behaviour so existing callers are unaffected.
    root_arg = request.args.get('root')
    if root_arg:
        root = resolve_library_root(root_arg, current_app)
        if not root:
            return api_error('Unknown scan location', code='not_found')
        base_directory = root['path']
    else:
        base_directory = current_app.config.get('BASE_FOLDER_WINDOWS') if os.name == 'nt' else current_app.config.get('BASE_FOLDER_POSIX')
    print(f'SS folder browser: Base directory: {base_directory}', file=sys.stderr)

    # Deep-link support: unmatched-folder "Open" jumps straight to an absolute
    # on-disk path (e.g. a game's own folder) instead of the base directory.
    abs_path_arg = request.args.get('abs_path')
    if abs_path_arg:
        allowed_bases = get_allowed_base_directories(current_app)
        ok, err = is_safe_path(abs_path_arg, allowed_bases)
        if not ok:
            print(f'SS folder browser: Access denied for abs_path {abs_path_arg}: {err}', file=sys.stderr)
            return api_error('Access denied', code='forbidden')

        folder_path = os.path.abspath(abs_path_arg)
        if not os.path.isdir(folder_path):
            # Deep link may point at the game folder itself; show its parent instead.
            folder_path = os.path.dirname(folder_path)
            if not os.path.isdir(folder_path):
                return api_error('SS folder browser: Folder not found', code='not_found')

        resolved_path = None
        if base_directory:
            try:
                rel = os.path.relpath(folder_path, base_directory)
                if rel != os.pardir and not rel.startswith(os.pardir + os.sep):
                    resolved_path = '' if rel == '.' else rel.replace(os.sep, '/') + '/'
            except ValueError:
                resolved_path = None  # different drive on Windows

        return jsonify({
            'items': _list_directory(folder_path),
            'resolved_path': resolved_path,
            'outside_base': resolved_path is None,
            'absolute_path': folder_path,
        })

    # Attempt to get 'path' from request arguments; default to an empty string which signifies the base directory
    request_path = request.args.get('path', '')
    print(f'SS folder browser: Requested path: {request_path}', file=sys.stderr)
    # Handle the default path case
    if not request_path:
        print(f'SS folder browser: No default path provided; using base directory: {base_directory}', file=sys.stderr)
        request_path = ''
        folder_path = base_directory
    else:
        # Safely construct the folder path to prevent directory traversal vulnerabilities
        folder_path = os.path.abspath(os.path.join(base_directory, request_path))
        print(f'SS folder browser: Folder path: {folder_path}', file=sys.stderr)
        ok, _err = is_safe_path(folder_path, [base_directory])
        if not ok:
            print(f'SS folder browser: Access denied: {folder_path} outside of base directory: {base_directory}', file=sys.stderr)
            return api_error('Access denied', code='forbidden')

    if os.path.isdir(folder_path):
        return jsonify(_list_directory(folder_path))
    else:
        return api_error('SS folder browser: Folder not found', code='not_found')
