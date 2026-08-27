# W26 — UX overhaul + feature backlog

**Source:** human feedback 2026-08-03 (single dump, ~35 items) · **Status:** captured, in progress

Grouped by size so the quick defects are not held hostage by the big rocks. IDs are stable —
quote them when re-prioritising.

---

## A. Defects (small, concrete)

| ID | Item | Status |
|---|---|---|
| **UX-A1** | Tile **select** icon overlaps the system label — move it under the other three in the top-right stack; all **4 buttons black, same size, aligned** | **Done** — shared `--gt-tile-*` vars drive one size (32px), one colour, one rhythm; select moved out of bottom-left into slot 4; badge stack offsets follow the stack so they cannot drift · **Reset Themes** after deploy |
| **UX-A2** | Bottom-right labels (e.g. **UPDATE**) sit one row above the bottom instead of on it | **Done** — the stack was lifted `bottom: 44px` to clear a play-status button that had since moved to the **top**-right. Stale clearance; now `bottom: 8px`, level with bottom-left. The details cover keeps its lift because a button genuinely sits there |
| **UX-A3** | **Show more** appears even when the text is short — only render when content actually overflows | **Done** — gated on `length > 420` while the CSS clamps at 8 lines, so the two disagreed in both directions. Now measures real overflow (`scrollHeight` vs `clientHeight`) with a `ResizeObserver`, so text that fits wide but clips narrow behaves correctly |
| **UX-A4** | **Ownership link is broken** | **Not reproduced — needs your retest.** Route `/ownership`, blueprint, page and all 12 `/api/ownership/*` endpoints exist, match the client, and are **committed in HEAD**. Points to deployment lag rather than a code defect. If it still 404s after redeploy I need the server log line |
| **UX-A5** | Library page size defaults to **20**, should be **50** | **Done** — model default, both server fallbacks and both SPA fallbacks; migration moves rows still on the *old default* 20 → 50 (deliberate 100/200 choices untouched) |
| **UX-A6** | Remove every **sharewarez** mention and leftover code | **Done** — the earlier "0 hits" claim was wrong: `get_warez_folder_usage()` survived in `utils/system_stats.py` as a deprecated alias with no caller but its own test, both now removed. Re-audited 2026-08-12: shipped `static/dist` bundles, templates and tracked filenames are clean; every remaining match is deliberate (scrub-policy wording, the `warez` term in the `related_media` link blocklist, and the `DATA_FOLDER_WAREZ` migration note). `.env.bak-warez-rename` is untracked, so it was never published. **SCRUB-5 is closed too**: `git ls-remote` shows origin carrying only `main` and two `cursor/*` branches, none of which reaches the `Initial commit: SharewareZ rewrite` tree — the `feature/*` branches that once did are already gone from GitHub. An earlier note in this file (and commit `005a9ef9`) claimed they were still public; that was read off **stale local remote-tracking refs**, since `git fetch` does not prune deleted branches by default. No history rewrite and no force-push are needed. Verify with `git fetch --prune` before trusting `git branch -r`. **Re-audited again 2026-08-13** across installers, Compose, `Dockerfile`, `config.py` and both clients — still clean, and `DATA_FOLDER_WAREZ` appears nowhere outside its migration note. That sweep did turn up **one unrelated tracked artefact**: `clients/desktop/' + $log + '`, a captured vitest log committed in `3771cb3b` under a filename where a PowerShell `' + $log + '` never interpolated. Not brand-related, but it was junk in the tree — removed |
| **UX-A7** | **Check stores** is a misleading name — it checks updates/DLC; rename accordingly | **Done** — now "Check updates & DLC" + tooltip; failure text follows |
| **UX-A8** | **Companion offline** belongs on the size/status/freshness row | **Done** — chip on the status row; `GameActionBar` gains `showPresence` so details opts out instead of showing the same fact twice |

## A-bis. Emulation A/V quality (added 2026-08-03)

| ID | Item | Status |
|---|---|---|
| **EMU-1** | Emulated games run badly — audio glitchy and slightly fast | **Root cause corrected 2026-08-13 — fix applied, needs verification on a >60Hz display** |

