from flask import Blueprint, flash, jsonify, redirect, render_template, url_for
from flask_login import login_required
from gametheca.utils.auth import admin_required
from gametheca.utils.processors import get_global_settings
from gametheca.utils.system_stats import format_bytes, get_cpu_usage, get_memory_usage, get_disk_usage, get_process_count, get_open_files, get_games_folder_usage
from gametheca.utils.uptime import get_formatted_system_uptime, get_formatted_app_uptime
from gametheca.utils.status import get_system_info, get_config_values, get_active_users, get_log_info, check_server_settings, get_database_info
from gametheca import app_version, app_start_time
from gametheca import cache
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.ops_summary import build_ops_summary
from gametheca.utils.health_probes import build_liveness, build_readiness

info_bp = Blueprint('info', __name__)


@info_bp.route('/healthz', methods=['GET', 'HEAD'])
def healthz():
    """Liveness — process is up (no DB). For Docker/Unraid probes."""
    return jsonify(build_liveness()), 200


@info_bp.route('/readyz', methods=['GET', 'HEAD'])
def readyz():
    """Readiness — DB reachable + startup init complete (or TESTING)."""
    payload, status = build_readiness()
    return jsonify(payload), status

@info_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


@info_bp.route('/admin/server_status_page')
@login_required
@admin_required
def admin_server_status():
    # Check server settings
    settings_valid, error_message = check_server_settings()
    if not settings_valid:
        flash(error_message, 'warning')
        return redirect(url_for('site.admin_dashboard'))

    try:
        # Get all required statistics
        cpu_usage = get_cpu_usage()
        process_count = get_process_count()
        open_files = get_open_files()
        memory_usage = get_memory_usage()
        disk_usage = get_disk_usage()
        games_usage = get_games_folder_usage()
        system_info = get_system_info()
        config_values = get_config_values()
        active_users = get_active_users()
        log_info = get_log_info()
        database_info = get_database_info()
        
        # Format usage statistics
        for usage in [memory_usage, disk_usage, games_usage]:
            if usage:
                for key in ['total', 'used', 'available', 'free']:
                    if key in usage:
                        usage[f'{key}_formatted'] = format_bytes(usage[key])

        # Add uptime information to system_info
        system_info['System Uptime'] = get_formatted_system_uptime()
        system_info['Application Uptime'] = get_formatted_app_uptime(app_start_time)

        # Log the access
        log_system_event("Admin accessed server status page", event_type='audit', event_level='information')

    except Exception as e:
        flash(f'Error accessing server settings: {str(e)}', 'error')
        return redirect(url_for('site.admin_dashboard'))

    return render_template(
        'admin/admin_server_status.html',
        config_values=config_values,
        system_info=system_info,
        app_version=app_version,
        process_count=process_count,
        open_files=open_files,
        cpu_usage=cpu_usage,
        memory_usage=memory_usage,
        disk_usage=disk_usage,
        games_usage=games_usage,
        log_count=log_info['count'],
        active_users=active_users,
        latest_log=log_info['latest'],
        database_info=database_info
    )


@info_bp.route('/admin/new_server_info')
@login_required
@admin_required
def new_server_info():
    """New server info page - same functionality as original but for new settings section."""
    # Check server settings
    settings_valid, error_message = check_server_settings()
    if not settings_valid:
        flash(error_message, 'warning')
        return redirect(url_for('site.admin_dashboard'))

    try:
        # Get all required statistics
        cpu_usage = get_cpu_usage()
        process_count = get_process_count()
        open_files = get_open_files()
        memory_usage = get_memory_usage()
        disk_usage = get_disk_usage()
        games_usage = get_games_folder_usage()

        # Get system and configuration info
        system_info = get_system_info()
        config_values = get_config_values()
        active_users = get_active_users()
        log_info = get_log_info()
        database_info = get_database_info()

        log_system_event("Admin accessed new server info page", event_type='audit', event_level='information')

    except Exception as e:
        flash(f'Error accessing server settings: {str(e)}', 'error')
        return redirect(url_for('site.admin_dashboard'))

    return render_template(
        'admin/new_server_info.html',
        config_values=config_values,
        system_info=system_info,
        app_version=app_version,
        process_count=process_count,
        open_files=open_files,
        cpu_usage=cpu_usage,
        memory_usage=memory_usage,
        disk_usage=disk_usage,
        games_usage=games_usage,
        log_count=log_info['count'],
        active_users=active_users,
        latest_log=log_info['latest'],
        database_info=database_info
    )


@info_bp.route('/admin/ops')
@login_required
@admin_required
def admin_ops():
    """Render the administrator operations glance page."""
    log_system_event(
        'Admin accessed ops glance',
        event_type='audit',
        event_level='information',
    )
    settings = get_global_settings()
    return render_template(
        'admin/admin_ops.html',
        enable_server_status=bool(settings.get('enable_server_status', False)),
    )


@info_bp.route('/admin/api/ops/summary')
@login_required
@admin_required
def ops_summary_api():
    """Return the current operations summary snapshot."""
    try:
        return jsonify(build_ops_summary(app_start_time))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 503
