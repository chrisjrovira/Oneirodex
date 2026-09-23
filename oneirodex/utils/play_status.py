"""The play-status vocabulary, in one place.

The five values were spelled out as literals in at least four modules and two
SPA files, which is how ``'null'`` ended up accepted by one route and silently
rejected by another.

That value is worth explaining, because it reads like a bug: **the "Won't play"
status is stored as the string ``'null'``**, not as SQL NULL and not as
``wont_play``. It has been that way since the status was introduced, rows in
every install carry it, and the column is a free ``String(20)`` rather than an
enum -- so renaming it would mean a data migration for a cosmetic gain. Naming
the constant is the cheaper honest fix: call sites now say ``WONT_PLAY`` and
nobody has to remember which of `null`, `'null'` and `None` this one is.
"""

from __future__ import annotations

__all__ = [
    'CLEARED',
    'FINISHED_STATUSES',
    'PLAY_STATUS_VALUES',
    'WONT_PLAY',
]

#: A member saying "I am not going to play this". Both the fifth play status
#: (INSP-21) and the negative signal Discover honours (INSP-4) -- one value
#: rather than two stores that could disagree about the same sentiment.
WONT_PLAY = 'null'

#: Clearing the status. Distinct from `WONT_PLAY`: "no opinion" is not "no".
CLEARED = ''

#: Read as positive interest by the taste profile.
FINISHED_STATUSES = ('beaten', 'completed')

PLAY_STATUS_VALUES = frozenset({
    'unplayed',
    'unfinished',
    'beaten',
    'completed',
    WONT_PLAY,
    CLEARED,
})