> **The first root cause below was wrong.** It is kept because the change it produced was correct and
> still ships — but it treated a symptom. Read the 2026-08-13 entry as current.

**Actual root cause (found 2026-08-13):** nothing measured the **display refresh rate**. RetroArch
defaults `video_refresh_rate` to 60, and with `video_vsync = "true"` the web build paces to rAF — so on
a 120/144/165Hz monitor the core ran **2–2.75× too fast**, with audio rate-control chasing a gap it
could never close. That is the reported "runs fast, sound is terrible", and it is a **clock a whole
multiple out** — no resampler setting can correct it.

**Applied:** `measureRefreshHz()` samples 32 frames and takes the **median**, with a hidden-tab guard
(a backgrounded tab throttles rAF and would otherwise measure a fictional rate). The measured value is
written as `video_refresh_rate` — [base.js:63](../../gametheca/static/vendor/webretro/assets/base.js:63).

**Superseded first pass (2026-08-03) — still shipping, still correct.** `base.js` had
`audio_max_timing_skew = "0.15"`, three times the usual `0.05`, with `video_vsync = "true"` and **no
`audio_sync`**, so the resampler was allowed ±15% to chase the 60Hz-vs-60.098Hz NTSC gap (PAL 50Hz).
Now: `audio_sync = "true"` (audio is the master clock) · `audio_rate_control = "true"` +
`audio_rate_control_delta = "0.005"` · `audio_max_timing_skew` back to `0.05` · `audio_latency` left at
96ms, deliberately generous for browser audio. This was a genuine misconfiguration and worth fixing —
it just was not what made emulation run fast, which is why the symptom survived it.

**Open — needs live verification.** The refresh fix is unverified on real hardware: it cannot be
confirmed on a 60Hz panel, because that is precisely the case where the old hardcoded default was
already correct. Needs one pass on a >60Hz display.

**Open — per-system tuning.** Deliberately held: per-core option keys must match each core exactly, and
a wrong key **silently does nothing**, so guessing would produce fake fixes. Needs one pass with real
playback per brand (NES · SNES · Genesis · GB/GBA · PS1 · N64) — but only **after** the refresh-rate fix
is confirmed, since a mis-clocked player would otherwise be blamed on the cores.

## B. Layout / chrome rework (medium)

| ID | Item |
|---|---|
| **UX-B1** | Library show/hide belongs **in the panel** — slide in/out from the left, not a card — **Done**: panel now translates out and returns its width to the grid, leaving only a slim handle pinned to the left edge (was a 2.25rem rail still sitting in the layout) |
| **UX-B2** | **Chat** next to Friends; it currently overlaps the up/down icons — **Done**: launcher was `left: 1rem` / `bottom: 1rem`, exactly on top of `ScrollJump`. Moved to the right, stacked above the Friends dock |
| **UX-B3** | Tile hover: grow slightly, show a **preview hint**, open a **popup** with a shortened detail view; thin **theme-coloured glow** — **Done**: `GamePreviewPopup` (cover · clamped blurb · facts · genres · Open details), hover lift raised to 1.045 with an accent glow via `color-mix` so it follows the active theme, Preview pill appears on hover/focus. Esc + scrim close; reduced-motion respected |
| **UX-B4** | Game details: kill the dead space under the summary — **Done 2026-08-26**: later sections (versions, extras, screenshots, trailers, …) now flow up beside the facts rail in the same grid. Narrow viewports keep summary → details → the rest |
| **UX-B5** | Cards must never render empty space — **Done (admin card grids)**: root cause was `repeat(auto-fill, …)`, which keeps empty columns alive so a two-card row stayed narrow with dead space beside it; switched to `auto-fit`. Cards are now flex columns at `height: 100%`, so a short card fills its cell instead of leaving a gap under it |
| **UX-B6** | Loading icons: **animated per icon**, shown as a **popup** — inline spinners shift the layout on every server event — **Done 2026-08-27.** `LoadingOverlay` on library boot (blocking), Ownership (delay 0), and Trailers **Another one** (250ms, previous player stays). Remaining page-owning loads use `PageStatus` (Remote play, Libraries table, Integrations inventory, Images queue, Stock catalog, Systems, Cheats, Big Picture). Button `gt-spinner--sm`, DiscoverShelf's reserved pending tile, and section hints (extras / shelves / calendar teaser / space rail) stay inline on purpose |
| **UX-B7** | **Toasts everywhere** (member + admin), dismissible; only announce games once a library has **fully** finished adding — **done 2026-08-25**: member dismiss was earlier; admin SPA close button + library-add poll; classic `$.notify` bridged to `gt_toast.js`; digest held until the scan job ends (cancel included). Watch/import still debounce |

