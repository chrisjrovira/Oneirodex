"""Compare local facts vs store remotes; produce status + confidence."""

from __future__ import annotations

import re
from datetime import datetime, timezone


def parse_version_tuple(value: str | None) -> tuple[int, ...] | None:
    if not value:
        return None
    match = re.search(r'(\d+(?:\.\d+){0,3})', str(value))
    if not match:
        return None
    parts = match.group(1).split('.')
    try:
        return tuple(int(p) for p in parts)
    except ValueError:
        return None


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        text = value.replace('Z', '+00:00')
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _dlc_diff(local: dict, remotes: list[dict]) -> dict:
    local_hint = local.get('dlc_count_hint')
    update_hints = local.get('update_hints') or []
    steam = next((r for r in remotes if r.get('store') == 'steam' and r.get('ok')), None)
    gog = next((r for r in remotes if r.get('store') == 'gog' and r.get('ok')), None)

    store_count = None
    store_titles = []
    if steam and steam.get('dlc_count') is not None:
        store_count = steam['dlc_count']
    elif gog and gog.get('dlc_count') is not None:
        store_count = gog['dlc_count']
        store_titles = gog.get('dlc_titles') or []

    missing_count = None
    if store_count is not None and local_hint is not None:
        missing_count = max(store_count - int(local_hint), 0)
    elif store_count is not None and not update_hints and store_count > 0:
        missing_count = store_count  # no local DLC hint → possibly all missing

    return {
        'local_dlc_count_hint': local_hint,
        'local_update_hints': update_hints,
        'store_dlc_count': store_count,
        'store_dlc_sample': store_titles[:15],
        'missing_dlc_count_estimate': missing_count,
    }


def compare_freshness(local: dict, remotes: list[dict]) -> dict:
    """Return status, confidence, reasons, and summary strings."""
    local_ver = local.get('version')
    local_tuple = parse_version_tuple(local_ver)

    comparable_remote = None
    for remote in remotes:
        if not remote.get('ok'):
            continue
        # Prefer remotes that look like semver, not release dates / slugs
        remote_tuple = parse_version_tuple(remote.get('version'))
        if remote_tuple and local_tuple and remote.get('store') in ('steam', 'gog'):
            # Steam version is often a date string — skip date-like only
            if remote.get('store') == 'steam' and remote.get('version') == remote.get('release_date'):
                continue
            comparable_remote = remote
            break

    dlc = _dlc_diff(local, remotes)
    reasons = []

    if comparable_remote and local_tuple:
        remote_tuple = parse_version_tuple(comparable_remote.get('version'))
        if remote_tuple:
            if local_tuple == remote_tuple:
                status, confidence = 'up_to_date', 'high'
                reasons.append('semantic_version_match')
            elif local_tuple < remote_tuple:
                status, confidence = 'behind', 'high'
                reasons.append('local_version_older')
            else:
                status, confidence = 'up_to_date', 'high'
                reasons.append('local_version_newer_or_equal')
            return _pack(status, confidence, reasons, local, remotes, dlc, comparable_remote)

    # Heuristic: Steam news newer than folder mtime
    steam = next((r for r in remotes if r.get('store') == 'steam' and r.get('ok')), None)
    folder_mtime = _parse_iso(local.get('folder_mtime'))
    news_dt = _parse_iso((steam or {}).get('last_news_date'))
    if steam and folder_mtime and news_dt and news_dt > folder_mtime:
        reasons.append('steam_news_newer_than_folder')
        if dlc.get('missing_dlc_count_estimate'):
            reasons.append('possible_missing_dlc')
        return _pack('heuristic_behind', 'low', reasons, local, remotes, dlc, steam)

    if dlc.get('missing_dlc_count_estimate') and dlc['missing_dlc_count_estimate'] > 0:
        reasons.append('dlc_count_gap')
        return _pack('heuristic_behind', 'low', reasons, local, remotes, dlc, steam)

    reasons.append('insufficient_comparable_versions')
    return _pack('unknown', 'none', reasons, local, remotes, dlc, comparable_remote or steam)


def _pack(status, confidence, reasons, local, remotes, dlc, primary_remote):
    remote_bits = []
    for remote in remotes:
        if not remote.get('ok'):
            continue
        label = remote.get('store', '?').upper()
        ver = remote.get('version') or remote.get('name') or 'ok'
        remote_bits.append(f'{label}: {ver}')
    summary_remote = ' | '.join(remote_bits) if remote_bits else None
    return {
        'status': status,
        'confidence': confidence,
        'reasons': reasons,
        'local_version': local.get('version'),
        'remote_version_summary': summary_remote,
        'primary_remote_store': (primary_remote or {}).get('store'),
        'dlc': dlc,
        'local': local,
        'remotes': remotes,
    }
