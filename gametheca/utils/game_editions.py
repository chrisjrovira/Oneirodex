"""Where else in the library the same title exists, and how to launch each one.

A member browsing a grid sees one tile per *row in one library*, so a household
that keeps Chrono Trigger as both a SNES ROM and a PC release shows two
unrelated tiles and the preview for either one implies it is the only copy.
This is the join that was missing: given a game, the same title anywhere the
member can see, grouped by system, each carrying its own play options.

Matching is by normalised title, deliberately, and it is worth saying why the
obvious key does not work: ``Game.igdb_id`` and ``Game.slug`` are both
``unique=True``, so a cross-platform pair *cannot* share either — the second
copy is a different row with a different (or absent) IGDB id. Title is what
those rows actually have in common.

Normalisation is the same shape as ``patch_catalog.local_yaml.normalize_title``
(casefold, collapse anything non-alphanumeric) which is enough for
"Final Fantasy VII" vs "Final Fantasy VII " vs "Final Fantasy: VII", and
deliberately does *not* try to peel editions or regions. Guessing wider here
would list titles that are not the same game, and a wrong system in a launch
menu is worse than a missing one.
"""

from __future__ import annotations

import re

from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.title_grouping import TITLE_KEY_PATTERN

# Imported, not restated. The browse grid groups tiles with the same key
# computed in SQL (`utils/title_grouping.title_key_expr`); if these two
# patterns ever drifted, the grid would collapse a set of copies that the
# preview then refused to list as one title.
_NON_ALNUM = re.compile(TITLE_KEY_PATTERN)

#: Cap on rows considered for one lookup. A library with thousands of copies of
#: one name is a scan fault, not a use case, and the preview shows a handful.
MAX_EDITIONS = 12


def normalize_title(value: str | None) -> str:
    """Casefolded, punctuation-collapsed title used to pair copies across systems."""
    return _NON_ALNUM.sub(' ', (value or '').strip().lower()).strip()


def _core_label(core_id: str) -> str:
    """Human-facing core name. The ids are already the names people use."""
    return str(core_id or '').strip()


def _edition_play(game) -> dict:
    """Play fields for one copy, with a launch URL per browser-playable core.

    ``browse_play_fields`` already resolves the *preferred* core and builds one
    URL from it. The preview offers a choice, so every playable core gets its
    own URL here — same query shape as the one webretro is handed from the
    tile, with the core swapped.
    """
    from gametheca.utils.play_url import browse_play_fields

    fields = browse_play_fields(game)
    platform_key = fields.get('library_platform') or ''
    cores = list(fields.get('emulator_cores') or [])
    default_core = fields.get('emulator_core')

    launchers = []
    for core in cores:
        suffix = f'&platform={platform_key}' if platform_key else ''
        launchers.append({
            'core': core,
            'label': _core_label(core),
            'is_default': core == default_core,
            'play_url': (
                f'/static/vendor/webretro/webretro.html'
                f'?guid={game.uuid}&core={core}{suffix}'
            ),
        })

    return {
        'can_play_in_browser': bool(fields.get('can_play_in_browser')),
        'play_url': fields.get('play_url'),
        'play_mode': fields.get('play_mode'),
        'play_blocker': fields.get('play_blocker'),
        'companion_hint': fields.get('companion_hint'),
        'companion_cores': list(fields.get('companion_cores') or []),
        'firmware_missing': bool(fields.get('firmware_missing')),
        'launchers': launchers,
    }


def editions_for_game(game, user) -> list[dict]:
    """Every copy of *game*'s title the *user* may see, current copy first.

    Always returns at least the game itself, so a caller never has to special
    case "only one system" — the preview renders the same list either way.
    """
    from gametheca.utils.library_acl import apply_game_access_filters

    key = normalize_title(getattr(game, 'name', None))
    if not key:
        return [_edition_row(game, game)]

    # Narrow in SQL on the raw name, then confirm on the normalised one in
    # Python. A functional index on the normalisation does not exist, and the
    # candidate set for one title is small, so the cheap prefilter plus an exact
    # check is both correct and honest about what the database can do.
    stmt = (
        select(Game)
        .where(Game.name.ilike(f'%{game.name.strip()[:60]}%'))
        .limit(MAX_EDITIONS * 8)
    )
    # ACL first, always: a member must not learn that a title exists in a
    # library they cannot see. `apply_game_access_filters` only adds WHERE
    # clauses on Game, so it composes with the prefilter above without a join.
    stmt = apply_game_access_filters(stmt, user)

    candidates = db.session.execute(stmt).scalars().all()

    rows = [other for other in candidates if normalize_title(other.name) == key]
    if not any(other.uuid == game.uuid for other in rows):
        rows.insert(0, game)

    # Current copy first, then by system label so the list is stable between
    # loads rather than following whatever order the query happened to return.
    rows.sort(key=lambda g: (g.uuid != game.uuid, _platform_key(g), g.uuid))
    return [_edition_row(other, game) for other in rows[:MAX_EDITIONS]]


def _platform_key(game) -> str:
    library = getattr(game, 'library', None)
    platform = getattr(library, 'platform', None)
    return str(getattr(platform, 'name', '') or '')


def _edition_row(other, current) -> dict:
    library = getattr(other, 'library', None)
    platform = getattr(library, 'platform', None)
    return {
        'uuid': other.uuid,
        'name': other.name,
        'is_current': other.uuid == current.uuid,
        'library_uuid': getattr(library, 'uuid', None),
        'library_name': getattr(library, 'name', None),
        'library_platform': _platform_key(other) or None,
        'library_platform_label': getattr(platform, 'value', None)
        or _platform_key(other)
        or None,
        'path_missing': (getattr(other, 'path_status', None) == 'missing'),
        **_edition_play(other),
    }
