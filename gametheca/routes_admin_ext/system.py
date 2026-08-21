from gametheca.utils.api_response import api_error, api_ok
from flask import render_template, request, jsonify, session
from flask_login import login_required, current_user
from gametheca.utils.auth import admin_required
from gametheca.models import SystemEvents, DiscoverySection, Game, Genre, Library, user_favorites
from gametheca import db
from gametheca.platform import LibraryPlatform
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.discovery_zones import (
    count_custom_zone_games,
    describe_zone_config,
    validate_zone_config,
)
from sqlalchemy import select, and_, func
from datetime import datetime
from typing import Optional, Dict, Any
import uuid
from . import admin2_bp

# Constants
DEFAULT_PER_PAGE = 50
MAX_PER_PAGE = 200
DATE_FORMAT = '%Y-%m-%d'


def validate_pagination_params(page: int, per_page: int) -> tuple[int, int]:
    """Validate and sanitize pagination parameters."""
    page = max(1, page)  # Ensure page is at least 1
    per_page = min(max(1, per_page), MAX_PER_PAGE)  # Clamp per_page between 1 and MAX_PER_PAGE
    return page, per_page


def parse_date_filter(date_str: Optional[str]) -> Optional[datetime]:
    """Parse date string and return datetime object or None if invalid."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, DATE_FORMAT)
    except ValueError:
        return None


def validate_json_request(data: Dict[str, Any], required_fields: list[str]) -> tuple[bool, Optional[str]]:
    """Validate JSON request data for required fields."""
    if data is None:
        return False, "No JSON data provided"
    
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    return True, None

@admin2_bp.route('/admin/system_logs')
@admin2_bp.route('/admin/server_logs')
@login_required
@admin_required
def system_logs() -> str:
    """
    Display system logs with filtering and pagination.

    Canonical path: ``/admin/system_logs``. Alias ``/admin/server_logs`` matches
    Admin SPA System nav (otherwise 404).

    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 50, max: 200)
    - event_type: Filter by event type
    - event_level: Filter by event level
    - date_from: Filter events from date (YYYY-MM-DD format)
    - date_to: Filter events to date (YYYY-MM-DD format)
    """
    # Get and validate pagination parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PER_PAGE, type=int)
    page, per_page = validate_pagination_params(page, per_page)
    
    # Get filter parameters
    event_type = request.args.get('event_type', '').strip()
    event_level = request.args.get('event_level', '').strip()
    date_from_str = request.args.get('date_from', '').strip()
    date_to_str = request.args.get('date_to', '').strip()
    
    # Parse date filters
    date_from = parse_date_filter(date_from_str)
    date_to = parse_date_filter(date_to_str)
    
    # Build query with eager loading for user relationship
    query = select(SystemEvents).options(db.joinedload(SystemEvents.user)).order_by(SystemEvents.timestamp.desc())
    
    # Apply filters if they exist
    filters = []
    
    if event_type:
        filters.append(SystemEvents.event_type == event_type)
    
    if event_level:
        filters.append(SystemEvents.event_level == event_level)
    
    if date_from:
        filters.append(SystemEvents.timestamp >= date_from)
    
    if date_to:
        # Add one day to include events from the entire end date
        date_to_end = date_to.replace(hour=23, minute=59, second=59)
        filters.append(SystemEvents.timestamp <= date_to_end)
    
    if filters:
        query = query.filter(and_(*filters))
    
    logs = db.paginate(query, page=page, per_page=per_page)
    return render_template('admin/admin_server_logs.html', logs=logs)

@admin2_bp.route('/admin/discovery_sections')
@login_required
@admin_required
def discovery_sections() -> str:
    """
    Display and manage discovery sections configuration.

    Returns a page where admins can view, reorder, and toggle visibility
    of discovery sections on the main discovery page.
    """
    sections = db.session.execute(select(DiscoverySection).order_by(DiscoverySection.display_order)).scalars().all()

    # Calculate item counts for each section
    section_counts = {}
    zone_descriptions = {}

    for section in sections:
        if section.identifier == 'libraries':
            count = db.session.execute(select(func.count(Library.uuid))).scalar()
        elif section.identifier == 'latest_games':
            count = db.session.execute(select(func.count(Game.id))).scalar()
        elif section.identifier == 'most_downloaded':
            count = db.session.execute(select(func.count(Game.id)).where(Game.times_downloaded > 0)).scalar()
        elif section.identifier == 'highest_rated':
            count = db.session.execute(select(func.count(Game.id)).where(Game.rating != None)).scalar()
        elif section.identifier == 'last_updated':
            count = db.session.execute(select(func.count(Game.id)).where(Game.last_updated != None)).scalar()
        elif section.identifier == 'most_favorited':
            count = db.session.execute(
                select(func.count(func.distinct(Game.uuid)))
                .join(user_favorites, Game.uuid == user_favorites.c.game_uuid)
            ).scalar()
        elif section.section_type == 'custom':
            count = count_custom_zone_games(section.config)
            zone_descriptions[section.id] = describe_zone_config(section.config)
        else:
            count = 0

        section_counts[section.identifier] = count

    libraries = db.session.execute(select(Library).order_by(Library.name)).scalars().all()
    genres = db.session.execute(select(Genre).order_by(Genre.name)).scalars().all()
    platforms = list(LibraryPlatform)

    return render_template(
        'admin/admin_discovery_sections.html',
        sections=sections,
        section_counts=section_counts,
        zone_descriptions=zone_descriptions,
        libraries=libraries,
        genres=genres,
        platforms=platforms,
    )


@admin2_bp.route('/admin/api/discovery_sections', methods=['POST'])
@login_required
@admin_required
def create_discovery_section() -> tuple[Dict[str, Any], int]:
    """Create a custom discovery zone (manual game pick list or library/platform/genre filter)."""
    try:
        data = request.get_json() or {}
        name = str(data.get('name') or '').strip()
        if not name:
            return api_error('Zone name is required', code='bad_request')
        if len(name) > 50:
            return api_error('Zone name must be 50 characters or fewer', code='bad_request')

        config, error = validate_zone_config(
            data.get('mode'),
            game_uuids=data.get('game_uuids'),
            filter_type=data.get('filter_type'),
            filter_value=data.get('filter_value'),
        )
        if error:
            return api_error(error, code='bad_request')

        max_order = db.session.execute(select(func.max(DiscoverySection.display_order))).scalar() or 0
        identifier = f"custom_{uuid.uuid4().hex[:12]}"

        section = DiscoverySection(
            name=name,
            identifier=identifier,
            is_visible=True,
            display_order=max_order + 1,
            section_type='custom',
            config=config,
        )
        db.session.add(section)
        db.session.commit()

        log_system_event(
            f"Created custom discovery zone '{name}'",
            event_type='admin_action',
            event_level='information',
            audit_user=current_user.id,
        )

        return api_ok({
                        'section': {
                'id': section.id,
                'name': section.name,
                'identifier': section.identifier,
                'is_visible': section.is_visible,
                'section_type': section.section_type,
                'description': describe_zone_config(section.config),
                'count': count_custom_zone_games(section.config),
            },
        }, status=201)

    except Exception as e:
        db.session.rollback()
        log_system_event(
            f"Failed to create discovery zone: {str(e)}",
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id,
        )
        return api_error('Internal server error', code='internal')


@admin2_bp.route('/admin/api/discovery_sections/<int:section_id>', methods=['PUT'])
@login_required
@admin_required
def update_discovery_section(section_id: int) -> tuple[Dict[str, Any], int]:
    """Edit a custom discovery zone's name and/or selection."""
    try:
        section = db.session.get(DiscoverySection, section_id)
        if not section:
            return api_error('Zone not found', code='not_found')
        if section.section_type != 'custom':
            return api_error('Only custom zones can be edited', code='bad_request')

        data = request.get_json() or {}
        name = str(data.get('name') or '').strip()
        if not name:
            return api_error('Zone name is required', code='bad_request')
        if len(name) > 50:
            return api_error('Zone name must be 50 characters or fewer', code='bad_request')

        config, error = validate_zone_config(
            data.get('mode'),
            game_uuids=data.get('game_uuids'),
            filter_type=data.get('filter_type'),
            filter_value=data.get('filter_value'),
        )
        if error:
            return api_error(error, code='bad_request')

        section.name = name
        section.config = config
        db.session.commit()

        log_system_event(
            f"Updated custom discovery zone '{name}'",
            event_type='admin_action',
            event_level='information',
            audit_user=current_user.id,
        )

        return api_ok({
                        'section': {
                'id': section.id,
                'name': section.name,
                'identifier': section.identifier,
                'is_visible': section.is_visible,
                'section_type': section.section_type,
                'description': describe_zone_config(section.config),
                'count': count_custom_zone_games(section.config),
            },
        })

    except Exception as e:
        db.session.rollback()
        log_system_event(
            f"Failed to update discovery zone {section_id}: {str(e)}",
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id,
        )
        return api_error('Internal server error', code='internal')


