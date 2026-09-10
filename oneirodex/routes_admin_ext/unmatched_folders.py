"""Admin: unmatched-folder management routes.

Extracted verbatim from ``oneirodex/routes.py`` (wave A2.1d): bulk clear
(``delete_all_unmatched_folders``), the legacy status toggle
(``update_unmatched_folder_status``), single-entry clear
(``clear_unmatched_entry``) and the ignore toggle (``toggle_ignore_status``).

The blueprint is ``admin2_bp`` (registered with **no** ``url_prefix``), so every
URL rule here is byte-identical to when these lived on the ``main`` blueprint;
only the endpoint names change (``main.*`` -> ``admin2.*``). The redirects still
target ``admin2.scan_management`` (in ``scan_management.py``).

Route bodies moved verbatim; the ``print()`` calls become module-level
``logger.{info,error}``.
"""

import logging

from flask import abort, current_app, flash, redirect, request, session, url_for
from flask_login import login_required
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError

from oneirodex import db
from oneirodex.models import UnmatchedFolder
from oneirodex.utils.api_response import api_error, api_ok
from oneirodex.utils.auth import admin_required

from . import admin2_bp

logger = logging.getLogger(__name__)


@admin2_bp.route('/delete_all_unmatched_folders', methods=['POST'])
@login_required
@admin_required
def delete_all_unmatched_folders():
    try:
        db.session.execute(delete(UnmatchedFolder))
        db.session.commit()
        flash('All unmatched folders deleted successfully.', 'success')
    except SQLAlchemyError as e:
        db.session.rollback()
        error_message = f"Database error while deleting all unmatched folders: {str(e)}"
        logger.error(error_message)
        flash(error_message, 'error')
    except Exception as e:
        db.session.rollback()
        error_message = f"An unexpected error occurred while deleting all unmatched folders: {str(e)}"
        logger.error(error_message)
        flash(error_message, 'error')
    return redirect(url_for('admin2.scan_management'))


@admin2_bp.route('/update_unmatched_folder_status', methods=['POST'])
@login_required
@admin_required
def update_unmatched_folder_status():
    logger.info("Route: /update_unmatched_folder_status")
    folder_id = request.form.get('folder_id')
    session['active_tab'] = 'unmatched'
    folder = db.session.execute(select(UnmatchedFolder).filter_by(id=folder_id)).scalar_one_or_none()
    if folder:
        # Toggle between 'Ignore' and 'Unmatched'
        folder.status = 'Unmatched' if folder.status == 'Ignore' else 'Ignore'
        try:
            db.session.commit()
            # `status` stays in the payload: the envelope migration is additive,
            # and an existing caller (plus test_routes.py) reads it.
            response_data = {
                'status': 'success',
                'new_status': folder.status,
                'message': f'Folder status updated to {folder.status}'
            }
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return api_ok(response_data)
            flash(response_data['message'], 'success')
        except SQLAlchemyError as e:
            # The raw SQLAlchemy text stays in the log. Handing it to the browser
            # leaks schema and connection detail for no operator benefit.
            current_app.logger.warning('Folder status update failed: %s', e)
            db.session.rollback()
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return api_error('Could not update the folder status', code='internal')
            flash('Error updating folder status.', 'error')
    else:
        flash('Folder not found.', 'error')

    return redirect(url_for('admin2.scan_management'))


@admin2_bp.route('/clear_unmatched_entry/<folder_id>', methods=['POST'])
@login_required
@admin_required
def clear_unmatched_entry(folder_id):
    """Clear a single unmatched folder entry from the database."""
    try:
        folder = db.session.get(UnmatchedFolder, folder_id) or abort(404)
        db.session.delete(folder)
        db.session.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_ok({'status': 'success', 'message': 'Entry cleared successfully'})
        flash('Unmatched folder entry cleared successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        current_app.logger.warning('clear unmatched entry failed: %s', e)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_error(
                'Could not clear the entry',
                code='internal',
                body_status='error',
            )
        flash('Error clearing unmatched folder entry.', 'error')
    return redirect(url_for('admin2.scan_management'))


@admin2_bp.route('/toggle_ignore_status/<folder_id>', methods=['POST'])
@login_required
@admin_required
def toggle_ignore_status(folder_id):
    """Toggle the ignore status of an unmatched folder."""
    try:
        folder = db.session.get(UnmatchedFolder, folder_id) or abort(404)
        # Toggle between 'Ignore' and the original status (likely 'Unmatched' or 'Duplicate')
        if folder.status == 'Ignore':
            # Restore to Unmatched or keep as Duplicate if that was the original status
            folder.status = 'Unmatched'  # Default to Unmatched when un-ignoring
        else:
            folder.status = 'Ignore'

        db.session.commit()

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_ok({
                'status': 'success',
                'new_status': folder.status,
                'message': f'Status changed to {folder.status}',
            })
        flash(f'Folder status changed to {folder.status}.', 'success')
    except Exception as e:
        db.session.rollback()
        current_app.logger.warning('toggle ignore status failed: %s', e)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_error(
                'Could not change the folder status',
                code='internal',
                body_status='error',
            )
        flash('Error toggling ignore status.', 'error')

    return redirect(url_for('admin2.scan_management'))
