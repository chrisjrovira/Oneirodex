# /gametheca/routes_admin_ext/images.py
import os
from datetime import datetime, timezone

from flask import render_template, request, jsonify, current_app, url_for
from flask_login import login_required
from gametheca.models import Image, Game
from gametheca import db
from . import admin2_bp
from gametheca.utils.auth import admin_required
from sqlalchemy import select, func, delete

@admin2_bp.route('/admin/image_queue')
@login_required
@admin_required
def image_queue():
    """Display the image queue management interface."""
    return render_template('admin/admin_manage_image_queue.html')


def _image_status(img):
    """Classify an image row for the admin queue UI (pending/downloaded/failed)."""
    if img.is_downloaded:
        return 'downloaded'
    if img.last_error:
        return 'failed'
    return 'pending'


@admin2_bp.route('/admin/api/image_queue_list')
@login_required
@admin_required
def image_queue_list():
    """Get paginated list of images in queue."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status_filter = request.args.get('status', 'all')  # all, pending, downloaded, failed
    type_filter = request.args.get('type', 'all')  # all, cover, screenshot

    query = select(Image).join(Game)

    # Apply filters
    if status_filter == 'pending':
        query = query.filter(Image.is_downloaded.is_(False), Image.last_error.is_(None))
    elif status_filter == 'failed':
        query = query.filter(Image.is_downloaded.is_(False), Image.last_error.isnot(None))
    elif status_filter == 'downloaded':
        query = query.filter(Image.is_downloaded.is_(True))

    if type_filter != 'all':
        query = query.filter(Image.image_type == type_filter)

    # Order by creation date, pending/failed first
    query = query.order_by(Image.is_downloaded.asc(), Image.created_at.desc())

    pagination = db.paginate(query, page=page, per_page=per_page, error_out=False)
    images = pagination.items

    image_save_path = current_app.config.get('IMAGE_SAVE_PATH')

    image_list = []
    for img in images:
        file_exists = bool(
            img.is_downloaded and img.url and image_save_path
            and os.path.isfile(os.path.join(image_save_path, img.url))
        )
        image_list.append({
            'id': img.id,
            'game_uuid': img.game_uuid,
            'game_name': img.game.name if img.game else 'Unknown',
            'image_type': img.image_type,
            'download_url': img.download_url,
            'is_downloaded': img.is_downloaded,
            'status': _image_status(img),
            'last_error': img.last_error,
            'last_attempt_at': img.last_attempt_at.strftime('%Y-%m-%d %H:%M:%S') if img.last_attempt_at else None,
            'created_at': img.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'local_url': url_for('static', filename=f'library/images/{img.url}') if file_exists else None,
            'file_missing': bool(img.is_downloaded and not file_exists),
        })

    return jsonify({
        'images': image_list,
        'pagination': {
            'page': page,
            'pages': pagination.pages,
            'per_page': per_page,
            'total': pagination.total,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev
        }
    })


@admin2_bp.route('/admin/api/download_images', methods=['POST'])
@login_required
@admin_required
def download_images():
    """Download specific images, retry failed images, or batch download pending ones."""
    data = request.json or {}

    try:
        if 'image_ids' in data or data.get('retry_failed'):
            if data.get('retry_failed'):
                # Retry every image the queue has previously failed to download.
                failed_images = db.session.execute(
                    select(Image).filter(Image.is_downloaded.is_(False), Image.last_error.isnot(None))
                ).scalars().all()
            else:
                image_ids = data['image_ids']
                failed_images = [
                    img for img in (db.session.get(Image, image_id) for image_id in image_ids)
                    if img is not None
                ]

            downloaded = 0
            failed = 0
            errors = []
            from gametheca.utils.functions import download_image

            for image in failed_images:
                if image.is_downloaded or not image.download_url:
                    continue
                image.last_attempt_at = datetime.now(timezone.utc)
                try:
                    save_path = os.path.join(current_app.config['IMAGE_SAVE_PATH'], image.url)
                    success, error = download_image(image.download_url, save_path)
                except Exception as e:
                    success, error = False, str(e)

                if success:
                    image.is_downloaded = True
                    image.last_error = None
                    downloaded += 1
                else:
                    image.last_error = error or 'Download failed for an unknown reason.'
                    failed += 1
                    errors.append({'image_id': image.id, 'error': image.last_error})
                    print(f"Failed to download image {image.id}: {image.last_error}")

            db.session.commit()
            message = f'Downloaded {downloaded} images'
            if failed:
                message += f', {failed} failed'
            return jsonify({
                'success': True,
                'downloaded': downloaded,
                'failed': failed,
                'errors': errors,
                'message': message
            })

        elif 'batch_size' in data:
            # Batch download
            from gametheca.utils.game_core import download_pending_images
            batch_size = data.get('batch_size', 10)
            downloaded = download_pending_images(batch_size=batch_size, delay_between_downloads=0.1, app=current_app)

            return jsonify({
                'success': True,
                'downloaded': downloaded,
                'message': f'Downloaded {downloaded} images'
            })

        else:
            return jsonify({'success': False, 'message': 'No valid parameters provided'}), 400

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin2_bp.route('/admin/api/delete_image/<int:image_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_image(image_id):
    """Delete a specific image from queue."""
    try:
        image = db.session.get(Image, image_id)
        if not image:
            return jsonify({'success': False, 'message': 'Image not found'}), 404
        
        # Delete file if it exists
        if image.is_downloaded and image.url:
            file_path = os.path.join(current_app.config['IMAGE_SAVE_PATH'], image.url)
            if os.path.exists(file_path):
                os.remove(file_path)
        
        db.session.delete(image)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Image deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