## C. Admin IA (medium–large)

| ID | Item |
|---|---|
| **UX-C1** | **Server status** is not its own section — fold into the dashboard — **nav done**: dropped from the System hub. Dashboard already carries the signals; the standalone page is no longer offered as a destination |
| **UX-C2** | Libraries + scans are one page now: combine the two main-menu buttons; all tabs follow the library colour scheme — **nav done**: one **Libraries & scans** item; hub lists merged. Also fixed the knock-on — `resolveActiveNav` still returned `'scans'`, an id no longer in `ADMIN_NAV`, so scan pages would have highlighted nothing |
| **UX-C3** | **Library tools** must be far more approachable — **Done**: tabs renamed from internal tool names to tasks (*Library Doctor* → **Tidy folder names**, *Proposals* → **Review suggested fixes**, *Freshness* → **Check for updates**). The doctor's three buttons now read as an explicit 1-2-3 with the destructive step named "Rename on disk" and stated as irreversible; fields gained plain labels and examples. **Element ids untouched** — the page JS binds to all 11, verified |
| **UX-C4** | Add **more than one library at a time** — **already existed; it was undiscoverable.** `ProposeLeafLibraries` (scan a root → multi-select → confirm) and `ImportLeafLibraries` (CSV/JSON → multi-select → confirm) both create in bulk via `confirmCreateSelected`. They were named for their mechanism, so neither read as "add several at once" and the single-library form looked like the only route. Relabelled to **Add one library** / **Add many — scan a folder** / **Add many — import CSV/JSON**. No new backend |
| **UX-C5** | Unmatched: add **Bad match** with selectable reasons (+ Other) — **Done 2026-08-13.** UI landed in `49b73b37` (React `DupeGlance`) and `6760328a` (the classic unmatched table too, so the two surfaces do not disagree about whether feedback is possible). Backend as below: `bad_match_reason` / `note` / `at` / `by_user_id` on `UnmatchedFolder`, kept separate from `match_reason` (the matcher explaining itself) so a human contradicting it stays distinguishable. `GET /api/unmatched/bad_match_reasons` serves the vocabulary so the UI never hardcodes it; `POST …/bad_match` records or clears. **Non-destructive on purpose** — feedback about a match must not double as a triage delete. `other` requires a note |
| **UX-C6** | Unmatched table is cramped; **dupes** are too small to read — **readability done**: 17 rules sat at ~0.7rem (≈11px); floor lifted to 0.78rem with the tier hierarchy preserved. *(A first sed pass cascaded `0.68→0.78→0.86` and inverted two tiers — caught and remapped from the original values.)* **Density done:** paddings and gaps raised in one non-cascading pass; compare label column 3.25rem→4.25rem because field names were **wrapping**, which is what actually made it read as cramped; hairline separators between compare fields so the two sides read value-by-value; stacked breakpoint moved 720px→900px, where each side had shrunk to ~330px and the rows wrapped into mush |
| **UX-C7** | **Image queue** UI redone to match the other pages — **Done (flat mode)**: now a real sortable/filterable `DataTable` with thumbnail, game, kind, status, failure detail and row actions. Grouped-by-game keeps its thumbnail cards, which suit images better than a table |
| **UX-C8** | **Every table** filterable and sortable, across the whole UI — **Done**. Shared `DataTable` on Invites · Support · Users · image queue · library propose/import · remaining `pages.jsx` tables. Classic pages use `gt_sortable_table.js`. Two Ops tables stay hand-rolled by decision: `DetailPanel` (key/value, no header) and Services (fixed diagnostic checklist). Sort asc→desc→clear, numeric-aware, absent values last in both directions, `value()` hook so a cell that renders markup still sorts on its real value, never mutates the caller's array, sticky header, own horizontal scroll |
| **UX-C9** | **Settings** should read like scans — drop the card treatment — **Done**: 15 flat cards became 4 grouped panels (Library & matching · Play & emulation · Presentation · Extend) of dense title+blurb rows. Cards gave every module identical visual weight and spread a short list over a lot of empty space. `SETTINGS_CARDS` kept as a flat derived view so existing links/tests still resolve |
| **UX-C10** | **Content/discovery sections**: better authoring UI for creating zones and pulling games in — **Done**: search-and-pick by title replaces "paste one UUID per line, find them on each game's admin page". Picked games list in order with remove buttons and a live count; the UUID textarea survives behind a disclosure as the advanced path and stays two-way synced, so hand-editing still wins. Existing zones open with their games listed rather than raw ids |
| **UX-C11** | **Integrations** page/tab matches the libraries style; close up the empty space — **Done**: card grid → dense rows matching Settings/Libraries. Providers carry very different link counts, so an even grid left tall gaps beside the short entries. Titles stay `<h2>` so the hub remains navigable by heading |
| **UX-C12** | **Ops console** metrics colour-coded by state — **Done**: the tone classes already existed but only **2 of 16** tiles passed one, so the console was mostly monochrome. Added `usageTone` (higher is worse), `healthTone` (higher is better) and `booleanTone`, with per-metric thresholds — DB ping is milliseconds, not a percentage, so it cannot share the 85/95 cutoffs. **Unknown reads return `na`, never green** — "could not read it" is not "healthy" |
| **UX-C13** | **Statistics** redone — more graphs, tables, better layout — **Done**: headline totals strip (games · libraries · members · downloads · favourites · library size) and a **Most downloaded titles** table alongside the existing 6 charts. A chart shows shape but cannot be read for an exact figure, which is usually the actual question. Totals are counted independently so one failing aggregate cannot 500 the page; table rows use `textContent` since titles come from scraped metadata |
| **UX-C14** | **News** should read like Steam/Epic / a games outlet — **Done**: root cause was the RSS parser **discarding artwork** — feeds advertise images in `<enclosure>`, `<media:content>` and Atom enclosure links, and none were read, so headlines could only ever be a text list. `_item_image()` now extracts them (**https only** — an http image on an https page is blocked as mixed content anyway), and headlines render as image-forward cards. Feeds with no artwork get a gradient placeholder; a dead URL collapses the frame rather than showing a broken icon |

