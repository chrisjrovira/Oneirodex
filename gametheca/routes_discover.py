from urllib.parse import quote, urlencode
from uuid import uuid4

from flask import Blueprint
from flask_login import login_required
from gametheca.utils.member_spa import render_member_spa

from gametheca import cache, db
from gametheca.utils.discover_feed import (
    FEED_ROW_CAP,
    assemble,
    excluded_for,
    manifest_from,
)
from gametheca.utils.discover_pins import admin_forced, hidden_rows, member_pins
from gametheca.utils.functions import format_size
from gametheca.utils.processors import get_global_settings
from gametheca.utils.secondary_scrapers import game_card_flags
from gametheca.utils.store_ownership import ownership_flags
from gametheca.utils.cover_url import resolve_game_cover_url
from gametheca.utils.discover_hydrate import DiscoverHydration
from gametheca.utils.discover_providers import (
    ROW_MAX,
    ROW_WINDOW,
    resolve_feed,
    resolve_identifier,
)
from gametheca.utils.lifecycle import web_lifecycle_fields
from gametheca.utils.game_details_payload import browse_trailer_fields
from gametheca.utils.play_url import browse_play_fields, library_platform_key

discover_bp = Blueprint('discover', __name__)


def serialize_discover_game(
    game,
    cover_image,
    *,
    is_favorite,
    has_local_override,
    owned_game_uuids=None,
    user_id=None,
    client_state=None,
    client_connected=None,
    updates_count=None,
):
    """Shape one Discover tile.

    ``client_connected`` and ``updates_count`` are batched answers passed in by
    :class:`~gametheca.utils.discover_hydrate.DiscoverHydration`. Left as None
    they are derived per game, which is what the lifecycle helper did on its own
    before — correct, but one ``ClientDevice`` query and one ``updates``
    relationship load per tile.
    """
    cover_url = resolve_game_cover_url(game, cover_image)
    owned_uuids = owned_game_uuids or set()
    platform_key = library_platform_key(game)
    platform_label = None
    library = getattr(game, 'library', None)
    platform = getattr(library, 'platform', None) if library is not None else None
    if platform is not None:
        platform_label = getattr(platform, 'value', None) or platform_key

    return {
        'id': game.id,
        'uuid': game.uuid,
        'name': game.name,
        'cover_url': cover_url,
        'summary': game.summary,
        'url': game.url,
        'size': format_size(game.size),
        'genres': [genre.name for genre in game.genres],
        'is_favorite': is_favorite,
        'has_local_override': has_local_override,
        'date_identified': game.date_identified.isoformat() if game.date_identified else None,
        'date_created': game.date_created.isoformat() if game.date_created else None,
        'first_release_date': (
            game.first_release_date.isoformat()
            if game.first_release_date
            else None
        ),
        'freshness_status': getattr(game, 'freshness_status', None),
        'library_platform': platform_key,
        'library_platform_label': platform_label,
        'badge_title_collision': bool(platform_key),
        **browse_play_fields(game),
        **browse_trailer_fields(game),
        **game_card_flags(game),
        **web_lifecycle_fields(
            game,
            user_id=user_id,
            client_state=client_state,
            client_connected=client_connected,
            updates_count=updates_count,
        ),
        **ownership_flags(game.uuid, owned_uuids),
    }


# Storefront seed shelves are derived, so an empty one is hidden rather than
# rendered as a sad empty row (W25-STORE-1).
STOREFRONT_SHELF_IDS = frozenset({'curated_for_you', 'upcoming', 'extras_missing'})

# How far a row endpoint will page. Guards against a caller asking for an
# arbitrary offset and making the server walk the whole library to answer.
MAX_ROW_OFFSET = 2000
MAX_ROW_LIMIT = 60

# How long a feed's dedupe record outlives the request that built it. Long
# enough to cover a browsing session; short enough that a stale arrangement
# does not follow a member into the next one.
FEED_MANIFEST_TTL_SECONDS = 1800


def _more_href(row) -> str:
    """Where this row's "see all" tile goes.

    Genre filter zones open the genre hub — the same tile in honest shelves —
    rather than dumping straight into the catalog. Other library filters still
    deep-link to Game Catalog. Everything else keeps its own row page.
    """
    if row.library_filter:
        genre = row.library_filter.get('genre')
        if genre:
            return f'/discover/hub/genre/{quote(str(genre), safe="")}'
        return f'/library?{urlencode(row.library_filter)}'
    return f'/discover/{row.identifier}'


