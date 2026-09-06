"""The WSGI bridge under asgi.py: which one, and what a mid-flight disconnect does.

UID-052. asgiref's ``WsgiToAsgi`` submits the WSGI call into a
``CurrentThreadExecutor`` that can already have been shut down when the client
goes away mid-request, so the request died with ``RuntimeError:
CurrentThreadExecutor already quit or is broken`` — surfacing to the operator
as a 500 on an ordinary member route, after the browser that asked for it had
already gone. asgi.py had been routing ``/static/*`` around the bridge with a
comment naming that exact error.

These tests pin the swap rather than the fault: the fault was never
reproducible on demand (about thirty attempts across sequential, concurrent and
aborted patterns all returned 200), so there is no red-to-green test to write.
What can be held still is that the bridge is a2wsgi and that a disconnect
arriving before the body is read completes instead of raising.
"""

import asyncio

import asgi as asgi_module
from a2wsgi import WSGIMiddleware

BASE_SCOPE = {
    "type": "http",
    "http_version": "1.1",
    "method": "GET",
    "scheme": "http",
    "path": "/",
    "raw_path": b"/",
    "query_string": b"",
    "root_path": "",
    "headers": [(b"host", b"testserver")],
    "client": ("127.0.0.1", 54321),
    "server": ("testserver", 80),
}


def _wsgi_app(environ, start_response):
    start_response("200 OK", [("content-type", "text/plain")])
    return [b"hello"]


def _drive(app, receive_messages):
    """Run one ASGI request to completion, returning what it sent."""
    sent = []
    queued = list(receive_messages)

    async def receive():
        if queued:
            return queued.pop(0)
        # A real server holds the connection open rather than ending the
        # stream, so an app that keeps polling must not spin on a sentinel.
        await asyncio.sleep(0.05)
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    asyncio.run(asyncio.wait_for(app(dict(BASE_SCOPE), receive, send), timeout=10))
    return sent


def test_bridge_is_a2wsgi():
    """The import asgi.py builds its bridge from — a revert to asgiref shows here."""
    assert asgi_module.WSGIMiddleware is WSGIMiddleware


def test_request_through_the_bridge_answers():
    sent = _drive(WSGIMiddleware(_wsgi_app), [{"type": "http.request", "body": b""}])
    start = [m for m in sent if m["type"] == "http.response.start"]
    assert start and start[0]["status"] == 200
    body = b"".join(m.get("body", b"") for m in sent if m["type"] == "http.response.body")
    assert body == b"hello"


def test_disconnect_before_the_body_does_not_raise():
    """The UID-052 shape: the client is gone before the app is asked for input.

    Nothing is asserted about the status — a disconnected client cannot read
    one. The assertion is that driving it raises nothing, because the failure
    being retired was an exception escaping into the server's error path and
    being logged as a 500.
    """
    sent = _drive(WSGIMiddleware(_wsgi_app), [{"type": "http.disconnect"}])
    assert all(
        m.get("status") != 500 for m in sent if m["type"] == "http.response.start"
    )
