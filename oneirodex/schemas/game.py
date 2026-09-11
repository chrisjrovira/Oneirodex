"""Request models for ``oneirodex/routes_apis/game.py``.

Nothing is adopted here yet. The JSON routes in ``game.py`` are:

* ``games_batch_favorite`` / ``games_batch_status`` / ``games_batch_wishlist`` /
  ``games_batch_freshness_check`` / ``games_batch_refresh_images`` — partial
  success routes whose *rejection* body carries ``updated`` / ``skipped`` /
  ``errors`` / ``limit`` and whose ``ok`` means "did every item succeed". The
  member SPA (``api/batchActions.ts``) branches on that shape, so the uniform
  ``@validate_body`` 422 (``{ok:false, error, detail}``) would regress it. Left
  on purpose; recorded in the api-envelope baseline.
* ``move_game_to_library`` — ``tests/test_routes_apis_game.py`` asserts a 400
  and ``'target_library_uuid' in message`` for a missing field, and a 400 for
  malformed JSON. ``@validate_body`` would make both 422 with a generic
  message. Left; would need a bespoke validator to keep the contract.
* ``admin_freshness_refresh`` — every field optional with a default, admin
  authZ done inside the body (not a decorator). Nothing to delete and moving
  validation ahead of the in-body admin check is the wrong order.

See docs/dev/pydantic-adoption.md for the follow-up plan.
"""

from __future__ import annotations
