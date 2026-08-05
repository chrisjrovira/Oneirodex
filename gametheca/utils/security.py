"""Security utilities for path validation and outbound URL checks."""

from __future__ import annotations

import ipaddress
import re
from pathlib import Path
from urllib.parse import urlparse

from flask import current_app


def is_safe_path(user_path, allowed_bases):
    """Securely validate that a user-provided path is within allowed directories."""
    if not user_path or not isinstance(user_path, str):
        return False, "Invalid path format"

    user_path = user_path.strip()
    if not user_path:
        return False, "Empty path"

    if '\x00' in user_path:
        return False, "Invalid path format"

    if len(user_path) > 4096:
        return False, "Path too long"

    try:
        user_path_obj = Path(user_path).resolve(strict=False)

        for base in allowed_bases:
            if not base:
                continue

            try:
                base_path_obj = Path(base).resolve(strict=False)
                try:
                    user_path_obj.relative_to(base_path_obj)
                    return True, None
                except ValueError:
                    continue

            except (OSError, ValueError) as e:
                current_app.logger.warning(f"Invalid base path {sanitize_path_for_logging(base)}: {e}")
                continue

        return False, "Access denied - path outside allowed directories"

    except (OSError, ValueError) as e:
        current_app.logger.warning(f"Path validation error for {sanitize_path_for_logging(user_path)}: {e}")
        return False, "Invalid path format"


def get_allowed_base_directories(app):
    """Get allowed base directories from app configuration."""
    allowed_bases = []
    games = app.config.get('DATA_FOLDER_GAMES')
    if games:
        allowed_bases.append(games)
    config_keys = ['BASE_FOLDER_WINDOWS', 'BASE_FOLDER_POSIX']
    for key in config_keys:
        base_path = app.config.get(key)
        if base_path:
            allowed_bases.append(base_path)
    return allowed_bases


def sanitize_path_for_logging(path, max_length=100):
    """Sanitize path for safe logging by truncating and masking sensitive parts."""
    if not path or not isinstance(path, str):
        return "[INVALID_PATH]"

    if len(path) > max_length:
        truncated = f"{path[:30]}...{path[-(max_length - 33):]}"
    else:
        truncated = path

    sanitized = re.sub(r'[Uu]sers?/[^/]+', 'Users/[USER]', truncated)
    sanitized = re.sub(r'[Hh]ome/[^/]+', 'home/[USER]', sanitized)
    sanitized = re.sub(r'\\\\[Uu]sers\\\\[^\\\\]+', r'\\Users\\[USER]', sanitized)

    return sanitized


def is_blocked_outbound_host(hostname: str | None) -> bool:
    """Block obvious SSRF targets (localhost, link-local, private IPv4 literals)."""
    if not hostname:
        return True
    host = hostname.strip().lower().rstrip('.')
    if host in {'localhost', 'metadata.google.internal'} or host.endswith('.local'):
        return True
    if host.startswith('[') and host.endswith(']'):
        host = host[1:-1]
    try:
        ip = ipaddress.ip_address(host)
        return bool(
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        )
    except ValueError:
        pass
    if re.match(r'^\d+\.\d+\.\d+\.\d+$', host):
        return True
    return False


def allow_private_lan_urls_enabled() -> bool:
    """Homelab opt-in: allow private/RFC1918 hosts for *arr / Ollama connectors."""
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            return bool(current_app.config.get('ALLOW_PRIVATE_LAN_URLS'))
    except Exception:
        pass
    import os

    return os.getenv('ALLOW_PRIVATE_LAN_URLS', 'false').lower() in ('1', 'true', 'yes')


def validate_outbound_http_url(
    url: str,
    *,
    allow_http: bool = False,
    allow_private_lan: bool | None = None,
    allowed_hostnames: set[str] | None = None,
) -> tuple[bool, str]:
    """Validate an outbound http(s) URL for SSRF-sensitive server fetches."""
    if not url or not isinstance(url, str):
        return False, 'URL required'
    candidate = url.strip()
    if candidate.startswith('//'):
        candidate = 'https:' + candidate
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False, 'Invalid URL'
    if parsed.scheme not in ({'http', 'https'} if allow_http else {'https'}):
        return False, 'URL scheme not allowed'
    if not parsed.hostname:
        return False, 'URL host required'
    lan_ok = allow_private_lan_urls_enabled() if allow_private_lan is None else bool(allow_private_lan)
    if is_blocked_outbound_host(parsed.hostname) and not lan_ok:
        return False, 'URL host is not allowed'
    if lan_ok and is_blocked_outbound_host(parsed.hostname):
        # Still block cloud metadata endpoints even when LAN is allowed.
        host = parsed.hostname.strip().lower().rstrip('.')
        if host in {'169.254.169.254', 'metadata.google.internal'} or host.startswith('169.254.'):
            return False, 'URL host is not allowed'
    if allowed_hostnames is not None and parsed.hostname.lower() not in {
        h.lower() for h in allowed_hostnames
    }:
        return False, 'URL host is not on the allowlist'
    return True, candidate


def validate_connector_http_url(url: str) -> tuple[bool, str]:
    """Admin-configured *arr / Ollama base URLs — respects ALLOW_PRIVATE_LAN_URLS."""
    return validate_outbound_http_url(url, allow_http=True)


def validate_user_outbound_http_url(url: str) -> tuple[bool, str]:
    """User/indexer/metadata fetches — never LAN even if the homelab flag is on."""
    return validate_outbound_http_url(url, allow_http=True, allow_private_lan=False)


def validate_community_chat_url(url: str) -> tuple[bool, str]:
    """BYO community link — http(s); block private/localhost hosts."""
    if not url:
        return True, ''
    candidate = url.strip()
    if not (candidate.startswith('http://') or candidate.startswith('https://')):
        return False, 'Community chat URL must start with http:// or https://'
    if len(candidate) > 512:
        return False, 'Community chat URL is too long'
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False, 'Invalid community chat URL'
    if is_blocked_outbound_host(parsed.hostname):
        return False, 'Community chat URL host is not allowed'
    return True, candidate
