# Pydantic request-validation adoption (wave A2.4)

`oneirodex/utils/validation.py` adds `@validate_body(Model)`. It reads
`request.get_json(silent=True)`, validates it against a `pydantic.BaseModel`
from `oneirodex/schemas/`, and on failure returns **one** shape:

```
api_error('Invalid request.', code='unprocessable', detail={field: message})   # HTTP 422
```

On success the parsed, typed model is passed to the view as the **`body`
keyword argument**.

## Writing a route with `@validate_body`

1. Add the model to `oneirodex/schemas/<surface>.py` (one module per route
   file). `model_config = ConfigDict(extra='forbid')` unless the route
   genuinely accepts pass-through keys.
2. Decorate the view. `@validate_body` goes **innermost** — directly above
   `def`, below every auth decorator:

   ```python
   @apis_bp.route('/collections', methods=['POST'])
   @login_required
   @validate_body(CreateCollectionBody)
   def create_collection(body: CreateCollectionBody):
       name = body.name[:120]
       ...
   ```

   Decorators apply bottom-up, so auth runs first and validation second. A
   `@validate_body` route with no auth decorator above it is a bug.
3. Delete the now-redundant `data = request.get_json(...)` line and the
   `if not data.get('x'): return api_error(...)` guards the model now covers.
4. Keep *semantic* checks that need the DB or app state (does this row exist,
   is the caller an admin, is every uuid in the collection) in the view — the
   model only covers shape, type and presence.
5. The happy-path response must not change. You are only changing the
   *rejection* shape (ad-hoc `code='bad_request'` → uniform `code='unprocessable'`,
   400 → 422) and only for genuinely malformed input.

### `detail` shape

`{field: message}` (or `{field: [messages]}` when a field has more than one
error). `field` is dotted: `'name'`, `'items[1].id'`, `'__root__'` for a
whole-body error. `message` is pydantic's own short text ("Field required",
"Extra inputs are not permitted", ...). The offending value, pydantic's help
URL and any `ctx` object are **dropped** — `detail` never carries request data
or environment detail.

### Malformed / absent body

`request.get_json(silent=True)` returns `None` for a missing body, a
non-JSON content type, or broken JSON. All three validate `{}` against the
model: a model with required fields → 422 naming them; an all-optional model
→ accepted. A body that is valid JSON but not an object (`[]`, `"x"`, `5`)
→ 422, not 500.

## Adopted so far

| File | Route | Model |
|---|---|---|
| `routes_apis/collections.py` | `POST /api/collections` (`create_collection`) | `CreateCollectionBody` |
| `routes_apis/collections.py` | `POST /api/collections/<uuid>/items` (`add_collection_item`) | `AddCollectionItemBody` |
| `routes_apis/collections.py` | `PUT /api/collections/<uuid>/items/order` (`reorder_collection_items`) | `ReorderCollectionItemsBody` |
| `routes_apis/ownership.py` | `POST /api/ownership/steam` (`connect_steam`) | `ConnectSteamBody` |
| `routes_apis/ai_assist.py` | `POST /api/ai/apply-triage` (`ai_apply_triage`) | `ApplyTriageBody` |

### Contract notes for the adopted routes

- **`create_collection`** — missing/blank `name` was `400 "A name is required"`,
  now `422 {detail:{name:"..."}}`. Frontend (`member-app/src/api/collections.ts`)
  renders `data.error`; no code branches on the 400 or the message.
- **`add_collection_item`** — an absent/empty `game_uuid` previously fell
  through to `404 "Game not found"`; now `422 {detail:{game_uuid:"..."}}`.
- **`reorder_collection_items` / `add_collection_item`** — `@validate_body`
  runs before the per-object `_editable_collection` check, so a logged-in
  caller who cannot edit the collection **and** sends a malformed body now
  gets 422 instead of 403. Auth (`@login_required`) is unchanged; only the
  order of the object-ownership refusal vs. body validation moved.
- **`connect_steam`** — same ordering note: the `is_ownership_sync_enabled()`
  feature-flag refusal (403) now runs *after* body validation, so `POST
  /api/ownership/steam` with a malformed body returns 422 even when sync is
  switched off. A well-formed body still hits the 403. Happy path (valid
  `steam_id`, feature on → 201) is byte-identical.
- **`ai_apply_triage`** — missing `game_uuid` / `title` (or `name`) was 400
  from the helper after the auto-apply flag. Now 422 naming `game_uuid` /
  `__root__`. `@admin_required` sits above validation. The auto-apply 403
  (with `auto_apply_enabled=False`) runs after, so `{}` is 422; a well-formed
  body is still 403 (`tests/test_ops_followons.py`).

