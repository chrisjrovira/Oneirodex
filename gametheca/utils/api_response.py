"""One JSON envelope for every API response (GT-B1).

Why this exists
---------------
Before this module there were ~699 ``jsonify`` call sites across ~72 route
files using at least five competing shapes for the same idea::

    jsonify({'error': 'Admin required'}), 403
    jsonify({'message': 'Saved'})
    jsonify({'status': 'ok'})
    jsonify({'success': True})
    jsonify({'ok': False, ...})

``gametheca/routes.py`` alone used four of them. The cost landed on the
frontend: a shared error component is impossible when every call site reports
failure differently, which is why the SPA had no error state at all and each
page improvised its own.

Compatibility contract
----------------------
This is deliberately **additive**. The envelope keeps ``error`` as a plain
human-readable string — the dominant legacy shape — and mirrors ``message`` and
``success`` alongside it. Any existing caller reading ``data.error``,
``data.message`` or ``data.success`` keeps working unchanged, so routes can be
migrated one at a time instead of in a single risky sweep.

New clients should read:

``ok``
    Boolean. The only field guaranteed present on every response.
``error``
    Human-readable sentence, safe to show a household member. ``None`` on success.
``error_code``
    Stable machine token (``snake_case``) for branching. Never shown to users.
``detail``
    Optional structured extra for operators (field errors, upstream status).
    Never rendered as the headline.

Security
--------
``detail`` is passed through as given, so callers must not put secrets, tokens,
raw ``.env`` values or full filesystem paths in it — the same rule the rest of
the codebase follows for scrubbed logging.
"""

from __future__ import annotations

from typing import Any, Mapping

from flask import jsonify

__all__ = ['api_ok', 'api_error', 'ERROR_CODES']


# Stable codes. Add here rather than inventing strings at the call site, so the
# frontend can branch on a known set and QA can assert on it.
ERROR_CODES = {
    'bad_request': 400,
    'unauthorized': 401,
    'forbidden': 403,
    'not_found': 404,
    'conflict': 409,
    'unprocessable': 422,
    'rate_limited': 429,
    'internal': 500,
    'unavailable': 503,
}


def api_ok(payload: Mapping[str, Any] | None = None, *, status: int = 200, **extra):
    """Success envelope.

    ``payload`` is merged at the top level so existing response bodies keep
    their current field names — callers migrating a route do not have to move
    their data under a new ``data`` key.

    Reserved keys (``ok``, ``error``, ``error_code``) are not overridable; a
    payload carrying them would defeat the point of a stable envelope.
    """
    body: dict[str, Any] = {}
    if payload:
        body.update(payload)
    if extra:
        body.update(extra)

    for reserved in ('ok', 'error', 'error_code'):
        body.pop(reserved, None)

    body['ok'] = True
    # Legacy mirror: pre-GT-B1 clients branch on `success`.
    body.setdefault('success', True)
    return jsonify(body), status


def api_error(
    message: str,
    *,
    code: str = 'bad_request',
    status: int | None = None,
    detail: Any = None,
    **extra,
):
    """Failure envelope.

    ``status`` defaults to the HTTP status mapped from ``code``, so the common
    case is a single argument::

        return api_error('Admin required', code='forbidden')

    An explicit ``status`` still wins, for routes that must keep a specific code
    for backwards compatibility (there are existing 403-vs-503 contracts in the
    AI triage tests that must not shift silently).
    """
    resolved_status = status if status is not None else ERROR_CODES.get(code, 400)
    text = str(message or '').strip() or 'Request failed'

    body: dict[str, Any] = {}
    if extra:
        body.update(extra)

    body['ok'] = False
    # `error` stays a string on purpose — see module docstring. Turning it into
    # an object would render as "[object Object]" in every unmigrated caller.
    body['error'] = text
    body['error_code'] = code
    if detail is not None:
        body['detail'] = detail
    # Legacy mirrors.
    body['message'] = text
    body['success'] = False

    return jsonify(body), resolved_status
