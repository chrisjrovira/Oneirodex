# /gametheca/routes_admin_ext/images.py
import os
from datetime import datetime, timezone

from flask import render_template, request, jsonify, current_app, url_for
from flask_login import login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, Image
from gametheca.utils.auth import admin_required
from gametheca.utils.cover_art_studio import apply_pack_to_game, save_pack
from gametheca.utils.cover_selection import (
    batch_apply_covers,
    batch_search_covers,
    image_save_path_status,
    resolve_policy,
    search_cover_candidates,
)
from . import admin2_bp


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

    if status_filter == 'pending':
        query = query.filter(Image.is_downloaded.is_(False), Image.last_error.is_(None))
    elif status_filter == 'failed':
        query = query.filter(Image.is_downloaded.is_(False), Image.last_error.isnot(None))
    elif status_filter == 'downloaded':
        query = query.filter(Image.is_downloaded.is_(True))

    if type_filter != 'all':
        query = query.filter(Image.image_type == type_filter)

    query = query.order_by(Image.is_downloaded.asc(), Image.created_at.desc())

    pagination = db.paginate(query, page=page, per_page=per_page, error_out=False)
    images = pagination.items

    image_save_path = current_app.config.get('IMAGE_SAVE_PATH')
    path_status = image_save_path_status()

    image_list = []
    for img in images:
        file_exists = bool(
            img.is_downloaded and img.url and image_save_path
            and os.path.isfile(os.path.join(image_save_path, img.url))
        )
        failure_reason = None
        if not img.is_downloaded and img.last_error:
            failure_reason = img.last_error
        elif img.is_downloaded and not file_exists:
            failure_reason = 'Marked downloaded but file missing under IMAGE_SAVE_PATH'
            if path_status.get('error'):
                failure_reason = f"{failure_reason} ({path_status['error']})"
        image_list.append({
            'id': img.id,
            'game_uuid': img.game_uuid,
            'game_name': img.game.name if img.game else 'Unknown',
            'image_type': img.image_type,
            'download_url': img.download_url,
            'is_downloaded': img.is_downloaded,
            'status': _image_status(img),
            'last_error': img.last_error,
            'failure_reason': failure_reason,
            'last_attempt_at': img.last_attempt_at.strftime('%Y-%m-%d %H:%M:%S') if img.last_attempt_at else None,
            'created_at': img.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'local_url': url_for('static', filename=f'library/images/{img.url}') if file_exists else None,
            'file_missing': bool(img.is_downloaded and not file_exists),
        })

    return jsonify({
        'images': image_list,
        'image_save_path': path_status,
        'pagination': {
            'page': page,
            'pages': pagination.pages,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
        },
    })


@admin2_bp.route('/admin/api/download_images', methods=['POST'])
@login_required
@admin_required
def download_images():
    """Download specific images, retry failed images, or batch download pending ones."""
    data = request.json or {}
    path_status = image_save_path_status()
    if not path_status.get('writable') and (
        'image_ids' in data or data.get('retry_failed') or 'batch_size' in data
    ):
        return jsonify({
            'success': False,
            'message': path_status.get('error') or 'IMAGE_SAVE_PATH is not writable',
            'image_save_path': path_status,
            'downloaded': 0,
            'failed': 0,
            'errors': [{'error': path_status.get('error') or 'IMAGE_SAVE_PATH is not writable'}],
        }), 503

    try:
        if 'image_ids' in data or data.get('retry_failed'):
            if data.get('retry_failed'):
                failed_images = db.session.execute(
                    select(Image).filter(
                        Image.is_downloaded.is_(False), Image.last_error.isnot(None)
                    )
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
                if image.is_downloaded:
                    continue
                if not image.download_url:
                    image.last_error = 'No download URL on record for this image.'
                    image.last_attempt_at = datetime.now(timezone.utc)
                    failed += 1
                    errors.append({'image_id': image.id, 'error': image.last_error})
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
                'message': message,
                'image_save_path': path_status,
            })

        if 'batch_size' in data:
            from gametheca.utils.game_core import download_pending_images
            batch_size = data.get('batch_size', 10)
            downloaded = download_pending_images(
                batch_size=batch_size, delay_between_downloads=0.1, app=current_app
            )
            return jsonify({
                'success': True,
                'downloaded': downloaded,
                'message': f'Downloaded {downloaded} images',
                'image_save_path': path_status,
            })

        return jsonify({'success': False, 'message': 'No valid parameters provided'}), 400

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e),
            'image_save_path': path_status,
        }), 500