## D. Features (large — each is its own slice)

| ID | Item | Notes |
|---|---|---|
| **FEAT-D1** | Scan detects **version + available updates/DLC**, not just identity | **Backend done — QA 11/11.** The freshness service already resolved version *and* `dlc_count`; scanning simply never called it, so a fresh library knew nothing until someone pressed the button per title. `check_library_freshness()` runs as a **capped pass after** the scan (inline would mean store HTTP inside the scan loop — slow, and hammering stores on a large import). Opt-in via `SCAN_CHECK_FRESHNESS`; `only_missing` spends the budget on unknowns; per-title failures are counted, never raised, so a store outage cannot fail a scan that already succeeded. Also exposed as `POST /api/library_tools/check_freshness` for an already-scanned library |
| **FEAT-D2** | **PC cheat system** for installed games | **Backend done — QA 10/10.** `PcCheat` model + `/api/games/<uuid>/pc_cheats` GET/POST/DELETE. The `pc_wand` surface already existed and reported correctly; it was simply never backed by anything. **Notes, not a trainer** — methods are console command · config edit · save-file field · launch flag · note, so no path writes a binary or injects into a process; a test asserts the vocabulary contains no inject/patch/trainer verbs. `.cht` stays RetroArch-only and the two surfaces refuse each other's platforms. `single_player_only` defaults **true**. Delete requires the matching game, so a cheat id alone cannot delete across games. **Member panel done — QA 7/7:** `PcCheatsPanel` self-gates on `cheat_surface === 'pc_wand'`, so it and the RetroArch panel can never both render for one title; copy-to-clipboard on payloads, single-player flag, honest empty and error states, and the notes-not-a-trainer stance stated in the panel. **Authoring done:** librarians get an add form and per-row remove; the method picker is populated from the API response so it cannot drift from what the backend accepts |
| **FEAT-D3** | **AI artwork** for titles/systems with missing or poor art | **Adapter built** — `ai_artwork.py`: `ArtworkGenerator` interface, `A1111Generator` (covers AUTOMATIC1111 / SD.Next / Forge), `ComfyUIGenerator` stubbed with an **honest error** rather than a blind workflow guess. `ENABLE_AI_ARTWORK` off by default · `AI_ARTWORK_URL` / `AI_ARTWORK_ENGINE`. `build_prompt` is the single payload composer, and tests pin that paths/identity cannot appear in it. **Persist + trigger + profile done:** `Image.is_generated` / `generated_by` label the output; `generate_and_store_cover` replaces only a previous *generated* row so a librarian's curated cover is never overwritten; `POST /admin/api/artwork/generate` (403 when disabled, 502 when the endpoint fails — config vs upstream distinguished); optional `artwork` Compose profile running SD.Next. **QA 24/24.** **Admin trigger done:** *Generate artwork* on the Images page, disabled until a title is selected, and a failure names the missing config rather than just erroring. **Batch done:** `POST /admin/api/artwork/generate/batch` fills **only titles with no cover at all** — generated art is a better placeholder, never a replacement for a cover someone chose — capped per call since each title is seconds-to-minutes, per-title failures reported not aborted, and re-running skips rather than churns |
| **FEAT-D4** | Art studio: generated **text is tiny and illegible**; make it **editable** | **Done.** Headline/subtitle/`title_scale` on preview and generate. **UID-011 2026-08-26:** idle title scale **1.3×**, floor **0.85×**, slider always posts `title_scale`. |
| **FEAT-D5** | **Emulator pages** redesigned around the *feel* of the system — room/arcade visuals | **Room model done — QA 11/11.** Existing platform skins group by **brand**, which is right for library chrome but wrong here: a Mega Drive and a SNES shared a living room, a Neo Geo cabinet did not. `play_rooms.py` groups by **setting** — living-room CRT · arcade cabinet · handheld · disc era · desk — each carrying palette, ambience and its era font from the font registry. Surfaced on the play payload as `play_room` + ready-to-apply CSS vars; unmapped platforms get a plausible default rather than breaking the page. A test asserts no room imitates manufacturer trade dress. **Visual layer landed on Systems:** `playRooms.js` mirrors the backend map (kept static, not fetched — it is needed at first paint and a round-trip for a background colour would flash unstyled); each system tile carries `data-room` + scoped `--gt-room-*` vars, with CRT scanlines, an arcade marquee glow and desk phosphor as light ambience that never fights the text. **Player chrome landed 2026-08-25 (UID-007):** Pause / Reset / Mute / volume / Power on the play bar plus a bezel overlay — vendor WebRetro shell, not a new theming engine. **Re-scoped 2026-08-13** — this is the *Emulator player chrome* item (volume · power · reset · pause, per-system UI), tracked as **UID-007** in [ui-debt-log.md](../dev/ui-debt-log.md), with **Provenance-Emu/Provenance** as the reference for per-system look and in-game control overlay (desktop proportions, not handheld). The BIOS half of UID-007 is **closed**: `list_bios_files` was a flat `os.listdir` that skipped directories, so per-system firmware sets (`bios/psx/`, `bios/saturn/`) made a populated volume read as empty — nested files are now found, and *present but misplaced* is reported distinctly from *absent*, since libretro cores read the system root |
| **FEAT-D6** | **Free game claiming** seamless when a store account is linked; deeplink only as fallback | Ownership/account linking dependency |

