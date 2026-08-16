# Full code review + inflight/missing report — 2026-08-06

Method: static passes over the real codebase (import graph, feature-flag
consumption, route auth decorators, secret-in-log grep, orphan detection),
plus a full pytest run. Findings below are things I **verified in code**, not
recited from earlier docs.

Scale: **271 Python modules / 66,626 LOC**, 154 frontend source files across two
SPAs, 225 test files.

---

## 1. What the passes found clean

Worth stating, because these are the usual suspects:

* **No dead modules.** All 271 Python modules are referenced from somewhere.
* **No orphan frontend components.** The only unreferenced files are the two
  `testSetup.js`, which vitest loads by config rather than by import.
* **`save_crypto` and `ruffle_play` are not orphans** — both were flagged as
  unverified in the 2026-08-05 gap review. `save_crypto` is live in
  `emulator_saves.py`. `ruffle_play` is a different problem — see 2.1.
* **Route auth.** 25 routes carry no auth decorator; all 25 are legitimately
  public (health probes, login/register/reset, OIDC callback, setup wizard,
  favicon, service worker, public CSS/JS). The setup routes correctly gate on
  `is_setup_required()`, so they cannot be replayed after first run.

---

## 2. Defects found

### 2.1 Two admin toggles that do nothing — **honesty bug**

`routes_admin_ext/features.py` declares 18 toggles. Two are never consumed:

| Toggle | Label shown to admin | Reality |
|---|---|---|
| `ENABLE_RUFFLE` | "Ruffle Flash play — Browser Flash via Ruffle" | `ruffle_play_url()` is never called from any route, template or component. The module exists and is unit-tested; nothing reaches it. |
| `ENABLE_ACTIVITY_FEED` | "Activity feed — Now playing / recent" | Referenced only in its own declaration and in admin help *text*. No code reads it. |

An admin can flip both and observe no change. That directly contradicts the
project's stated honesty stance (the same stance that drives `why_unmatched`,
BIOS readiness badges, and `installed: false` on fonts). **Fix: either wire them
or remove them.** Leaving a toggle that lies is worse than not shipping it.

`ENABLE_ROM_AI_TRANSLATE` looked suspicious on reference count but *is* consumed
in `game_details_payload.py` — no action.

### 2.2 Credentials written to logs — **fixed in this pass**

| Location | Leak |
|---|---|
| `routes_login.py:249` | `print(f"Invite token from URL: {token}")` — an invite token **is a credential**. Anyone with log access could redeem the invite. |
| `routes_setup.py:39` | `print(f"Form CSRF token: {...}")` — replayable token in plaintext logs. |

Both now log presence only. Fixed and committed.

### 2.3 The *arr hardlink pipeline cannot work across containers — **unfixed**

`utils/arr_hardlink_pipeline.py` takes qBittorrent's `content_path` **verbatim**
and calls `os.path.isfile()` / `os.path.isdir()` on it:

```python
content_path = (item.get('content_path') or item.get('save_path') or '').strip()
...
path = os.path.abspath(content_path or '')
if os.path.isfile(path): ...
```

In the standard deployment — qBittorrent in its own container, GameTheca in
another — the client reports `/downloads/x` while GameTheca sees
`/storage/...`. The path does not resolve, `_pick_source_file` returns `None`,
and the pipeline **silently finds nothing**. There is no error; it just never
imports.

This is precisely what *arr apps call **remote path mapping**, and it is a
standard *arr capability that had never been given an adopt/decline decision (see §4).
It matters most for exactly this project's target deployment (Unraid + Docker).

**Fix:** a small ordered list of `(client_prefix → local_prefix)` rewrites
applied to `content_path` before any filesystem call, plus a "test mapping"
button that reports whether the rewritten path exists.

### 2.4 Test suite: 143 broken → **114** after four harness fixes

**Correction.** I said repeatedly through this session that the failures were
"one shared-state isolation problem, not product defects." That was wrong, and
the full run plus targeted re-runs disprove it. There are at least **three**
distinct causes, and the largest one is not isolation at all.

| Cause | Evidence | Test-only? |
|---|---|---|
| **Bulk `delete(Game)` bypasses ORM association cleanup** | 56 `ForeignKeyViolation` on `user_favorites_game_uuid_fkey`. Fixtures using `db_session.execute(delete(Game))` issue a Core-level DELETE, so `user_favorites` / `user_game_status` rows survive and the FK blocks. Fixtures using `TRUNCATE … CASCADE` are fine. | **Test-only** — `Game.favorited_by` / `Game.status_users` relationships mean ORM deletes (`remove_from_lib`) *do* clear the association rows |
| **`SERVER_NAME` never configured** | `RuntimeError: Unable to build URLs outside an active request without 'SERVER_NAME'`. `config.py` never sets it; only `test_theme_asset.py` sets it locally. | **Test-only today.** In-request `url_for(_external=True)` derives the host from the request. Latent risk: any future background job that builds an external URL will raise — the email digest currently builds none. |
| **App-context leaks** | `Working outside of application context` | Test-only |

Plus a fourth, found while fixing the others and the largest of the set:
`patch('...current_user')` returns an **AsyncMock**, because werkzeug's
`LocalProxy` forwards `__await__` and mock auto-detects it as awaitable. Every
attribute then yields a coroutine.

The check that broke my original claim: at the time,
`tests/test_routes_library.py` failed **20 of 27 in complete isolation**, with
the whole suite excluded — so isolation could not have been the explanation for
that file. (After the fixes below it passes 27/27 alone; see the residual
analysis.)

None of the four is a product defect, so the ~96% pass rate is not hiding
broken features. But the suite still cannot gate CI.