@admin2_bp.route('/admin/api/discovery_sections/<int:section_id>/schedule', methods=['PUT'])
@login_required
@admin_required
def update_discovery_section_schedule(section_id: int) -> tuple[Dict[str, Any], int]:
    """Set a shelf's storefront layout and its optional event window (W25-STORE-1).

    Applies to **every** shelf, not just custom zones: running a seed shelf like
    "Upcoming" as a limited-time feature is the whole point of the schedule.

    Body: ``layout`` (shelf|hero|carousel), ``starts_at`` / ``ends_at``
    (ISO 8601, or null to clear).
    """
    section = db.session.get(DiscoverySection, section_id)
    if not section:
        return api_error('Shelf not found', code='not_found')

    data = request.get_json(silent=True) or {}

    if 'layout' in data:
        layout = str(data.get('layout') or 'shelf').strip().lower()
        if layout not in ('shelf', 'hero', 'carousel'):
            return api_error(
                'layout must be shelf, hero, or carousel',
                code='bad_request',
            )
        section.layout = layout

    def _parse(key):
        raw = data.get(key)
        if raw in (None, ''):
            return None, None
        try:
            return datetime.fromisoformat(str(raw).replace('Z', '+00:00')), None
        except ValueError:
            return None, f'{key} must be an ISO timestamp'

    if 'starts_at' in data:
        value, error = _parse('starts_at')
        if error:
            return api_error(error, code='bad_request')
        section.starts_at = value
    if 'ends_at' in data:
        value, error = _parse('ends_at')
        if error:
            return api_error(error, code='bad_request')
        section.ends_at = value

    # A window that closes before it opens would silently hide the shelf forever.
    if section.starts_at and section.ends_at and section.ends_at <= section.starts_at:
        db.session.rollback()
        return api_error('ends_at must be after starts_at', code='bad_request')

    try:
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        log_system_event(
            f'Failed to update shelf schedule {section_id}: {exc}',
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id,
        )
        return api_error('Internal server error', code='internal')

    return api_ok({
                'section': {
            'id': section.id,
            'name': section.name,
            'identifier': section.identifier,
            'layout': section.layout,
            'starts_at': section.starts_at.isoformat() if section.starts_at else None,
            'ends_at': section.ends_at.isoformat() if section.ends_at else None,
            'is_live': section.is_live(),
        },
    })


