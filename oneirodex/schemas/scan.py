"""Request models for ``oneirodex/routes_apis/scan.py``.

Nothing is adopted here yet. The JSON routes in ``scan.py`` are almost all
librarian/admin batch endpoints that:

* return partial-success bodies via ``_parse_batch_ids`` whose rejection
  carries ``cap`` / ``requested`` / per-id ``results`` — the admin SPA branches
  on that, not on a flat 422; or
* also read ``request.form`` / ``request.args`` in addition to the JSON body
  (``start_library_scan``, ``refresh_all_libraries``), so a JSON-only model
  cannot see the whole input; or
* attach ``body_status='rejected'`` + ``job_id`` / ``position`` / ``item_kinds``
  to the refusal for the operator UI to render.

``unmatched_flag_bad_match`` and ``backfill_unmatched_suggested_kind_route``
have no missing-field rejection to remove, so wrapping them buys only an
``extra='forbid'`` risk.

See docs/dev/pydantic-adoption.md for the follow-up plan.
"""

from __future__ import annotations