**Measured result (full runs, 3,108 tests each).**

| | baseline | after |
|---|---|---|
| FAILED + ERROR entries | 143 | **114** |
| passed | 2,965 | 2,994 |
| collection/fixture **errors** | 17 | **0** |
| `SERVER_NAME` failures | many | **0** |
| AsyncMock coroutine failures | many | **0** |
| `ForeignKeyViolation` | 56 | **2** |

**29 fixed, 0 new breaks.** All four causes above are closed or nearly so.

**What the remaining 114 actually are.** With those gone, the residual is
dominated by exactly the thing my earlier claim over-applied: **cross-file
state leakage**. `tests/test_routes_library.py` is the clearest case — it
passes **27/27 in isolation** and still contributes 15 failures to the bulk
run. Nothing is wrong with those tests or that code; a sibling file leaves
config or DB rows dirty.

So the original "isolation problem" reading was wrong as a description of
*all* the failures, and is right as a description of *what is left*.

**An attempted fix, and what it ruled out.** The obvious next step looked like
an autouse reset fixture in `conftest.py`. Two variants were built and measured
against a three-file sample: delete the shared `GlobalSettings` row before and
after each test, then the same but recreating it via
`initialize_default_settings()` (deleting alone is *not* equivalent to
defaulted — several endpoints read the row directly and report a missing row as
"off").

**Both were exactly neutral** — 2 failed / 21 passed, identical to the same
sample with no fixture at all. The fixture was reverted rather than shipped:
an autouse hook that costs a DELETE plus an init on all 3,108 tests and changes
no outcome is worse than nothing.

Two things this establishes for whoever picks it up:

* `app` is already function-scoped, so **`app.config` is not the leak** — a
  fresh app is built per test.
* The shared `GlobalSettings` row is **not the leak either**, despite being the
  obvious suspect and despite a real ordering-dependent failure
  (`test_arr_status_disabled` → `test_arr_status_enabled_via_config`) that
  pointed straight at it.

The residual therefore needs actual diagnosis — bisecting which file poisons
which, or per-test DB snapshotting — not another guessed reset. Worth doing
deliberately rather than by another round of plausible-sounding hypotheses.

## 3. Complexity hotspots

Not defects, but where the next bug will come from:

| Module | LOC | Note |
|---|---|---|
| `utils/game_core.py` | 2,432 | Scan, identify, enrich and apply all in one module |
| `models.py` | 1,973 | Every model; no domain split |
| `routes_apis/scan.py` | 1,569 | |
| `updateschema.py` | 1,403 | Linear raw-SQL migration script; per-statement errors are swallowed (this is how the `chat_spaces.created_at` omission went unnoticed) |
| `utils/cover_art_studio.py` | 1,300 | |

`updateschema.py` is the one with teeth: silent per-statement failure means a
migration can half-apply and report success.

---

## 4. Peer review coverage

Held in the private vault per **SCRUB-2** — peer catalogs and steal/ignore
matrices do not ship in public git. See `docs/_private/` and
[competitive.md](../competitive.md).

Audit result, in product language:

* Every product supplied across all batches now carries an explicit
  adopt / decline / already-covered decision. Two had been reviewed but never
  decided; both are closed, and one of them turned out to describe a **live
  defect in our code** rather than a nice-to-have — §2.3 above.
* **Already covered, do not rebuild:** ES-DE and Pegasus gamelist export both
  ship (`GET /api/export/esde`, `GET /api/export/pegasus`); per-core BIOS
  readiness is finer-grained than the flat "BIOS missing" others surface; and
  in-browser play remains a differentiator.
* **Cheapest real gap — corrected 2026-08-06.** I claimed CRT shaders and
  run-ahead were "wiring, not a subsystem" because RetroArch supports both via
  config keys. Checking before building showed that was wrong: **no shader
  files are vendored** under `static/vendor/webretro/`, so `video_shader` would
  point at nothing, and run-ahead costs an extra core step per frame — on
  single-threaded WASM, where heavy cores already stutter, it would make things
  worse. Both are real work, not a config line.
  What *was* one line: `play-skins.css` already draws a scanline overlay gated
  on `--gt-play-scanline-opacity`, which defaults to `0` and was **never set by
  anything** — the effect shipped invisible. Now wired per play room (strong on
  a living-room CRT, none on handhelds, since an LCD never had scanlines).
* **Largest visible gap:** an achievements system. Zero references in our
  codebase; needs account linking and a hardcore-mode stance, so a real slice.
* **Also worth taking:** a disk-level Library Health report (byte-identical
  ROMs, loose files, missing paths) — `utils/rom_hash.py` already computes
  crc32/md5/sha1, so this is a query over data we produce; a fifth completion
  state ("Won't Play") that doubles as the negative recommender signal; and
  mod profiles on top of existing mod tracking.
* **Unscheduled, not refused:** binary-patching surfaces, TAS/debugging tools,
  OS images, a first-party game-server panel, and media-only tooling. Each has a
  recorded reason and a "what would change it" in the private scope doc.

## 5. Recommended order

1. **§2.1 toggles** — an hour, and it removes two lies from the admin UI
2. **§2.3 remote path mapping** — the only *silent* failure in this report, and
   it breaks a headline feature on the target deployment
3. **§4 shaders + run-ahead** — cheapest visible win available right now
4. **§2.4 test isolation** — unblocks trusting the suite
5. **§4 achievements** — biggest visible gap, but a real slice

Unchanged from 2026-08-05 and still open: saved AND/OR filters (feeds Discover
shelves for free), session tracking + heatmap, persistent "not interested".
