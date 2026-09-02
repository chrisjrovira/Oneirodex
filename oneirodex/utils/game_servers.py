"""Household game server registry helpers and health probes."""

from __future__ import annotations

import re
import socket
from typing import Any
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

_CONNECT_RE = re.compile(
    r'^(?:(?:tcp|udp)://)?(?P<host>[^:\s]+)(?::(?P<port>\d+))?$',
    re.I,
)


def parse_connect_string(connect_string: str | None) -> tuple[str | None, int | None]:
    """Parse host:port from a connect string."""
    raw = (connect_string or '').strip()
    if not raw:
        return None, None
    if '://' in raw:
        parsed = urlparse(raw)
        host = parsed.hostname
        port = parsed.port
        if host and port:
            return host, port
        if host:
            return host, None
    match = _CONNECT_RE.match(raw)
    if not match:
        return None, None
    host = match.group('host')
    port_text = match.group('port')
    port = int(port_text) if port_text else None
    return host, port


def probe_server_health(
    connect_string: str | None,
    health_url: str | None,
    *,
    timeout: float = 2.0,
) -> dict[str, Any]:
    """Best-effort HTTP or TCP health check for a registered server."""
    url = (health_url or '').strip()
    if url.lower().startswith(('http://', 'https://')):
        try:
            request = Request(url, method='GET')
            with urlopen(request, timeout=timeout) as response:
                status = getattr(response, 'status', None) or response.getcode()
                reachable = 200 <= int(status) < 400
                return {
                    'reachable': reachable,
                    'method': 'http',
                    'status_code': int(status),
                    'error': None if reachable else f'HTTP {status}',
                }
        except (URLError, OSError, ValueError, TimeoutError) as exc:
            return {
                'reachable': False,
                'method': 'http',
                'status_code': None,
                'error': str(exc),
            }

    host, port = parse_connect_string(connect_string)
    if not host:
        return {
            'reachable': None,
            'method': None,
            'status_code': None,
            'error': 'No health URL or connect string',
        }
    if port is None:
        port = 25565
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return {
                'reachable': True,
                'method': 'tcp',
                'status_code': None,
                'error': None,
            }
    except OSError as exc:
        return {
            'reachable': False,
            'method': 'tcp',
            'status_code': None,
            'error': str(exc),
        }