def _row_payload(games, hydration):
    return [
        serialize_discover_game(
            game,
            hydration.cover_for(game),
            **hydration.serializer_kwargs(game),
        )
        for game in games
    ]


def _row_items(row, selected, hydration):
    """The items a row ships, keyed the way that kind of row is read.

    Game rows keep the ``games`` key they have always had. Rows of anything
    else — today the news row — carry ``items`` instead, and the payload's
    ``item_kind`` says which to read. Emitting both would mean serializing every
    tile twice for no reader's benefit.
    """
    if row.spec.item_kind != 'games':
        return {'items': list(selected)}
    return {'games': _row_payload(selected, hydration)}


def _feed_cache_key(user_id, token: str) -> str:
    return f'discover:feed:{user_id}:{token}'


def _store_manifest(user, manifest: dict) -> str | None:
    """Stash what each row claimed, and hand back the token that finds it.

    Returns None when the install has no usable cache — the feed still works,
    it just cannot carry dedupe into pagination, which is a degradation rather
    than a failure.
    """
    if not manifest:
        return None
    token = uuid4().hex
    try:
        cache.set(
            _feed_cache_key(getattr(user, 'id', None), token),
            manifest,
            timeout=FEED_MANIFEST_TTL_SECONDS,
        )
    except Exception:  # noqa: BLE001 — a cacheless install still gets a feed
        return None
    return token


def _load_manifest(user, token: str | None) -> dict:
    if not token:
        return {}
    try:
        return cache.get(_feed_cache_key(getattr(user, 'id', None), token)) or {}
    except Exception:  # noqa: BLE001 — same stance as above
        return {}


def build_discover_feed(user) -> dict:
    """The whole feed: rows plus the token that keeps dedupe alive.

    The token names a cached record of which titles each row claimed. Row
    pagination passes it back so tiles 13-40 of one row skip what rows above it
    already showed — without it the dedupe is undone by the first scroll.
    """
    sections, manifest = _assemble_sections(user)
    return {'sections': sections, 'feed_token': _store_manifest(user, manifest)}


def build_discover_sections(user) -> list[dict]:
    """Shelf payloads alone, for callers that do not page rows."""
    return _assemble_sections(user)[0]


def _assemble_sections(user):
    """Build Discover shelf payloads for the signed-in user.

    Rows ship a *window* rather than their whole contents: hydration batches, so
    the cost of a deep row is payload size rather than query count, and 20 rows
    of 40 serialized games is megabytes the member has not scrolled to yet. The
    rest of a row arrives from ``/api/discover/rows/<identifier>``.

    Returns ``(sections, manifest)``.
    """
    rows = resolve_feed(user)

    # Rows this member excluded. Applied before selection, not after, so a
    # hidden row costs no query and — more importantly — releases the titles it
    # would have claimed back to the rows below it. Filtering after assembly
    # would leave the dedupe pass having already spent those titles on a row
    # nobody was going to see, which reads as "hiding a row emptied the next
    # one".
    #
    # `resolve_feed` is the source for both this and `available` in the pins
    # endpoint, so the two agree on what a valid identifier is.
    excluded = set(hidden_rows(user, available=[row.identifier for row in rows]))
    if excluded:
        rows = [row for row in rows if row.identifier not in excluded]

    hydration = DiscoverHydration(user)

    # Pass 1 - selection. One query per row. Over-fetching by one past the
    # ceiling is what lets a row say whether there is more than it will ever
    # hold, without a second COUNT query per row.
    selected = {row.identifier: row.select(user, ROW_MAX + 1) for row in rows}

    # Pass 2 - assembly. Caps the page and strips titles an earlier row already
    # showed, together, because dropping a starved row frees a slot. Reserved
    # rows go first; both blocks are capped so neither side starves the other.
    available = [row.identifier for row in rows]
    assembled = assemble(
        rows,
        selected,
        window=ROW_WINDOW,
        cap=FEED_ROW_CAP,
        forced=admin_forced(),
        pinned=member_pins(user, available=available),
    )

    # Only the window is hydrated, and only for rows made of games. The
    # candidates past the window cost a row in the result set and nothing else.
    hydration.prime(
        game
        for entry in assembled
        if entry.row.spec.item_kind == 'games'
        for game in entry.games[:ROW_WINDOW]
    )

    discover_sections = []
    for entry in assembled:
        row = entry.row
        candidates = entry.games
        # What this row still had before dedupe took titles off it. The two
        # counts below answer different questions and must not share a source:
        # how deep this row goes *inline* is what survived dedupe, while
        # whether a "see all" is honest is about the row's own source.
        raw = selected.get(row.identifier, [])
        items = _row_items(row, candidates[:ROW_WINDOW], hydration)
        shipped = next(iter(items.values()))
        # Honest empty: a storefront shelf with nothing to say is hidden,
        # not padded. Admin/custom shelves keep their existing behaviour.
        if not shipped and row.identifier in STOREFRONT_SHELF_IDS:
            continue
        section = row.section
        discover_sections.append({
            'identifier': row.identifier,
            'title': row.title,
            'layout': section.layout or 'shelf',
            'item_kind': row.spec.item_kind,
            'reason': row.spec.reason,
            'is_event': bool(section.starts_at or section.ends_at),
            'ends_at': section.ends_at.isoformat() if section.ends_at else None,
            **items,
            # Tiles this row holds after dedupe, so the client knows when to
            # stop asking for more. Capped at the row ceiling.
            'total_count': min(len(candidates), ROW_MAX),
            # True when the row's source is not the whole story - the only
            # condition under which a "see all" tile is honest. Read from the
            # source rather than from what dedupe left, or a row thinned by its
            # neighbours would hide a way out that genuinely exists.
            'has_more': len(raw) > ROW_MAX,
            'more_href': _more_href(row),
        })

    manifest = manifest_from(assembled)

    # Note what the member was shown, so the recommender can stop insisting on
    # tiles they keep scrolling past. Best-effort by design: an un-recorded
    # impression costs a little freshness, and a feed that failed to render
    # because a bookkeeping write went wrong costs a lot more.
    try:
        from gametheca.utils.discover_ml.impressions import record_impressions

        record_impressions(
            getattr(user, 'id', None),
            [uuid for claimed in manifest.values() for uuid in claimed],
        )
    except Exception:  # noqa: BLE001
        db.session.rollback()

    return discover_sections, manifest


