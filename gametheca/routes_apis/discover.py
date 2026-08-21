"""Discover shelves JSON API — member SPA loads this after mount."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.routes_discover import build_discover_feed, build_discover_row
from gametheca.utils.api_response import api_error, api_ok
from gametheca.utils.discover_feed import MAX_MEMBER_PINS
from gametheca.utils.discover_pins import member_pins, set_member_pins
from gametheca.utils.discover_providers import resolve_feed

from . import apis_bp


@apis_bp.route('/discover/sections', methods=['GET'])
@login_required
def discover_sections():
    # `feed_token` rides along so row pagination can apply the same cross-row
    # dedupe this feed just did.
    return jsonify(build_discover_feed(current_user))


@apis_bp.route('/discover/rows/<identifier>', methods=['GET'])
@login_required
def discover_row(identifier: str):
    """One row, windowed — the rest of a shelf the feed only sent the head of.

    Also backs the row page reached from a row's "see all" tile, which is why
    the window is caller-controlled rather than fixed at the feed's.
    """
    try:
        offset = int(request.args.get('offset', 0))
        limit = int(request.args.get('limit', 0)) or None
    except (TypeError, ValueError):
        return api_error(
            'Row offset and limit must be whole numbers.',
            code='bad_request',
        )

    payload = build_discover_row(
        current_user,
        identifier,
        offset=offset,
        feed_token=request.args.get('feed_token') or None,
        **({'limit': limit} if limit else {}),
    )
    if payload is None:
        return api_error(
            'That Discover row is not available.',
            code='not_found',
            detail=identifier,
        )
    return api_ok(payload)


@apis_bp.route('/discover/pins', methods=['GET', 'PUT'])
@login_required
def discover_pins():
    """Rows this member keeps at the top of their feed.

    Pins are stored as identifiers, not positions, so a shelf an admin reorders
    stays pinned. At most three: the feed reserves that many slots, and a fourth
    would silently do nothing.
    """
    available = [row.identifier for row in resolve_feed(current_user)]

    if request.method == 'GET':
        return api_ok({
            'pins': member_pins(current_user, available=available),
            'max_pins': MAX_MEMBER_PINS,
            'available': available,
        })

    data = request.get_json(silent=True) or {}
    requested = data.get('pins')
    if not isinstance(requested, list):
        return api_error(
            'Send pins as a list of row identifiers.',
            code='bad_request',
        )
    if len(requested) > MAX_MEMBER_PINS:
        return api_error(
            f'You can pin up to {MAX_MEMBER_PINS} rows.',
            code='unprocessable',
        )

    try:
        stored = set_member_pins(current_user, requested, available=available)
    except ValueError as unknown:
        return api_error(
            'That row cannot be pinned because it is not on your Discover feed.',
            code='not_found',
            detail=str(unknown),
        )

    return api_ok({'pins': stored, 'max_pins': MAX_MEMBER_PINS})
