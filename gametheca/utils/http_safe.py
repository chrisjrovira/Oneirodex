"""Outbound HTTP that keeps its promise across redirects.

The SSRF validators in :mod:`gametheca.utils.security` check the URL a caller
*asked for*. ``requests`` follows redirects by default, so the URL actually
fetched could be a different one entirely — a validated host answering ``302
Location: http://169.254.169.254/`` walked straight past every check in the
tree. There was no ``allow_redirects=False`` anywhere in application code.

So redirects are followed here instead, one hop at a time, revalidating before
each one. Same behaviour a caller already expects; the difference is that the
policy applies to every hop rather than only the first.

Callers pass the validator that matches their trust level — usually
``validate_user_outbound_http_url`` (never LAN) for provider/indexer/metadata
fetches, or ``validate_connector_http_url`` (LAN allowed when the homelab flag
is on) for admin-configured connectors.
"""

from __future__ import annotations

from typing import Callable
from urllib.parse import urljoin

import requests

DEFAULT_MAX_REDIRECTS = 5

Validator = Callable[[str], tuple[bool, str]]


class BlockedOutboundUrl(requests.RequestException):
    """A hop in the redirect chain failed the validator."""

    def __init__(self, url: str, reason: str):
        self.url = url
        self.reason = reason
        super().__init__(f'Blocked outbound URL: {reason}')


def _validated(url: str, validator: Validator) -> str:
    ok, result = validator(url)
    if not ok:
        raise BlockedOutboundUrl(url, result)
    return result


def safe_request(
    method: str,
    url: str,
    *,
    validator: Validator,
    session: requests.Session | None = None,
    max_redirects: int = DEFAULT_MAX_REDIRECTS,
    **kwargs,
) -> requests.Response:
    """Perform *method* on *url*, revalidating every redirect hop.

    Raises :class:`BlockedOutboundUrl` if the initial URL or any hop is
    rejected, and ``requests.TooManyRedirects`` past *max_redirects*.
    """
    kwargs.pop('allow_redirects', None)
    caller = session or requests
    current = _validated(url, validator)

    for _ in range(max_redirects + 1):
        response = caller.request(method, current, allow_redirects=False, **kwargs)
        if not response.is_redirect:
            return response

        location = response.headers.get('Location')
        if not location:
            return response

        # Relative Location is legal and common; resolve against the hop we
        # just made, then validate the absolute result.
        current = _validated(urljoin(current, location), validator)
        # A redirected GET must not replay the original body.
        kwargs.pop('data', None)
        kwargs.pop('json', None)
        kwargs.pop('files', None)
        method = 'GET' if response.status_code in (301, 302, 303) else method

    raise requests.TooManyRedirects(
        f'Exceeded {max_redirects} redirects starting from {url}'
    )


def safe_get(url: str, *, validator: Validator, **kwargs) -> requests.Response:
    """``safe_request('GET', …)``."""
    return safe_request('GET', url, validator=validator, **kwargs)
