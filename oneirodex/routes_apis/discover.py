"""Discover shelves JSON API — member SPA loads this after mount."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from oneirodex.routes_discover import build_discover_feed, build_discover_row
from oneirodex.utils.api_response import api_error, api_ok
from oneirodex.utils.discover_hubs import build_genre_hub
from oneirodex.utils.discover_feed import MAX_MEMBER_PINS
from oneirodex.utils.discover_pins import (
    PinnedByAdmin,
    hidden_rows,
    member_pins,
    set_hidden_rows,
    set_member_pins,
)
from oneirodex.utils.discover_providers import resolve_feed

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


@apis_bp.route('/discover/hubs/genre/<path:genre>', methods=['GET'])
@login_required
def discover_genre_hub(genre: str):
    """Virtual Discover shelves for one genre — not an admin-authored row."""
    payload = build_genre_hub(current_user, genre)
    if payload is None:
        return api_error(
            'That genre is not in this library.',
            code='not_found',
        )
    return api_ok(payload)


@apis_bp.route('/discover/pins', methods=['GET', 'PUT'])
@login_required
def discover_pins():
    """How this member has arranged their own Discover feed.

    Two lists, one endpoint, because they are one decision: which rows go to the
    top and which do not appear at all. A member reordering their feed usually
    does both in the same sitting, and splitting them across two routes would
    mean two round trips to express one arrangement — plus a window where the
    feed has the new pins and the old exclusions.

    Both are stored as identifiers rather than positions, so a shelf an admin
    reorders keeps its arrangement. Pins are capped at three because the feed
    reserves that many slots and a fourth would silently do nothing; exclusions
    are uncapped because nothing is competing for them.

    ``pins`` and ``hidden`` are each optional on PUT: sending one leaves the
    other alone, so the row controls in the feed can send just the half they
    changed.
    """
    available = [row.identifier for row in resolve_feed(current_user)]

    if request.method == 'GET':
        return api_ok({
            'pins': member_pins(current_user, available=available),
            'hidden': hidden_rows(current_user, available=available),
            'max_pins': MAX_MEMBER_PINS,
            'available': available,
        })

    data = request.get_json(silent=True) or {}
    requested = data.get('pins')
    requested_hidden = data.get('hidden')

    if requested is None and requested_hidden is None:
        return api_error(
            'Send pins, hidden, or both as lists of row identifiers.',
            code='bad_request',
        )
    if requested is not None and not isinstance(requested, list):
        return api_error(
            'Send pins as a list of row identifiers.',
            code='bad_request',
        )
    if requested_hidden is not None and not isinstance(requested_hidden, list):
        return api_error(
            'Send hidden as a list of row identifiers.',
            code='bad_request',
        )
    if requested is not None and len(requested) > MAX_MEMBER_PINS:
        return api_error(
            f'You can pin up to {MAX_MEMBER_PINS} rows.',
            code='unprocessable',
        )

    try:
        if requested is not None:
            set_member_pins(current_user, requested, available=available)
        if requested_hidden is not None:
            set_hidden_rows(current_user, requested_hidden, available=available)
    except PinnedByAdmin as forced:
        # Checked before the generic ValueError arm: PinnedByAdmin subclasses it
        # so ordering is what keeps this from being reported as "not on your
        # feed", which would be both wrong and confusing — the row is right
        # there on the page.
        return api_error(
            'That row was pinned by an admin and cannot be hidden.',
            code='forbidden',
            detail=str(forced),
        )
    except ValueError as unknown:
        return api_error(
            'That row is not on your Discover feed.',
            code='not_found',
            detail=str(unknown),
        )

    return api_ok({
        'pins': member_pins(current_user, available=available),
        'hidden': hidden_rows(current_user, available=available),
        'max_pins': MAX_MEMBER_PINS,
    })