def build_discover_row(user, identifier, *, offset=0, limit=ROW_WINDOW, feed_token=None):
    """One row's games, windowed. Returns None when the row is not available.

    Unavailable covers hidden and out-of-schedule as well as unknown: a row
    resolves through its ``DiscoverySection``, so this endpoint is not a way
    around the visibility toggle the admin screen presents as authoritative.

    ``feed_token`` carries the cross-row dedupe from the feed into pagination.
    Without it this row would hand back the titles the rows above it are already
    showing, undoing the dedupe on the member's first scroll.
    """
    row = resolve_identifier(identifier)
    if row is None:
        return None

    offset = max(0, min(int(offset or 0), MAX_ROW_OFFSET))
    limit = max(1, min(int(limit or ROW_WINDOW), MAX_ROW_LIMIT))

    excluded = set()
    if row.spec.dedupe_mode != 'exempt':
        excluded = excluded_for(_load_manifest(user, feed_token), identifier)

    # One past the window, so "is there another page" needs no extra query.
    # Excluded titles are dropped after selection, so the row is over-fetched by
    # what the exclusion set could remove — otherwise a heavily deduped row
    # returns a short page and looks finished before it is.
    fetch = offset + limit + 1 + len(excluded)
    candidates = row.select(user, min(fetch, MAX_ROW_OFFSET + MAX_ROW_LIMIT + ROW_MAX))
    if excluded:
        candidates = [
            game for game in candidates if getattr(game, 'uuid', None) not in excluded
        ]
    window = candidates[offset:offset + limit]

    hydration = DiscoverHydration(user)
    if row.spec.item_kind == 'games':
        hydration.prime(window)

    section = row.section
    return {
        'identifier': row.identifier,
        'title': row.title,
        'layout': section.layout or 'shelf',
        'item_kind': row.spec.item_kind,
        'reason': row.spec.reason,
        'offset': offset,
        'limit': limit,
        **_row_items(row, window, hydration),
        'has_more': len(candidates) > offset + limit,
        'more_href': _more_href(row),
    }


@discover_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


@discover_bp.route('/discover')
@login_required
def discover():
    # Shelves load client-side via GET /api/discover/sections (keeps HTML shell light).
    return render_member_spa()


@discover_bp.route('/discover/hub/genre/<path:genre>')
@login_required
def discover_genre_hub(genre):
    return render_member_spa(title='Discover')


@discover_bp.route('/discover/<identifier>')
@login_required
def discover_row_page(identifier):
    return render_member_spa()