---

## Sequencing note

**A** first (fast, visible, low risk), then **B**, then **C** page-by-page, with **D** slices
scheduled individually — each D item is comparable in size to a whole prior wave.

---

## Open set — reconciled 2026-08-13

This file went two days without absorbing the shipped work, so a reader could have taken closed items
as open and, worse, taken EMU-1's superseded root cause as current. Reconciled against
[ui-debt-log.md](../dev/ui-debt-log.md), which stayed current throughout.

**The four big rocks** (each its own slice):

| Item | Where it is tracked |
|---|---|
| **Emulator player chrome** — volume · power · reset · pause, per-system UI | **Done 2026-08-25** — UID-007 · FEAT-D5 (clock + BIOS earlier; bar/overlay chrome now) |
| **Libraries & Scans overhaul** — auto-scan / library-maker unification, library tools incorporated | **Done 2026-08-26** — Tools tab on `/scan_management`; old URL redirects |
| **Card layout redesign** — surfaces are unified, individual layouts untouched | extends UX-B5 |
| **GOG / Epic live sync** | **Done 2026-08-26.** Unofficial Galaxy / launcher surfaces; register-only (IDs and names, never a download). Product decision: unofficial is acceptable here; fail honestly on 401. CSV still works. Amazon remains snapshot. The poller still **refuses to start** if a store is advertised live without a working handler. |