@admin2_bp.route('/admin/api/discovery_sections/<int:section_id>/pin', methods=['PUT'])
@login_required
@admin_required
def update_discovery_section_pin(section_id: int) -> tuple[Dict[str, Any], int]:
    """Force a shelf into the reserved block at the top of every member's feed.

    Body: ``pin_rank`` — a number (lowest first), or null to release the shelf
    back to its ``display_order`` position.

    Only the first three forced shelves take effect. The cap is deliberate: a
    member gets three pins of their own, and an admin who could force ten would
    push every member's pins below the fold on their own home page.
    """
    section = db.session.get(DiscoverySection, section_id)
    if not section:
        return api_error('Shelf not found', code='not_found')

    data = request.get_json(silent=True) or {}
    raw = data.get('pin_rank')
    if raw in (None, ''):
        section.pin_rank = None
    else:
        try:
            section.pin_rank = int(raw)
        except (TypeError, ValueError):
            return api_error('pin_rank must be a whole number or null', code='bad_request')

    try:
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        log_system_event(
            f'Failed to update shelf pin {section_id}: {exc}',
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id,
        )
        return api_error('Internal server error', code='internal')

    log_system_event(
        (
            f"Released shelf '{section.name}' from the top block"
            if section.pin_rank is None
            else f"Forced shelf '{section.name}' to the top block at rank {section.pin_rank}"
        ),
        event_type='admin_action',
        event_level='information',
        audit_user=current_user.id,
    )

    return api_ok({
        'section': {
            'id': section.id,
            'identifier': section.identifier,
            'name': section.name,
            'pin_rank': section.pin_rank,
        },
    })


