"""Request models for ``oneirodex/routes_apis/game.py``.

Named-field JSON with a real presence/type guard is exhausted on this file
except via ``@validate_batch_body``. Remaining skip-list items:

* ``games_batch_status`` / ``games_batch_wishlist`` / ``games_batch_freshness_check``
  / ``games_batch_refresh_images`` — still on the flat skip list until they
  take the same companion (one wrap per PR).
* ``move_game_to_library`` — tests assert ``400`` +
  ``'target_library_uuid' in message`` for a missing field and ``400`` for
  malformed JSON. Needs a bespoke validator to keep that.
* ``admin_freshness_refresh`` — every field optional with a default, admin
  authZ done inside the body (not a decorator).

See docs/dev/pydantic-adoption.md for the follow-up plan.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class BatchFavoriteBody(BaseModel):
    """``POST /api/games/batch/favorite``.

    Replaces missing ``favorite`` 400 and non-list ``uuids`` 400. The
    over-limit cap and per-item skip/error walk stay in the view. Success
    ``ok`` still means every item succeeded (not wrapped in ``api_ok``).
    ``uuids`` stays a bare list so the view can still ``str()`` / skip
    blanks the way ``_normalize_batch_uuids`` always did.
    """

    model_config = ConfigDict(extra='forbid')

    uuids: list
    favorite: bool
