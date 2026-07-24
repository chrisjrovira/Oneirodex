# gametheca/utils/ops_issues.py
SEVERITY_RANK = {'good': 0, 'warn': 1, 'bad': 2}


def _worst(current, candidate):
    return candidate if SEVERITY_RANK[candidate] > SEVERITY_RANK[current] else current


def derive_issues(
    *,
    disk_base_percent,
    disk_warez_percent,
    path_problems,
    scan_failures,
    recent_error_count,
):
    items = []
    overall = 'good'

    def add(issue_id, severity, message, href=None):
        nonlocal overall
        overall = _worst(overall, severity)
        item = {'id': issue_id, 'severity': severity, 'message': message}
        if href:
            item['href'] = href
        items.append(item)

    for label, percent, warn_id, bad_id, name in (
        ('base', disk_base_percent, 'disk_base_high', 'disk_base_critical', 'Base disk'),
        ('warez', disk_warez_percent, 'disk_warez_high', 'disk_warez_critical', 'Warez disk'),
    ):
        if percent is None:
            continue
        if percent >= 95:
            add(bad_id, 'bad', f'{name} {percent:.0f}% used')
        elif percent >= 85:
            add(warn_id, 'warn', f'{name} {percent:.0f}% used')

    for problem in path_problems or []:
        key = problem.get('key', 'path')
        reason = problem.get('reason', 'unavailable')
        add(f'path_{key}', 'bad', f'{key} {reason}')

    if scan_failures:
        add(
            'scan_failures',
            'bad' if scan_failures > 1 else 'warn',
            f'{scan_failures} scan job(s) failed or errored',
            href='/scan_management',
        )

    if recent_error_count:
        add(
            'recent_errors',
            'warn',
            f'{recent_error_count} error event(s) in the last 24h',
            href='/admin/system_logs',
        )

    return {'overall': overall, 'items': items}
