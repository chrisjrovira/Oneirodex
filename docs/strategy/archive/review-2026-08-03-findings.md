# Full-program review — 2026-08-03

**Scope:** every wave, past and present. Ground-truth test runs (first full-suite completion on record) plus
targeted deep review of chat/social, the scan/ROM-detection pipeline, the admin SPA/Jinja hybrid, and the member
Library UI.

**Verdict:** the program is in better shape than the raw failure counts suggest. Most test failures are
environment/test-infra debt, not product defects. Nine real defects were found; **all nine are fixed** in this
pass. Two items need a human/product decision before they can be closed.

---

## Fixed this pass

| # | Severity | Area | Defect | Fix |
|---|---|---|---|---|
| 1 | **Security (high)** | Chat | `@mention` fanout resolved usernames against **every user in the system** and only skipped *muted* members — never non-members. Mentioning any existing username inside a private DM sent that outsider a notification (and opt-in email) containing up to 160 chars of the DM body. | `_is_member` result must be non-null: `gametheca/utils/chat.py:468`. Regression test added. |
| 2 | Broken feature | Member Library | MISSING badge chip sent `path_missing=1`, which the backend never read — so it silently fell back to filtering only the already-fetched page while pagination still showed unfiltered totals. | Backend now honours `path_missing`: `gametheca/utils/browse_filters.py`. Client-side fallback removed from `LibraryApp.jsx`. |
| 3 | Bug / doc-drift | Member Library | Docs promise "Refresh freshness **always re-probes**", but the frontend never sent `only_stale`, so the API defaulted to `True` and silently skipped anything checked in the last 24h. | Send `only_stale: false`: `frontend/member-app/src/api/batchActions.js`. |
| 4 | Data-integrity (race) | Scan queue | `is_scan_busy()` → insert `Running` was a TOCTOU gap: two near-simultaneous starts (double click, or scheduler poll racing a manual scan) could both go Running, defeating the queue policy without `force` ever being requested. | Post-insert re-check + demote-to-Queued, mirroring the existing safe claim in `promote_next_queued_scan`: `gametheca/utils/scan_queue.py`. |
| 5 | Broken feature | Admin | `POST /admin/clear_permission_errors` had **no backend route** — the scan write-permission modal's clear call 404'd, leaving the error payload stuck in-session. Also missing its CSRF header. | Route added (`routes_admin_ext/system.py`); CSRF header added in `admin_manage_scanjobs.html`. |
| 6 | Dead link | Admin | Libraries hub "Release filters" pointed at `/admin/filters`; the real route is `/admin/edit_filters`. | `navConfig.js`. |
| 7 | Dead link | Admin | "Full library forms" pointed at `/admin/manage_libraries`, which does not exist; the template is served from `/libraries`. | `pages.jsx`. |
| 8 | Bug | Admin | `formatBytes(null)` returned `'0 B'` instead of `'n/a'`, misreporting unknown firmware sizes as empty files. | `EmulatorFirmwarePanel.jsx`. |
| 9 | Hardening | Notifications | Email **fallback** paths (used only when Jinja render fails) interpolated user-authored chat title/body into HTML unescaped, unlike the escaped primary path. | `escape()` in `notifications.py` + `email_digest.py`. |

Also fixed alongside: BE-DET-10's UI gap (classic Edit Images ignored 6 of 8 image kinds; admin queue Type filter
offered only 2 of 8) — see [progress.md](../progress.md).

## Test-suite repairs (test bugs, not product bugs)

- **3 × GameCard badge tests** asserted `data-corner` on the `gt-badge-layers` wrapper. The UID-001 four-corner
  refactor moved that attribute to the inner per-corner stacks; the tests were never updated. (`BadgeStack.test.jsx`
  already used the correct query.)
- **1 × time-bomb test** hardcoded `date_identified: '2026-07-20'` and expected a NEW badge — that date aged out of
  the 14-day window **on 2026-08-03**, so this test was destined to fail regardless of code. Now relative to `now`.
- **2 × spurious timeouts** (`NewsPage`, `ReportIssuePage`). Both are `userEvent`-driven and genuinely need ~9s on
  this network-mounted checkout; vitest's 5s default failed them. Verified by re-running at a 60s timeout — both
  pass, 7/7. `testTimeout: 30000` set in `frontend/member-app/vite.config.js` so they stop flaking on slow disks.

### `userEvent` is a flake source on this checkout — prefer `fireEvent`

