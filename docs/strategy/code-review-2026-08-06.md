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
listed ROMarr feature that was never given an adopt/decline decision (see §4).
It matters most for exactly this project's target deployment (Unraid + Docker).

**Fix:** a small ordered list of `(client_prefix → local_prefix)` rewrites
applied to `content_path` before any filesystem call, plus a "test mapping"
button that reports whether the rewritten path exists.

### 2.4 Test suite cannot gate CI — **unfixed, known**

The full run confirms the shared-state isolation defect: failures accumulate
steadily through the run while the same tests pass in isolation (verified
repeatedly this session — e.g. `test_cover_art_studio`'s two failures reproduce
identically with all of today's changes stashed).

This remains **one fixture problem, not N product bugs**, but until it is fixed
the suite cannot be trusted as a gate — which is why every fix this session had
to be verified with targeted runs instead.

---

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

## 4. Competitive coverage — 23 sources

Two batches were supplied, plus a third today. Every one now has a decision.

### 4a. The 14 library/tracker projects (scanned 2026-08-04)

12 had explicit adopt/decline calls. **Two did not**, found by auditing the doc
against its own sections:

* **ROMarr** — *no decision recorded at all*, despite being one of the three
  repos supplied first. Its features: release scoring with reasons shown,
  per-platform routing to different backends, **remote path mapping**, ROM Hub
  plugin sources. Remote path mapping is §2.3 above — a real, live defect.
* **vglist** — its Wikidata idea is covered by ranked gap #7 but the project is
  never named, so it read as unreviewed.

### 4b. The 9 emulation platforms (supplied 2026-08-06)

RetroArch/Lakka · RetroPie · RetroDECK · Batocera · BizHawk · RomM · Recalbox ·
RetroBat · EmuDeck. (BIOS packs explicitly out of scope per the human.)

**Already covered — do not "adopt":**

* **Frontend interop** — `GET /api/export/esde` and `GET /api/export/pegasus`
  already emit ES-DE gamelists and Pegasus metadata. RomM's headline interop
  feature is done.
* **Per-core BIOS validation** with blocking-vs-optional honesty — better than
  the flat "bios missing" these frontends show.
* **In-browser play** — none of the nine plays in a browser; they are native
  frontends or OS images.

**Genuine gaps, ranked by cost-to-value:**

1. **Shaders / CRT filters, and run-ahead** — the vendored WebRetro RetroArch
   already supports both via config keys, and we already write that config
   block (`extraConfig` in `static/vendor/webretro/assets/base.js` — the same
   place the audio fix landed). Exposing a CRT/scanline preset and a run-ahead
   frame count is **a wiring job, not a new subsystem**, and it pairs directly
   with the play-rooms and theming work already shipped. *Highest value here.*
2. **RetroAchievements** — zero references in the codebase. Every one of the
   nine supports it; it is the single most visible feature we lack against
   them. Needs an account link + hardcore-mode stance, so it is a real slice.
3. **Netplay** — RetroArch supports it; we have voice but no shared session.
   Larger, and NAT traversal is a genuine ops burden. Consider after 1.
4. **Steam ROM Manager–style export** (EmuDeck) — add library entries to Steam.
   Small, but only useful to Deck/desktop users.

**Declined:** BizHawk's TAS surface (frame advance, Lua scripting, RAM
watch/search) — accuracy-research tooling, not a household library feature.

---

## 5. Recommended order

1. **§2.1 toggles** — an hour, and it removes two lies from the admin UI
2. **§2.3 remote path mapping** — the only *silent* failure in this report, and
   it breaks a headline feature on the target deployment
3. **§4b.1 shaders + run-ahead** — cheapest visible win available right now
4. **§2.4 test isolation** — unblocks trusting the suite
5. **§4b.2 RetroAchievements** — biggest competitive gap, but a real slice

Unchanged from 2026-08-05 and still open: saved AND/OR filters (feeds Discover
shelves for free), session tracking + heatmap, persistent "not interested".
