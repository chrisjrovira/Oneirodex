"""Server-Sent Events stream for scan/download realtime updates."""

from __future__ import annotations

import queue

from flask import Response, jsonify, stream_with_context
from flask_login import current_user, login_required

from gametheca.utils.event_bus import encode_sse, event_bus

from . import apis_bp


@apis_bp.route('/events/stream', methods=['GET'])
@login_required
def events_stream():
    """SSE endpoint. Clients: EventSource('/api/events/stream')."""

    def generate():
        q = event_bus.subscribe()
        try:
            yield b'event: hello\ndata: {"ok": true}\n\n'
            while True:
                try:
                    event = q.get(timeout=1.0)
                    yield encode_sse(event)
                except queue.Empty:
                    yield b': keepalive\n\n'
        finally:
            event_bus.unsubscribe(q)

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )


@apis_bp.route('/events/publish_test', methods=['POST'])
@login_required
def events_publish_test():
    """Admin-only test event for verifying the bus."""
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    event = event_bus.publish('test', message='ping', user=current_user.name)
    return jsonify(event.to_dict())
