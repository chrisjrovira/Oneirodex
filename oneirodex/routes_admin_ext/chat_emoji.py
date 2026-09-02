"""Admin UI for household custom chat emoji."""

from __future__ import annotations

from flask import flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from oneirodex.utils.auth import admin_required
from oneirodex.utils.custom_emoji import (
    MAX_CUSTOM_EMOJI,
    delete_custom_emoji,
    list_custom_emoji,
    upload_custom_emoji,
)

from . import admin2_bp


@admin2_bp.route('/admin/chat_emoji', methods=['GET', 'POST'])
@login_required
@admin_required
def chat_emoji_admin():
    if request.method == 'POST':
        action = (request.form.get('action') or 'upload').strip()
        if action == 'delete':
            slug = request.form.get('slug') or ''
            if delete_custom_emoji(slug):
                flash(f'Deleted :{slug}:', 'success')
            else:
                flash('Emoji not found', 'error')
            return redirect(url_for('admin2.chat_emoji_admin'))
        try:
            row = upload_custom_emoji(
                slug=request.form.get('slug') or '',
                label=request.form.get('label') or '',
                file=request.files.get('file'),
                uploader=current_user,
            )
            flash(f'Uploaded {row.reaction_key()}', 'success')
        except ValueError as exc:
            flash(str(exc), 'error')
        return redirect(url_for('admin2.chat_emoji_admin'))

    return render_template(
        'admin/admin_chat_emoji.html',
        emojis=list_custom_emoji(),
        max_custom=MAX_CUSTOM_EMOJI,
    )
