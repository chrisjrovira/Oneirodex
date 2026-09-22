"""A nested AND/OR/NOT filter tree over the fields the chip row already offers.

INSP-3. The chip row can only ever mean *and* — tick three chips and you get
titles that satisfy all three. Real questions are not shaped like that: *VR
titles that are behind, or anything imported in the last fortnight* has no
expression in a flat row of chips, and never will.

The tree is a JSON document:

    {"op": "and", "nodes": [
        {"field": "is_vr", "value": true},
        {"op": "or", "nodes": [
            {"field": "freshness_behind", "value": true},
            {"field": "new_import", "value": true}
        ]}
    ]}

Two rules make this safe to accept from a browser:

1. **A leaf can only name a field in `FIELDS` below**, and every one of those
   compiles through the *same* clause builder the chip row uses. The tree
   therefore cannot reach a column the chips cannot, cannot join a new table,
   and cannot express a comparison nobody has already shipped. Adding a field
   here is a deliberate act, not a side effect of the model gaining a column.
2. **Shape is bounded** — `MAX_DEPTH` and `MAX_NODES`. A filter is a thing a
   person builds in a UI; a thousand-node tree is not that, and refusing it is
   cheaper than asking Postgres to plan it.

``compile_filter_tree`` returns one SQLAlchemy clause. It never touches a
query, so the caller decides whether the tree is the whole filter or one
conjunct beside the chips.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, exists, false, func, not_, or_, select, true

from oneirodex.models import Game, GameUpdate, PlayerPerspective
from oneirodex.utils.item_kind import parse_item_kinds_param
from oneirodex.utils.library_health import (
    PATH_STATUS_EMPTY,
    PATH_STATUS_MISSING,
    PATH_STATUS_OK,
)
from oneirodex.utils.lifecycle import FRESHNESS_BEHIND_STATUSES
from oneirodex.utils.rom_language import needs_translation_sql_filter
from oneirodex.utils.secondary_scrapers import VR_COMPAT_VALUES, VR_PERSPECTIVE_NAME

__all__ = [
    'FilterTreeError',
    'FIELDS',
    'MAX_DEPTH',
    'MAX_NODES',
    'compile_filter_tree',
    'describe_fields',
    'parse_filter_tree',
]

MAX_DEPTH = 6
MAX_NODES = 60

NEW_IMPORT_WINDOW_DAYS = 14
RELEASE_WINDOW_DAYS = 30

_PATH_STATUS_ALLOWED = (PATH_STATUS_OK, PATH_STATUS_MISSING, PATH_STATUS_EMPTY)
_OPS = ('and', 'or', 'not')


class FilterTreeError(ValueError):
    """A tree we will not run. ``path`` says where, in dotted form."""

    def __init__(self, message: str, *, path: str = ''):
        super().__init__(message)
        self.path = path

    def __str__(self) -> str:
        base = super().__str__()
        return f'{base} (at {self.path})' if self.path else base


# --- clause builders --------------------------------------------------------
#
# One per field, each returning a clause rather than a filtered query, so the
# chip row and the tree compile the *same* SQL for the same question. When one
# of these changes, both change.


def _clock(now: datetime | None) -> datetime:
    moment = now or datetime.now(timezone.utc)
    return moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment


def _is_vr(_value, _ctx):
    return Game.player_perspectives.any(PlayerPerspective.name == VR_PERSPECTIVE_NAME)


def _vr_compat(value, _ctx):
    # `native_vr` also admits titles with no stored value whose perspectives say
    # VR -- the same derivation the card flag uses, so filter and badge agree.
    if value == 'native_vr':
        return or_(
            Game.vr_compat == 'native_vr',
            and_(
                Game.vr_compat.is_(None),
                Game.player_perspectives.any(PlayerPerspective.name == VR_PERSPECTIVE_NAME),
            ),
        )
    return Game.vr_compat == value


def _freshness_behind(_value, _ctx):
    return Game.freshness_status.in_(tuple(FRESHNESS_BEHIND_STATUSES))


def _has_updates(_value, _ctx):
    update_exists = exists(select(GameUpdate.id).where(GameUpdate.game_uuid == Game.uuid))
    return or_(Game.freshness_status.in_(tuple(FRESHNESS_BEHIND_STATUSES)), update_exists)


def _new_import(_value, ctx):
    cutoff = _clock(ctx.get('now')) - timedelta(days=NEW_IMPORT_WINDOW_DAYS)
    return or_(
        Game.date_identified >= cutoff,
        and_(Game.date_identified.is_(None), Game.date_created >= cutoff),
    )


def _recent_release(_value, ctx):
    cutoff = _clock(ctx.get('now')) - timedelta(days=RELEASE_WINDOW_DAYS)
    return Game.first_release_date >= cutoff


def _needs_translation(_value, ctx):
    user = ctx.get('user')
    prefs = getattr(user, 'preferences', None) if user is not None else None
    preferred = getattr(prefs, 'preferred_game_locale', None) or 'en-US'
    return needs_translation_sql_filter(preferred)


def _path_missing(_value, _ctx):
    return Game.path_status == PATH_STATUS_MISSING


def _path_status(value, _ctx):
    values = [v for v in _as_list(value) if v in _PATH_STATUS_ALLOWED]
    if not values:
        return false()
    return Game.path_status.in_(tuple(values))


def _item_kind(value, _ctx):
    kinds = parse_item_kinds_param(','.join(_as_list(value)))
    if kinds is None:
        return true()
    if not kinds:
        return false()
    return Game.item_kind.in_(tuple(sorted(kinds)))


def _name(value, _ctx):
    text = str(value or '').strip()
    if not text:
        return true()
    return Game.name.ilike(f'%{text}%')


def _as_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        raw = value
    else:
        raw = str(value).split(',')
    return [str(v).strip().lower() for v in raw if str(v).strip()]


# field -> (value kind, allowed values or None, builder)
FIELDS: dict[str, tuple[str, tuple[str, ...] | None, Any]] = {
    'is_vr': ('flag', None, _is_vr),
    'vr_compat': ('enum', tuple(sorted(VR_COMPAT_VALUES)), _vr_compat),
    'freshness_behind': ('flag', None, _freshness_behind),
    'has_updates': ('flag', None, _has_updates),
    'new_import': ('flag', None, _new_import),
    'recent_release': ('flag', None, _recent_release),
    'needs_translation': ('flag', None, _needs_translation),
    'path_missing': ('flag', None, _path_missing),
    'path_status': ('enum_list', _PATH_STATUS_ALLOWED, _path_status),
    'item_kind': ('enum_list', ('game', 'experience', 'emulator', 'tool'), _item_kind),
    'name': ('text', None, _name),
}

_TRUTHY = frozenset({'1', 'true', 'yes', 'on', 1, True})


def describe_fields() -> list[dict[str, Any]]:
    """What a builder UI needs to offer: the fields, and what each one takes."""
    out = []
    for field, (kind, allowed, _builder) in sorted(FIELDS.items()):
        row: dict[str, Any] = {'field': field, 'kind': kind}
        if allowed:
            row['values'] = list(allowed)
        out.append(row)
    return out


# --- parsing ----------------------------------------------------------------


def parse_filter_tree(raw: Any) -> dict:
    """Validate a tree and hand back a normalised copy.

    Accepts a JSON string or an already-decoded mapping. Raises
    ``FilterTreeError`` with the path of the offending node -- a builder UI can
    point at the row the member has to fix, which a bare "invalid filter"
    cannot.
    """
    if isinstance(raw, (str, bytes)):
        text = raw.decode('utf-8') if isinstance(raw, bytes) else raw
        if not text.strip():
            raise FilterTreeError('Filter is empty')
        try:
            raw = json.loads(text)
        except (ValueError, TypeError) as exc:
            raise FilterTreeError(f'Filter is not valid JSON: {exc}') from exc
    if not isinstance(raw, dict):
        raise FilterTreeError('Filter must be an object')
    counter = {'n': 0}
    return _parse_node(raw, depth=1, path='root', counter=counter)


def _parse_node(node: Any, *, depth: int, path: str, counter: dict) -> dict:
    if depth > MAX_DEPTH:
        raise FilterTreeError(f'Filter nests deeper than {MAX_DEPTH} levels', path=path)
    counter['n'] += 1
    if counter['n'] > MAX_NODES:
        raise FilterTreeError(f'Filter has more than {MAX_NODES} parts', path=path)
    if not isinstance(node, dict):
        raise FilterTreeError('Each part must be an object', path=path)

    if 'op' in node:
        op = str(node.get('op') or '').strip().lower()
        if op not in _OPS:
            raise FilterTreeError(f'Unknown operator {op!r}', path=path)
        nodes = node.get('nodes')
        if not isinstance(nodes, list) or not nodes:
            raise FilterTreeError(f'{op} needs at least one part', path=path)
        return {
            'op': op,
            'nodes': [
                _parse_node(child, depth=depth + 1, path=f'{path}.{i}', counter=counter)
                for i, child in enumerate(nodes)
            ],
        }

    field = str(node.get('field') or '').strip()
    if not field:
        raise FilterTreeError('A part needs either an operator or a field', path=path)
    if field not in FIELDS:
        raise FilterTreeError(f'Unknown field {field!r}', path=path)
    kind, allowed, _builder = FIELDS[field]
    value = node.get('value', True)

    if kind == 'flag':
        if isinstance(value, str):
            value = value.strip().lower() in _TRUTHY
        value = bool(value) if not isinstance(value, bool) else value
    elif kind == 'enum':
        value = str(value or '').strip().lower()
        if value not in (allowed or ()):
            raise FilterTreeError(f'{field} does not take {value!r}', path=path)
    elif kind == 'enum_list':
        values = _as_list(value)
        unknown = [v for v in values if v not in (allowed or ())]
        if unknown:
            raise FilterTreeError(f'{field} does not take {unknown[0]!r}', path=path)
        if not values:
            raise FilterTreeError(f'{field} needs at least one value', path=path)
        value = values
    else:  # text
        value = str(value or '').strip()
        if not value:
            raise FilterTreeError(f'{field} needs something to match', path=path)
        if len(value) > 200:
            raise FilterTreeError(f'{field} is too long', path=path)

    return {'field': field, 'value': value}


# --- compiling --------------------------------------------------------------


def compile_filter_tree(tree: Any, *, user=None, now: datetime | None = None):
    """Compile a tree to one clause. Always validates first.

    Parsing is cheap and idempotent, so there is one code path in and no way to
    reach the compiler with a tree nobody checked.
    """
    return _compile_node(parse_filter_tree(tree), {'user': user, 'now': now})


def _negate(clause):
    """NOT, with SQL's third value folded away.

    `NOT (freshness_status IN (...))` is NULL — not true — for a row whose
    status is NULL, so plain negation quietly drops every title the field was
    never set on. A member asking for "not behind" means the untracked ones
    too, so an unknown counts as "does not match" before it is negated.
    """
    return not_(func.coalesce(clause, false()))


def _compile_node(node: dict, ctx: dict):
    op = node.get('op')
    if op:
        parts = [_compile_node(child, ctx) for child in node['nodes']]
        if op == 'and':
            return and_(*parts)
        if op == 'or':
            return or_(*parts)
        # `not` over several parts reads as "none of these", which is what a
        # member means when they add rows under a NOT group.
        return _negate(and_(*parts))
    _kind, _allowed, builder = FIELDS[node['field']]
    clause = builder(node['value'], ctx)
    # A flag leaf set to false means "not this", not "ignore this" -- otherwise
    # unticking a row in the builder would silently widen the result.
    if node.get('value') is False:
        return _negate(clause)
    return clause