A single `userEvent` interaction measured **31 seconds** here. That is slow enough to blow even a 30s timeout, and
the failure mode is worse than a red test: when a test times out *mid-interaction* the component never unmounts, so
the **next** test in the file inherits a stray mounted tree and fails on an unrelated assertion. That is exactly
what happened to `GamePreviewPopup` — the scrim test "failed", passed cleanly in isolation, and the real culprit
was the Escape test above it timing out.

Rule of thumb: use `fireEvent` unless the test is specifically about input realism (typing sequences, pointer
gestures, focus order). Dismiss wiring, clicks and key handlers do not need `userEvent`.

**Confirmed again on the full-suite run.** With all three suites running concurrently, `SpaceRail`,
`NewsPage` and `ReportIssuePage` each timed out at 30s having burned **137–154 seconds** of wall clock.
`SpaceRail` had passed at 11.9s minutes earlier in the same session — the only variable was machine load.
Any remaining `userEvent` call in this repo is a latent flake, not a stable test.

Re-run alone on an unloaded machine, the same three files pass **14/14**. Same code, same assertions —
only contention differed. Treat a `userEvent` timeout as a load symptom and re-run in isolation before
believing it, and prefer `fireEvent` so the question does not arise.

## Backend suite: run it in chunks, and expect shared-state failures

The full `pytest tests/` run **wedged for six hours with zero output** and had to be killed. Piping it
through `tail` hid that — `tail` buffers until exit, so "still working" and "hung" look identical. Never
pipe a long run through `tail`; and on this network-mounted checkout, `-p no:cacheprovider` avoids
writing pytest's cache across the wire.

Chunked instead (~56 files at a time), the first chunk completed in **14 minutes: 615 passed, 9 failed**.

Every failure inspected so far is the **same class — tests that depend on shared mutable state** and
pass only against a particular database history:

| Test | Real cause |
|---|---|
| `test_utils_scanning` (×4) | Fixture set `max_concurrent_downloads` / `image_download_timeout`, neither of which exists on `GlobalSettings`. **Fixed.** |
| `test_hardlinks_ai_vr_layouts::test_ai_triage_disabled` | `ai_enabled()` ORs the config flag with `GlobalSettings.enable_ai_assist`, so setting config alone does not disable it once any earlier test leaves a row behind. **Fixed.** |
| `test_close_gaps::test_quality_score_blocks_group` | Looks up a quality-profile UUID that another test's settings write removed. |
| `test_utils_game_core` / `test_utils_download` (×16) | Insert an `Image` for a `Game` the test never created — FK violation. |
| `test_cover_art_studio` (×2) | `save_pack` called with no application context. |

**Use a fresh database per session.** The 16-hour-old container turned a plain `TypeError` into a
misleading `MultipleResultsFound`, which actively obstructed diagnosis. A stale test DB does not just
cause noise — it changes the error you are shown.

### The remaining failures are one architectural problem, not many bugs

Proven, not assumed. `tests/test_utils_functions.py` was run against a **brand-new empty database** and
still failed 8/62 — `test_get_games_count_empty_db` asserts `count == 0` and gets `1`, because earlier
tests **in the same file** create games and nothing truncates between them.

So the suite splits into two groups:

**Genuine test defects — fixed (8):**

* `test_utils_scanning` ×4 — fixture set columns that do not exist on `GlobalSettings`
* `test_ai_triage_disabled` — config flag alone cannot disable what `ai_enabled()` ORs with a DB row
* `test_utils_game_core` ×3 — fixture flushed instead of committing (invisible across an
  `app.app_context()` boundary → FK violation), and one assertion pinned an IGDB call count that
  predates variant search

**Shared-state coupling — not fixed, and deliberately so.** Tests that assume an empty or specific
database state pass alone and fail in company. The real fix is an autouse truncation fixture (or a
per-test transaction rollback) in `conftest.py`. That is a change to how all **225** test files
behave, and some may legitimately rely on accumulated state — it wants its own slice with the suite
green before and after, not a drive-by edit at the end of a long session.

**Do not read these as product defects.** Every failure inspected traced to test setup, never to
application behaviour.

---

## Ground-truth test results

| Suite | Result |
|---|---|
| Backend `pytest tests/` | **2791 passed · 128 failed · 17 errors** (first full run to completion; 1h02m) |
| Admin app `vitest` | **159/160 → 160/160** after fix #8 |
| Member app `vitest` | **66/69 files**; 5 failures → 3 stale-assertion test bugs + 1 expired-date test bug (fixed), 2 timeout flakes (config fixed) — **no product defects** |
| Targeted re-run (scan queue · chat · badge filters · path status · batch actions) | **54/54 passed** |

### Why 128 backend failures is not 128 bugs

Three signatures account for **81** of them, none of which are product defects:

1. **36 — `user_favorites` FK violation.** Test teardown issues a raw `DELETE FROM games`, which bypasses the ORM
   cascade. Production deletes go through `db.session.delete(game)` (`game_core.py:1892`), which *does* clear the
   association rows. Test-fixture debt.
2. **30 — stale patch targets.** Tests patch e.g. `routes_info.current_user` and
   `routes_games_ext.details.render_template`; neither module imports those symbols any more. Left behind by
   refactors.
3. **15 — `'coroutine' object has no attribute 'lower'`.** **Local environment only.** This machine runs Python
   **3.14.6**; the app ships on **3.12** (Dockerfile). On 3.14, `unittest.mock.patch` auto-detects `current_user`
   (a werkzeug `LocalProxy`) as async and hands back an `AsyncMock`, so `.role` returns a coroutine. Verified
   directly. These should pass on the 3.12 runtime.

The remaining ~47 were not individually triaged this pass — recommend triaging them against the 3.12 runtime
after the redeploy, since an unknown share are the same env artifact.

> Attempted to confirm the 3.12 baseline in a container; blocked by Docker running **out of disk space**, which
> independently corroborates the long-standing "host disk ~99%" blocker in the board notes.

---

## Human decisions — **both answered 2026-08-03, now being built**

Both open items below were resolved the same day. LiveKit gets a **real membership/invite model**, and voice
**is** scoped to its channel — see [social-spaces-and-storefront.md](../social-spaces-and-storefront.md). The room
resolver now default-denies unrecognised room names, which closes item 1 at the enforcement layer; item 2 closes
when the UI stops mounting the global lobby (**W23-SOCIAL-3**).

<details>
<summary>Original findings (kept for the record)</summary>



1. **LiveKit voice room ACL is effectively unenforced.** `user_may_join_room`
   (`gametheca/utils/livekit_rtc.py:39-44`) only blocks `role == 'child'` from rooms whose name contains "adult" or
   starts with "admin". Any other authenticated user can mint a token for **any** room string. Party rooms are
   named `household:party:<game-uuid>`, and game UUIDs are visible in `/game_details/<uuid>` URLs — so "party
   invite" is obscurity, not enforcement. Within a trusted household this may be acceptable; if not, it needs a
   real membership/invite model. **Product call.**
2. **Per-thread Voice/Screenshare buttons are not scoped to the conversation.** `ChatPanel.jsx:868-873` mounts
   `VoiceLobby` with no room prop, so Voice from *any* channel or DM joins the same global `household:lobby`. This
   matches the documented opaque-lobby design, but the per-thread placement implies a privacy that does not exist.
   **UX call:** scope the room, or move the control out of the thread header.

</details>

## Known-good (verified, no action)

- Detection pipeline QA numbers in the docs are **real** — peel 141/141, be_det8 14/14, DET-9 65/65, DET-6 14/14 all
  reconcile exactly against collected test counts. No fabricated numbers found.
- The ≥0.92 auto-identify threshold and propose-first soft paths hold. One fragility noted: the guard lives in the
  *caller* (`game_core.py:1317-1325`), not in `select_best_match` itself — safe today (single call site), but a new
  caller could bypass it. Worth a follow-up refactor.
- Multi-disc grouping, cue+bin companion filtering, and DAT ambiguous-hash skip logic are correct.
- All 33 `url_for` refs and 52 hardcoded fetches in admin Jinja templates resolve; admin SPA response shapes match
  their Flask handlers (spot-checked across 13 pages).
- Chat attachment MIME/size allowlist, child-upload 403, reaction ACL, friend-request ownership, presence scoping,
  and notification mark-read ownership are all genuinely enforced.
- Batch endpoint limits/ACLs match docs exactly (favorite ≤100, status ≤100, freshness ≤50, wishlist ≤50,
  refresh_images ≤20 librarian+). Partial-success toasts do surface `skipped`/`errors`.
- No TODO/FIXME debt in backend or frontend source. The only `NotImplementedError` is the deliberate offline
  ROM-translate stub.
- All ~40 untracked new files are wired in — no orphaned/dead modules.

## Lower-priority follow-ups (not fixed)

- BE-DET-6's "overcrowded → skip" path is correct but **untested** — no fixture builds a >8-member archive.
- `BadgeFilterChips` / `ItemKindFilterChips` components are dead code; `FilterBar` re-implements the markup inline.
  Two implementations to keep in sync by hand.
- Single-tile favorite toggle doesn't propagate to `LibraryApp`'s `result.games`, so `favoriteByUuid` can go stale
  (only affects the bulk-favorite fallback path).
- `/admin/images` is mapped in the SPA router with no Flask route behind it and nothing linking to it.