@admin2_bp.route('/admin/api/discovery_sections/<int:section_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_discovery_section(section_id: int) -> tuple[Dict[str, Any], int]:
    """Delete a custom discovery zone. Seed shelves cannot be deleted."""
    try:
        section = db.session.get(DiscoverySection, section_id)
        if not section:
            return api_error('Zone not found', code='not_found')
        if section.section_type != 'custom':
            return api_error('Only custom zones can be deleted', code='bad_request')

        name = section.name
        db.session.delete(section)
        db.session.commit()

        log_system_event(
            f"Deleted custom discovery zone '{name}'",
            event_type='admin_action',
            event_level='information',
            audit_user=current_user.id,
        )

        return api_ok({'message': f"Zone '{name}' deleted"})

    except Exception as e:
        db.session.rollback()
        log_system_event(
            f"Failed to delete discovery zone {section_id}: {str(e)}",
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id,
        )
        return api_error('Internal server error', code='internal')

@admin2_bp.route('/admin/api/discovery_sections/order', methods=['POST'])
@login_required
@admin_required
def update_section_order() -> tuple[Dict[str, Any], int]:
    """
    Update the display order of discovery sections.
    
    Expected JSON payload:
    {
        "sections": [
            {"id": 1, "order": 1},
            {"id": 2, "order": 2},
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        # Validate request data
        is_valid, error_msg = validate_json_request(data, ['sections'])
        if not is_valid:
            return api_error(error_msg, code='bad_request')
        
        if not isinstance(data['sections'], list):
            return api_error('sections must be an array', code='bad_request')
        
        updated_sections = []
        for section_data in data['sections']:
            # Validate each section data
            if not isinstance(section_data, dict) or 'id' not in section_data or 'order' not in section_data:
                return api_error('Invalid section data format', code='bad_request')
            
            try:
                section_id = int(section_data['id'])
                order = int(section_data['order'])
            except (ValueError, TypeError):
                return api_error('Section ID and order must be integers', code='bad_request')
            
            if order < 0:
                return api_error('Display order must be non-negative', code='bad_request')
            
            section = db.session.get(DiscoverySection, section_id)
            if not section:
                return api_error(f'Section with ID {section_id} not found', code='not_found')
            
            section.display_order = order
            updated_sections.append(section.name)
        
        db.session.commit()
        
        # Log the action for audit trail
        log_system_event(
            f"Updated display order for {len(updated_sections)} discovery sections: {', '.join(updated_sections)}",
            event_type='admin_action',
            event_level='information',
            audit_user=current_user.id
        )
        
        return api_ok({
                        'message': f'Updated order for {len(updated_sections)} sections',
            'updated_sections': updated_sections
        })
        
    except Exception as e:
        db.session.rollback()
        log_system_event(
            f"Failed to update discovery section order: {str(e)}",
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id
        )
        return api_error('Internal server error', code='internal')

@admin2_bp.route('/admin/api/discovery_sections/visibility', methods=['POST'])
@login_required
@admin_required
def update_section_visibility() -> tuple[Dict[str, Any], int]:
    """
    Update the visibility status of a discovery section.
    
    Expected JSON payload:
    {
        "section_id": 1,
        "is_visible": true
    }
    """
    try:
        data = request.get_json()
        
        # Validate request data
        is_valid, error_msg = validate_json_request(data, ['section_id', 'is_visible'])
        if not is_valid:
            return api_error(error_msg, code='bad_request')
        
        # Validate section_id
        try:
            section_id = int(data['section_id'])
        except (ValueError, TypeError):
            return api_error('section_id must be an integer', code='bad_request')
        
        # Validate is_visible
        if not isinstance(data['is_visible'], bool):
            return api_error('is_visible must be a boolean', code='bad_request')
        
        section = db.session.get(DiscoverySection, section_id)
        if not section:
            return api_error(f'Section with ID {section_id} not found', code='not_found')
        
        old_visibility = section.is_visible
        section.is_visible = data['is_visible']
        
        db.session.commit()
        
        # Log the action for audit trail
        visibility_status = 'visible' if data['is_visible'] else 'hidden'
        log_system_event(
            f"Changed discovery section '{section.name}' visibility to {visibility_status}",
            event_type='admin_action',
            event_level='information',
            audit_user=current_user.id
        )
        
        return api_ok({
                        'message': f"Section '{section.name}' is now {'visible' if data['is_visible'] else 'hidden'}",
            'section_name': section.name,
            'old_visibility': old_visibility,
            'new_visibility': data['is_visible']
        })
        
    except Exception as e:
        db.session.rollback()
        log_system_event(
            f"Failed to update discovery section visibility: {str(e)}",
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id
        )
        return api_error('Internal server error', code='internal')

@admin2_bp.route('/admin/api/system_logs/clear', methods=['DELETE'])
@login_required
@admin_required
def clear_system_logs() -> tuple[Dict[str, Any], int]:
    """
    Clear all system logs from the database.
    
    This is a destructive action that cannot be undone.
    The action is logged after clearing the logs for audit purposes.
    """
    try:
        # Get count of logs before deletion for the response
        logs_count = db.session.execute(select(db.func.count(SystemEvents.id))).scalar()
        
        # Delete all system events
        db.session.execute(db.delete(SystemEvents))
        db.session.commit()
        
        # Log the action after clearing logs so it persists
        log_system_event(
            f"System logs cleared by admin user '{current_user.name}' (ID: {current_user.id}). {logs_count} logs were deleted.",
            event_type='admin_action',
            event_level='warning',
            audit_user=current_user.id
        )
        
        return api_ok({
                        'message': f'Successfully cleared {logs_count} system logs',
            'deleted_count': logs_count
        })
        
    except Exception as e:
        db.session.rollback()
        log_system_event(
            f"Failed to clear system logs: {str(e)}",
            event_type='admin_action',
            event_level='error',
            audit_user=current_user.id
        )
        return api_error('Internal server error', code='internal')


@admin2_bp.route('/admin/clear_permission_errors', methods=['POST'])
@login_required
@admin_required
def clear_permission_errors() -> tuple[Dict[str, Any], int]:
    """Drop the scan write-permission failure payload after its modal is shown.

    Set by the scan path in ``utilities.py`` when a library path is not writable;
    without this the flags persist for the rest of the session and the modal
    re-opens on later visits.
    """
    for key in ('permission_check_failed', 'permission_errors', 'permission_check_path'):
        session.pop(key, None)
    return api_ok()
