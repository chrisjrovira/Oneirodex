from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy import func, or_, select

from gametheca import db
from gametheca.models import (
    ClientDevice,
    DownloadRequest,
    Game,
    GameServer,
    Library,
    ScanJob,
    SystemEvents,
    UnmatchedFolder,
)
from gametheca.utils.game_servers import probe_server_health
from gametheca.utils.livekit_rtc import livekit_config, livekit_enabled
from gametheca.utils.malware_scan import malware_scan_enabled, module_status
from gametheca.utils.ops_issues import derive_issues
from gametheca.utils.ops_network import get_network_stats
from gametheca.utils.status import get_config_values, get_system_info
from gametheca.utils.system_stats import (
    get_cpu_usage,
    get_disk_usage,
    get_memory_usage,
    get_games_folder_usage,
)
from gametheca.utils.uptime import (
    get_formatted_app_uptime,
    get_formatted_system_uptime,
)

# Companions are "online" if they heartbeated within this window.
_COMPANION_ONLINE_MINUTES = 3


def _path_problems(config_values):
    """Return configured paths that are missing or not writable."""
    problems = []
    for key, details in (config_values or {}).items():
        if not details.get('exists', False):
            problems.append({'key': key, 'reason': 'missing'})
        elif not details.get('write', False):
            problems.append({'key': key, 'reason': 'not writable'})
    return problems


def _library_pulse():
    """Return counts that describe the state of the game library."""
    return {
        'libraries': db.session.execute(select(func.count(Library.uuid))).scalar(),
        'games': db.session.execute(select(func.count(Game.id))).scalar(),
        'unmatched_folders': db.session.execute(
            select(func.count(UnmatchedFolder.id))
        ).scalar(),
        'download_requests_open': db.session.execute(
            select(func.count(DownloadRequest.id)).where(
                DownloadRequest.status.in_(('pending', 'processing'))
            )
        ).scalar(),
    }


def _scan_snapshot():
    """Return active scan jobs and recent scan failure count."""
    active_jobs = db.session.execute(
        select(ScanJob)
        .where(ScanJob.status.in_(('Running', 'Stopping')))
        .order_by(ScanJob.last_progress_update.desc())
    ).scalars().all()

    jobs = []
    for job in active_jobs:
        total = job.total_folders or 0
        completed = (job.folders_success or 0) + (job.folders_failed or 0)
        progress = round(completed * 100 / total) if total > 0 else 0
        jobs.append(
            {
                'id': job.id,
                'library': job.library.name if job.library else None,
                'status': job.status.lower(),
                'progress': progress,
                'errors': job.folders_failed or 0,
            }
        )

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    failure_count = db.session.execute(
        select(func.count(ScanJob.id)).where(
            or_(
                (ScanJob.status == 'Failed') & (ScanJob.last_run >= since),
                (ScanJob.status == 'Running') & ScanJob.error_message.isnot(None),
                ScanJob.status.in_(('Running', 'Stopping'))
                & (ScanJob.folders_failed > 0),
            )
        )
    ).scalar()

    return {
        'active_count': len(jobs),
        'jobs': jobs,
        'failure_count': failure_count,
    }


def _recent_errors():
    """Return recent error events and their count over the last day."""
    error_filter = or_(
        SystemEvents.event_level.in_(('error', 'critical')),
        SystemEvents.event_type == 'error',
    )
    events = db.session.execute(
        select(SystemEvents)
        .where(
            error_filter,
            SystemEvents.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24),
        )
        .order_by(SystemEvents.timestamp.desc())
        .limit(10)
    ).scalars().all()

    recent_error_count = db.session.execute(
        select(func.count(SystemEvents.id)).where(
            error_filter,
            SystemEvents.timestamp >= datetime.now(timezone.utc) - timedelta(hours=24),
        )
    ).scalar()

    return (
        [
            {
                'id': event.id,
                'timestamp': event.timestamp.isoformat() if event.timestamp else None,
                'event_type': event.event_type,
                'text': event.event_text,
            }
            for event in events
        ],
        recent_error_count,
    )


def _section(section_name, getter):
    """Return a dashboard section or a safe error for failed collection."""
    try:
        return getter(), None
    except Exception as exc:
        print(f'Unable to collect operations {section_name} section: {exc}')
        return None, f'{section_name.replace("_", " ").title()} data unavailable'


def _livekit_pulse():
    """Flag + config presence + best-effort TCP reachability (no Discord)."""
    import socket

    enabled = livekit_enabled()
    cfg = livekit_config()
    url = cfg.get('url') or ''
    keys_set = bool(cfg.get('api_key') and cfg.get('api_secret'))
    host = None
    port = None
    reachable = None
    error = None
    if url:
        parsed = urlparse(url if '://' in url else f'ws://{url}')
        host = parsed.hostname
        port = parsed.port or (7880 if parsed.scheme in ('ws', 'http', '') else 443)
        if host:
            try:
                with socket.create_connection((host, int(port)), timeout=1.5):
                    reachable = True
            except OSError as exc:
                reachable = False
                error = str(exc)
    configured = bool(enabled and url and keys_set)
    return {
        'enabled': enabled,
        'configured': configured,
        'url_set': bool(url),
        'keys_set': keys_set,
        'reachable': reachable,
        'error': error,
        'note': (
            None
            if configured
            else 'Enable LiveKit + set LIVEKIT_URL/API_KEY/SECRET; use compose --profile livekit'
        ),
    }