@admin2_bp.route('/admin/api/delete_image/<int:image_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_image(image_id):
    """Delete a specific image from queue."""
    try:
        image = db.session.get(Image, image_id)
        if not image:
            return jsonify({'success': False, 'message': 'Image not found'}), 404

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


def _parse_providers_arg(raw) -> list[str] | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        return [str(p).strip() for p in raw if str(p).strip()]
    text = str(raw).strip()
    if not text:
        return None
    return [p.strip() for p in text.split(',') if p.strip()]


@admin2_bp.route('/admin/api/covers/search', methods=['POST'])
@login_required
@admin_required
def covers_search_single():
    """Search cover candidates across providers for one title (or game UUID)."""
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip() or None
    query = (data.get('query') or data.get('q') or data.get('name') or '').strip()
    if game_uuid and not query:
        game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
        if not game:
            return jsonify({'error': 'Game not found', 'game_uuid': game_uuid}), 404
        query = game.name or ''
    if not query:
        return jsonify({'error': 'query or game_uuid is required'}), 400

    providers = _parse_providers_arg(data.get('providers'))
    try:
        limit = min(int(data.get('limit') or data.get('limit_per_provider') or 8), 20)
    except (TypeError, ValueError):
        limit = 8

    result = search_cover_candidates(query, providers=providers, limit_per_provider=limit)
    return jsonify({
        **result,
        'game_uuid': game_uuid,
        'image_save_path': image_save_path_status(),
    })


@admin2_bp.route('/admin/api/covers/apply', methods=['POST'])
@login_required
@admin_required
def covers_apply_single():
    """Apply one cover URL from a provider to a game."""
    from gametheca.utils.artwork_apply import apply_cover_from_url

    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    image_url = (data.get('url') or '').strip()
    provider_id = (data.get('provider') or 'steamgriddb').strip().lower() or 'steamgriddb'
    if not game_uuid:
        return jsonify({'error': 'game_uuid is required'}), 400
    if not image_url:
        return jsonify({'error': 'url is required'}), 400

    path_status = image_save_path_status()
    if not path_status.get('writable'):
        return jsonify({
            'error': path_status.get('error') or 'IMAGE_SAVE_PATH is not writable',
            'image_save_path': path_status,
        }), 503

    try:
        result = apply_cover_from_url(
            game_uuid,
            image_url,
            provider_id=provider_id,
            image_type='cover',
        )
    except ValueError as exc:
        return jsonify({'error': str(exc), 'game_uuid': game_uuid}), 400
    except LookupError as exc:
        return jsonify({'error': str(exc), 'game_uuid': game_uuid}), 404
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({'error': str(exc), 'game_uuid': game_uuid}), 502

    return jsonify({**result, 'image_save_path': path_status})


@admin2_bp.route('/admin/api/covers/batch/search', methods=['POST'])
@login_required
@admin_required
def covers_batch_search():
    """Mass cover search: filter by library/platform/service/missing-cover."""
    data = request.get_json(silent=True) or {}
    try:
        limit_games = min(int(data.get('limit_games') or data.get('limit') or 25), 100)
    except (TypeError, ValueError):
        limit_games = 25
    try:
        limit_per = min(int(data.get('limit_per_provider') or 5), 15)
    except (TypeError, ValueError):
        limit_per = 5

    result = batch_search_covers(
        library_uuid=(data.get('library_uuid') or '').strip() or None,
        platform=(data.get('platform') or data.get('system') or '').strip() or None,
        service=(data.get('service') or '').strip() or None,
        missing_cover=bool(data.get('missing_cover', True)),
        limit_games=limit_games,
        providers=_parse_providers_arg(data.get('providers')),
        limit_per_provider=limit_per,
    )
    return jsonify(result)


def _cover_generate_fn(game: Game) -> dict:
    system = None
    if game.library and game.library.platform:
        system = game.library.platform.value
    manifest = save_pack(game.name or 'Untitled', system=system)
    return apply_pack_to_game(manifest['pack_id'], game.uuid)


def _parse_game_uuids(raw) -> list[str] | None:
    if isinstance(raw, str):
        return [u.strip() for u in raw.split(',') if u.strip()]
    if isinstance(raw, list):
        return [str(u).strip() for u in raw if str(u).strip()]
    return None


@admin2_bp.route('/admin/api/covers/batch/apply', methods=['POST'])
@login_required
@admin_required
def covers_batch_apply():
    """Mass apply covers by policy (sgdb→igdb→generate) or explicit provider."""
    data = request.get_json(silent=True) or {}
    policy = (data.get('policy') or 'sgdb_then_igdb_then_generate').strip()
    game_uuids = _parse_game_uuids(data.get('game_uuids'))

    try:
        limit_games = min(int(data.get('limit_games') or data.get('limit') or 25), 100)
    except (TypeError, ValueError):
        limit_games = 25

    result = batch_apply_covers(
        game_uuids=game_uuids,
        library_uuid=(data.get('library_uuid') or '').strip() or None,
        platform=(data.get('platform') or data.get('system') or '').strip() or None,
        service=(data.get('service') or '').strip() or None,
        missing_cover=bool(data.get('missing_cover', True)),
        limit_games=limit_games,
        policy=policy,
        generate_fn=_cover_generate_fn,
    )
    return jsonify(result)


@admin2_bp.route('/admin/api/artwork/auto-pick', methods=['POST'])
@login_required
@admin_required
def artwork_auto_pick():
    """
    Mass auto-pick covers for games missing art (Admin ImagesPage).

    Body JSON:
      policy: best_available | sgdb_then_igdb_then_generate | … (default best_available)
      library_uuid, platform/system, service, status, image_type (filters; optional)
      game_uuids: optional explicit list
      limit_games: max titles (default 25, max 100)
      missing_cover: bool (default true)

    Returns applied/failed counts + per-game status with clear error strings.
    """
    data = request.get_json(silent=True) or {}
    policy = (data.get('policy') or 'best_available').strip() or 'best_available'
    game_uuids = _parse_game_uuids(data.get('game_uuids'))

    try:
        limit_games = min(int(data.get('limit_games') or data.get('limit') or 25), 100)
    except (TypeError, ValueError):
        limit_games = 25

    # status / image_type are queue filters from the UI — map to missing_cover default.
    status_filter = (data.get('status') or '').strip().lower()
    missing_cover = bool(data.get('missing_cover', True))
    if status_filter in ('downloaded',):
        missing_cover = False

    path_status = image_save_path_status()
    if not path_status.get('writable'):
        return jsonify({
            'success': False,
            'applied': 0,
            'failed': 0,
            'results': [],
            'policy': list(resolve_policy(policy)),
            'error': path_status.get('error') or 'IMAGE_SAVE_PATH is not writable',
            'image_save_path': path_status,
        }), 503

    result = batch_apply_covers(
        game_uuids=game_uuids,
        library_uuid=(data.get('library_uuid') or '').strip() or None,
        platform=(data.get('platform') or data.get('system') or '').strip() or None,
        service=(data.get('service') or '').strip() or None,
        missing_cover=missing_cover,
        limit_games=limit_games,
        policy=policy,
        generate_fn=_cover_generate_fn,
    )
    return jsonify({
        'success': True,
        'message': (
            f"Auto-pick finished: applied={result.get('applied', 0)} "
            f"failed={result.get('failed', 0)}"
        ),
        **result,
    })
