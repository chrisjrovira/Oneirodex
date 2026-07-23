from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select

from sharewarez import db
from sharewarez.models import (
    DownloadRequest,
    Game,
    Library,
    ScanJob,
    SystemEvents,
    UnmatchedFolder,
)
from sharewarez.utils.ops_issues import derive_issues
from sharewarez.utils.ops_network import get_network_stats
from sharewarez.utils.status import get_config_values, get_system_info
from sharewarez.utils.system_stats import (
    get_cpu_usage,
    get_disk_usage,
    get_memory_usage,
    get_warez_folder_usage,
)
from sharewarez.utils.uptime import (
    get_formatted_app_uptime,
    get_formatted_system_uptime,
)


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


def build_ops_summary(app_start_time):
    """Build a single snapshot for the admin operations dashboard."""
    def get_host_section():
        cpu = get_cpu_usage()
        memory = get_memory_usage()
        disk_base = get_disk_usage()
        disk_warez = get_warez_folder_usage()
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
                'disk_warez': disk_warez,
                'uptime_system': get_formatted_system_uptime(),
                'uptime_app': get_formatted_app_uptime(app_start_time),
            },
            'config_values': config_values,
            'disk_base': disk_base,
            'disk_warez': disk_warez,
        }

    host_data, host_error = _section('host', get_host_section)
    network, network_error = _section('network', get_network_stats)
    scans, scans_error = _section('scans', _scan_snapshot)
    library, library_error = _section('library', _library_pulse)
    recent_errors_data, recent_errors_error = _section('recent errors', _recent_errors)

    host = host_data['host'] if host_data else None
    disk_base = host_data['disk_base'] if host_data else None
    disk_warez = host_data['disk_warez'] if host_data else None
    config_values = host_data['config_values'] if host_data else {}
    scan_failures = scans['failure_count'] if scans else 0
    recent_errors, recent_error_count = recent_errors_data or (None, 0)

    summary = {
        'as_of': datetime.now(timezone.utc).isoformat(),
        'host': host,
        'network': network,
        'issues': derive_issues(
            disk_base_percent=disk_base.get('percent') if disk_base else None,
            disk_warez_percent=disk_warez.get('percent') if disk_warez else None,
            path_problems=_path_problems(config_values),
            scan_failures=scan_failures,
            recent_error_count=recent_error_count,
        ),
        'scans': {
            'active_count': scans['active_count'],
            'jobs': scans['jobs'],
        } if scans else None,
        'library': library,
        'recent_errors': recent_errors,
    }
    for section_name, error in (
        ('host', host_error),
        ('network', network_error),
        ('scans', scans_error),
        ('library', library_error),
        ('recent_errors', recent_errors_error),
    ):
        if error:
            summary[f'{section_name}_error'] = error

    return summary