def _malware_pulse():
    """Reuse malware module_status (ClamAV ping + heuristics flags)."""
    status = module_status()
    clam = status.get('clamav') or {}
    return {
        'enabled': bool(status.get('enabled')),
        'block_on_hit': bool(status.get('block_on_hit')),
        'clamav_reachable': bool(clam.get('reachable') or clam.get('available')),
        'clamav_version': clam.get('version'),
        'clamav_error': clam.get('error'),
        'heuristics': status.get('heuristics') or {},
    }


def _companion_pulse():
    """Count companion devices seen recently via heartbeat."""
    since = datetime.now(timezone.utc) - timedelta(minutes=_COMPANION_ONLINE_MINUTES)
    online = db.session.execute(
        select(func.count(ClientDevice.id)).where(ClientDevice.last_seen_at >= since)
    ).scalar() or 0
    total = db.session.execute(select(func.count(ClientDevice.id))).scalar() or 0
    return {
        'online': online,
        'registered': total,
        'window_minutes': _COMPANION_ONLINE_MINUTES,
    }


def _queue_pulse():
    """Scan + download queue depths for near-realtime ops."""
    scans = _scan_snapshot()
    open_downloads = db.session.execute(
        select(func.count(DownloadRequest.id)).where(
            DownloadRequest.status.in_(('pending', 'processing'))
        )
    ).scalar() or 0
    pending_scans = db.session.execute(
        select(func.count(ScanJob.id)).where(ScanJob.status == 'Scheduled')
    ).scalar() or 0
    return {
        'scans_active': scans['active_count'],
        'scans_pending': pending_scans,
        'scans_failures_24h': scans['failure_count'],
        'downloads_open': open_downloads,
    }


def _game_servers_pulse():
    """Registered household servers with best-effort health."""
    servers = db.session.execute(
        select(GameServer).order_by(GameServer.display_name.asc())
    ).scalars().all()
    rows = []
    for server in servers:
        health = probe_server_health(
            server.connect_string,
            server.health_url,
            timeout=1.5,
        )
        rows.append({
            'uuid': server.uuid,
            'display_name': server.display_name,
            'reachable': health.get('reachable'),
            'method': health.get('method'),
            'error': health.get('error'),
        })
    reachable = sum(1 for row in rows if row.get('reachable') is True)
    return {
        'count': len(rows),
        'reachable': reachable,
        'servers': rows,
    }


def _services_snapshot():
    """Sidecar / companion / queue pulse for Admin Ops."""
    return {
        'livekit': _livekit_pulse(),
        'malware': _malware_pulse(),
        'companions': _companion_pulse(),
        'queues': _queue_pulse(),
        'game_servers': _game_servers_pulse(),
        'malware_module_enabled': malware_scan_enabled(),
    }


def build_ops_summary(app_start_time):
    """Build a single snapshot for the admin operations dashboard."""
    def get_host_section():
        cpu = get_cpu_usage()
        memory = get_memory_usage()
        disk_base = get_disk_usage()
        disk_games = get_games_folder_usage()
        system_info = get_system_info()
        config_values = get_config_values()
        return {
            'host': {
                'os': system_info.get('Operating System'),
                'hostname': system_info.get('Hostname'),
                'ip': system_info.get('IP Address'),
                'python': system_info.get('Python Version'),
                'cpu': cpu,
                'memory': memory,
                'disk_base': disk_base,
                'disk_games': disk_games,
                'uptime_system': get_formatted_system_uptime(),
                'uptime_app': get_formatted_app_uptime(app_start_time),
            },
            'config_values': config_values,
            'disk_base': disk_base,
            'disk_games': disk_games,
        }

    host_data, host_error = _section('host', get_host_section)
    network, network_error = _section('network', get_network_stats)
    scans, scans_error = _section('scans', _scan_snapshot)
    library, library_error = _section('library', _library_pulse)
    recent_errors_data, recent_errors_error = _section('recent errors', _recent_errors)
    services, services_error = _section('services', _services_snapshot)

    host = host_data['host'] if host_data else None
    disk_base = host_data['disk_base'] if host_data else None
    disk_games = host_data['disk_games'] if host_data else None
    config_values = host_data['config_values'] if host_data else {}
    scan_failures = scans['failure_count'] if scans else 0
    recent_errors, recent_error_count = recent_errors_data or (None, 0)

    summary = {
        'as_of': datetime.now(timezone.utc).isoformat(),
        'host': host,
        'network': network,
        'issues': derive_issues(
            disk_base_percent=disk_base.get('percent') if disk_base else None,
            disk_games_percent=disk_games.get('percent') if disk_games else None,
            path_problems=_path_problems(config_values),
            scan_failures=scan_failures,
            recent_error_count=recent_error_count,
        ),
        'scans': {
            'active_count': scans['active_count'],
            'jobs': scans['jobs'],
        } if scans else None,
        'library': library,
        'services': services,
        'recent_errors': recent_errors,
    }
    for section_name, error in (
        ('host', host_error),
        ('network', network_error),
        ('scans', scans_error),
        ('library', library_error),
        ('services', services_error),
        ('recent_errors', recent_errors_error),
    ):
        if error:
            summary[f'{section_name}_error'] = error

    return summary
