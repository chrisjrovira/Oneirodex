"""Admin UI for ROM reference set (DAT) uploads."""

from __future__ import annotations

from flask import flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from gametheca.platform import LibraryPlatform, NATIVE_PC_PLATFORMS
from gametheca.utils.auth import admin_required
from gametheca.utils.functions import igdb_platform_id_for
from gametheca.utils.set_completion import (
    REGION_PREF_ORDER,
    VALID_SOURCES,
    delete_reference_set,
    list_reference_sets,
    upsert_reference_set,
)

from . import admin2_bp

MAX_DAT_BYTES = 32 * 1024 * 1024


@admin2_bp.route('/admin/reference_sets', methods=['GET', 'POST'])
@login_required
@admin_required
def reference_sets_admin():
    if request.method == 'POST':
        action = (request.form.get('action') or 'upload').strip()
        if action == 'delete':
            try:
                set_id = int(request.form.get('set_id') or '0')
            except ValueError:
                set_id = 0
            if set_id and delete_reference_set(set_id):
                flash('Reference set deleted', 'success')
            else:
                flash('Reference set not found', 'error')
            return redirect(url_for('admin2.reference_sets_admin'))

        upload = request.files.get('file')
        platform = (request.form.get('library_platform') or '').strip()
        region = (request.form.get('region') or 'USA').strip()
        source = (request.form.get('source') or 'nointro').strip()
        if not upload or not upload.filename:
            flash('DAT file required', 'error')
            return redirect(url_for('admin2.reference_sets_admin'))
        raw = upload.read(MAX_DAT_BYTES + 1)
        if len(raw) > MAX_DAT_BYTES:
            flash('DAT too large (max 32 MiB)', 'error')
            return redirect(url_for('admin2.reference_sets_admin'))
        try:
            ref = upsert_reference_set(
                library_platform=platform,
                region=region,
                source=source,
                dat_bytes=raw,
                uploader_id=getattr(current_user, 'id', None),
            )
            flash(
                f'Uploaded {ref.name}: {ref.entry_count} entries for '
                f'{ref.library_platform}/{ref.region}',
                'success',
            )
        except ValueError as exc:
            flash(str(exc), 'error')
        except Exception as exc:  # noqa: BLE001
            flash(f'Failed to parse DAT: {exc}', 'error')
        return redirect(url_for('admin2.reference_sets_admin'))

    platforms = sorted(
        [{'id': p.name, 'label': p.value} for p in LibraryPlatform],
        key=lambda row: row['label'].lower(),
    )
    catalog_platforms = [
        p
        for p in platforms
        if p['id'] not in NATIVE_PC_PLATFORMS and igdb_platform_id_for(p['id']) is not None
    ]
    return render_template(
        'admin/admin_reference_sets.html',
        sets=list_reference_sets(),
        platforms=platforms,
        catalog_platforms=catalog_platforms,
        regions=list(REGION_PREF_ORDER),
        sources=sorted(VALID_SOURCES),
    )