**Smaller, still open** — these are easy to lose behind the big rocks, which is exactly what the
grouping at the top of this file was meant to prevent:

| Item | State |
|---|---|
| **UID-006** | **Done 2026-08-26** — `GENERATOR_VERSION` 16 authors radius / space / type / shadow per preset |

`UID-008a` (Jinja loading motifs) and **UX-C8** (DataTable) are **done**. **UX-B4** (game-details dead space) is **done 2026-08-26**.

**Awaiting your verification, not our work** — both are blocked on a real machine, so they will sit
here indefinitely unless explicitly retested:

* **EMU-1** — the refresh-rate fix cannot be confirmed on a 60Hz panel. Needs a >60Hz display.
* **UX-A4** — ownership link not reproduced; needs a retest after redeploy, with the server log line if
  it still 404s.

## Stance reversals — decided 2026-08-03

Both were previously locked shut. The human reversed them explicitly; recorded here so the change
reads as a decision rather than drift.

### FEAT-D2 — PC cheats: **reopened**

*Was:* `cheat_surface` RetroArch-only; PCWIN/PCDOS/MAC/OTHER = `pc_wand` **deferred**; no Class A
trainer brands. *Now:* build a first-party PC cheat surface for installed games.

Carry-overs that still hold:

* `.cht` files stay RetroArch-only — the PC surface is its own thing, not a `.cht` mutation path
  (the existing **403** guard on non-RetroArch `.cht` writes stays).
* Cheat data stays **operator-owned**, same stance as the patch catalog: no scraping third-party
  trainer sites, no bundling their databases.
* Never writes to game binaries. Read/annotate only unless the human later approves otherwise.

### FEAT-D3 — AI artwork: **approved, provider still open**

*Was:* nothing in the product leaves the box. *Now:* generated artwork is allowed for titles and
systems with missing or poor art.

This is the product's **first outbound data path**, so it needs to stay narrow and visible:

* Opt-in and **off by default** (`ENABLE_AI_ARTWORK`), consistent with `ENABLE_AI_AUTO_APPLY`.
* Sends only what generation needs — title, platform, genre. **Never** file paths, library layout,
  user identity or ownership data.
* Local model (e.g. a self-hosted SD endpoint) must be a first-class option so an air-gapped
  install keeps working; a hosted API is the alternative, not the assumption.
* Generated art is clearly attributed as generated in the DB, so it can be found and replaced later.
### Provider — decided 2026-08-04

**Self-hosted, A1111-compatible HTTP API, as an optional Compose profile.** Second adapter for
**ComfyUI** behind the same interface.

Why this one:

* `/sdapi/v1/txt2img` is the de-facto standard — **AUTOMATIC1111 · SD.Next · Forge** all speak it, so
  one adapter covers three engines and none of them locks us in.
* Free and on-box: no keys, no per-image cost, and the "first outbound data path" concern disappears
  because nothing leaves the network.
* Matches the existing sidecar precedent exactly (`livekit`, `challenge`/TRAWL, `clamav`): a profile
  that is **off by default**, operator supplies the endpoint.

ComfyUI is the better tool but a poor *first* target — its API takes a whole workflow graph as JSON,
so the adapter would couple to one workflow file rather than a prompt payload. It goes behind the same
`ArtworkGenerator` interface as adapter #2.

> TRAWL cannot do this job — it is a challenge solver, not an image generator. It is the right
> *precedent* for wiring, not the engine.