## Deliberately not adopted (and why)

Leave these until the contract can be preserved; do not force them.

### `routes_apis/game.py`

- `games_batch_favorite`, `games_batch_status`, `games_batch_wishlist`,
  `games_batch_freshness_check`, `games_batch_refresh_images` — partial-success
  routes. The **rejection** body carries `updated` / `skipped` / `errors` /
  `limit`, and `ok` means "did every item succeed", not "did the request
  succeed". `member-app/src/api/batchActions.ts` branches on that shape; the
  flat `@validate_body` 422 would regress it. Recorded in the api-envelope
  baseline on purpose.
- `move_game_to_library` — `tests/test_routes_apis_game.py` asserts `400` +
  `'target_library_uuid' in message` for a missing field and `400` for
  malformed JSON. Needs a bespoke validator to keep that; not a generic
  `@validate_body`.
- `admin_freshness_refresh` — every field optional with a default; admin authZ
  is done in the body, not a decorator. Nothing to delete and validation must
  not run before the admin check.

### `routes_apis/scan.py`

- The `unmatched_folders/batch/*` family (`batch_clear`, `batch_mark_kind`,
  `batch_fix`, `batch_amend`) — partial-success via `_parse_batch_ids`, whose
  rejection carries `cap` / `requested` / per-id `results`.
- `start_library_scan`, `refresh_all_libraries` — also read `request.form` and
  `request.args`; a JSON-only model cannot see the whole input. Rejections
  attach `body_status='rejected'` + `job_id` / `position` for the operator UI.
- `amend_unmatched_folder_name`, `mark_unmatched_folder_kind`,
  `fix_duplicate_unmatched`, `unmatched_flag_bad_match`,
  `backfill_unmatched_suggested_kind_route` — either attach UI-specific extras
  (`disk_rename=False`, `item_kinds=[...]`) to the refusal, or have no
  missing-field rejection to remove (so wrapping buys only `extra='forbid'`
  risk).

### `routes_apis/ownership.py`

- `connect_gog`, `connect_epic`, `connect_amazon` — a bag of optional, aliased
  fields (`gog_user_id` **or** `user_id`, `token` **or** `refresh_token`, ...)
  with no rejection path. A model would need `AliasChoices` and buys nothing.
- `import_*_csv` routes — read form-data / file upload as well as JSON
  (`_read_csv_payload`). Not a JSON body.

### `routes_apis/ai_assist.py`

- `ai_config` — GET+PUT share one view; wrapping would 422 GET.
- `ai_triage` — `name` can come from `folder_id` / `folder_path`; no single
  required JSON field.
- `ai_doctor_notes` — all-optional context bag.

### `routes_apis/library.py`

- `library_watch` — GET+PUT share one view; wrapping would 422 GET.
- Batch scan/edit/delete — partial-success envelopes.

## Follow-up backlog

`request.get_json(` still hand-rolled across `oneirodex/` (census 2026-09-11):

| Area | Sites | Files |
|---|---|---|
| `routes_apis/` | 114 | 46 |
| `routes_admin_ext/` | 24 | 9 |
| rest of `oneirodex/` | 12 | 2 |
| **total** | **150** | **57** |

Highest-count files still to do, roughly in priority order:

- `routes_apis/scan.py` (11) — most are partial-success; needs a batch-aware
  companion to `@validate_body` first.
- `routes_apis/library_tools.py` (11)
- `routes_apis/quality_stats.py` (5), `routes_apis/client.py` (5),
  `routes_apis/chat_spaces_api.py` (5), `routes_apis/chat.py` (5)
- `routes_apis/library.py` (4), `routes_apis/emulator_cheats.py` (4),
  `routes_apis/ai_assist.py` (4)
- `routes_apis/game.py` (7) — mostly the batch routes above; `move_game_to_library`
  needs the bespoke-message validator.
- long tail of 1–3-site files.

Do **not** attempt a single sweep. Each file: model → decorate → delete guards
→ run that file's tests → confirm the happy-path body is unchanged.

### Nice-to-have infra

- A `@validate_body`-style helper that preserves the **partial-success**
  envelope (`updated`/`skipped`/`errors`/`limit`) so the batch routes can be
  migrated without regressing `batchActions.ts`.
- Optional: a lint that flags a new `request.get_json(` in `routes_apis/`
  without a matching `@validate_body`, on the `api_envelope_lint` /
  `print_lint` ratchet model.
