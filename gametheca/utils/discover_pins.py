"""Which rows sit at the top of a member's feed, and who decided.

Two independent sources fill the reserved block the feed budget keeps free:
an admin forcing a shelf for everyone, and a member pinning rows for
themselves. Both are capped, so neither can starve the other — an admin keeps a
dependable announcement position, and a member's pins can never be pushed below
the fold on their own home page.

Reading is deliberately forgiving. A pinned row is allowed to stop existing: a
genre row can go away when a member's taste moves, and an admin can hide a shelf
that somebody had pinned. Neither is an error, so an identifier that no longer
resolves is dropped on read rather than raised.
"""

from __future__ import annotations

from typing import Iterable

from sqlalchemy import select

from gametheca import db
from gametheca.models import DiscoverySection, UserPreference
from gametheca.utils.discover_feed import MAX_ADMIN_FORCED, MAX_MEMBER_PINS


def _stored_pins(user) -> list[str]:
    """The raw pin list off the member's preferences, defensively typed.

    The JSON column hands back ``{}`` when a value fails to decode, so a list
    column can legitimately return a dict. Anything that is not a list of
    strings is treated as no pins rather than allowed to propagate.
    """
    prefs = getattr(user, 'preferences', None)
    raw = getattr(prefs, 'discover_pins', None)
    if not isinstance(raw, list):
        return []
    return [str(item) for item in raw if isinstance(item, (str, int)) and str(item).strip()]


def member_pins(user, *, available: Iterable[str] | None = None) -> list[str]:
    """Row identifiers this member pinned, in their order.

    ``available`` is the set of rows the feed actually has. Pins outside it are
    dropped rather than reported — see the module note on forgiving reads.
    """
    pins = _stored_pins(user)
    if available is not None:
        allowed = set(available)
        pins = [identifier for identifier in pins if identifier in allowed]

    # De-duplicate while preserving the member's order; a repeated pin is one
    # pin, not two slots.
    seen: set[str] = set()
    ordered: list[str] = []
    for identifier in pins:
        if identifier not in seen:
            seen.add(identifier)
            ordered.append(identifier)
    return ordered[:MAX_MEMBER_PINS]


def set_member_pins(user, identifiers, *, available: Iterable[str]) -> list[str]:
    """Replace a member's pins. Returns what was actually stored.

    Unknown identifiers are rejected here rather than silently dropped: on the
    way *in* a bad identifier is a client bug worth surfacing, whereas on the
    way out it is just a row that has since gone away.
    """
    allowed = set(available)
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in identifiers or []:
        identifier = str(item).strip()
        if not identifier or identifier in seen:
            continue
        if identifier not in allowed:
            raise ValueError(identifier)
        seen.add(identifier)
        cleaned.append(identifier)
        if len(cleaned) >= MAX_MEMBER_PINS:
            break

    prefs = getattr(user, 'preferences', None)
    if prefs is None:
        prefs = UserPreference(user_id=user.id)
        db.session.add(prefs)
        user.preferences = prefs
    prefs.discover_pins = cleaned
    db.session.commit()
    return cleaned


def admin_forced() -> list[str]:
    """Shelf identifiers an admin forced to the top, lowest rank first."""
    rows = db.session.execute(
        select(DiscoverySection.identifier)
        .where(DiscoverySection.pin_rank.isnot(None))
        .order_by(DiscoverySection.pin_rank, DiscoverySection.display_order)
    ).all()
    return [row[0] for row in rows][:MAX_ADMIN_FORCED]
