"""HTTP security response headers.

Two callers, because GameTheca serves responses from two places:

* :func:`apply_security_headers` registers a Flask ``after_request`` for
  everything that goes through WsgiToAsgi.
* :func:`baseline_static_headers` returns the same *baseline* set as raw ASGI
  header tuples, because ``/static/*`` is served natively in ``asgi.py`` and
  never reaches Flask (see the comment there — the bridge breaks under
  concurrent asset loads).

**Why the CSP is report-only by default.** Twenty-four Jinja templates carry an
inline ``<script>``, ``admin/admin_newsletter.html`` loads CKEditor from
``cdn.ckeditor.com``, and the WebRetro iframe runs Emscripten WASM cores. A
policy strict enough to be worth enforcing would break all three on the day it
shipped. So the default reports and does not block; an operator flips
``CSP_ENFORCE=true`` once their deployment is clean. The other headers have no
such cost and are unconditional.

The static path deliberately gets the baseline only, no CSP: ``webretro.html``
is a static document, and a policy applied there would have to carry
``'unsafe-eval'`` for the cores anyway.
"""

from __future__ import annotations

from flask import Flask, Response

# Sent on every response, Flask and static alike. None of these have a
# compatibility cost for this app.
BASELINE_HEADERS: dict[str, str] = {
    # Chat attachments allow .txt/.csv/.pdf, and the cover pipeline writes
    # .gif — none of which should ever be sniffed into an active type.
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
}

# Only on Flask responses — a static asset has no use for it, and the header is
# long enough that repeating it on every tile image is real bytes.
#
# Allowlisted rather than blanket-denied: `microphone`/`camera`/`display-capture`
# are the LiveKit voice lobby and screenshare, `gamepad` is controller input, and
# `fullscreen` is Big Picture. Denying those would break shipped features, which
# is the usual way this header gets reverted.
PERMISSIONS_POLICY = ', '.join([
    'accelerometer=()',
    'camera=(self)',
    'display-capture=(self)',
    'fullscreen=(self)',
    'gamepad=(self)',
    'geolocation=()',
    'gyroscope=()',
    'interest-cohort=()',
    'magnetometer=()',
    'microphone=(self)',
    'payment=()',
    'usb=()',
])


def _csp_directives() -> dict[str, str]:
    """The policy, as directive → value.

    Kept as a dict so tests can assert one directive without string-matching
    the whole header.
    """
    return {
        'default-src': "'self'",
        # 'unsafe-inline' for the 24 inline-script templates, CKEditor for the
        # newsletter editor, 'wasm-unsafe-eval' + 'unsafe-eval' for the WebRetro
        # Emscripten cores. Every one of these is a thing to remove later, not a
        # thing to pretend is fine — which is why this ships report-only.
        'script-src': (
            "'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' "
            'https://cdn.ckeditor.com'
        ),
        'style-src': "'self' 'unsafe-inline' https://cdn.ckeditor.com",
        # Cover art and screenshots come from whichever metadata provider the
        # operator configured (IGDB, SteamGridDB, Giant Bomb, Meta Quest, store
        # CDNs). Enumerating them would go stale on the next provider.
        'img-src': "'self' data: blob: https:",
        'font-src': "'self' data:",
        'media-src': "'self' data: blob: https:",
        # wss: is the LiveKit voice lobby and the SSE/WebSocket surfaces.
        'connect-src': "'self' https: wss:",
        'worker-src': "'self' blob:",
        'frame-src': "'self' https:",
        'object-src': "'none'",
        'base-uri': "'self'",
        'form-action': "'self'",
        'frame-ancestors': "'self'",
    }


def build_csp() -> str:
    """Render the policy as a header value."""
    return '; '.join(f'{key} {value}' for key, value in _csp_directives().items())


def baseline_static_headers() -> list[tuple[bytes, bytes]]:
    """Baseline headers as ASGI byte tuples, for the native static handler."""
    return [
        (key.encode('ascii'), value.encode('ascii'))
        for key, value in BASELINE_HEADERS.items()
    ]


def apply_security_headers(app: Flask) -> None:
    """Register the ``after_request`` that stamps every Flask response."""

    csp_enforce = bool(app.config.get('CSP_ENFORCE'))
    csp_enabled = bool(app.config.get('CSP_ENABLED', True))
    # HSTS is meaningless over plain HTTP and actively hostile on a LAN box
    # reached by IP, so it follows the same signal the secure cookie does.
    hsts_seconds = int(app.config.get('HSTS_SECONDS') or 0)
    hsts_enabled = bool(app.config.get('SESSION_COOKIE_SECURE')) and hsts_seconds > 0

    csp_header = (
        'Content-Security-Policy'
        if csp_enforce
        else 'Content-Security-Policy-Report-Only'
    )
    csp_value = build_csp() if csp_enabled else None

    @app.after_request
    def _set_security_headers(response: Response) -> Response:
        for key, value in BASELINE_HEADERS.items():
            response.headers.setdefault(key, value)
        response.headers.setdefault('Permissions-Policy', PERMISSIONS_POLICY)
        if csp_value:
            response.headers.setdefault(csp_header, csp_value)
        if hsts_enabled:
            response.headers.setdefault(
                'Strict-Transport-Security',
                f'max-age={hsts_seconds}; includeSubDomains',
            )
        return response
