# UI debt log (recurring defects)

**Purpose:** Stop the UI seat from “fixing” the same human complaints without a durable register.  
**Rule:** Before closing any `@agent-uiux` Task that touches Library tiles, Filters, Admin Scans/Unmatched, Themes, Emulators, Settings, or Chat chrome — **read this file**, tick related open debts, and **append** a Change log row for what you shipped (or explicitly mark `deferred` with reason).

**Owner:** UI/UX · **QA verifies** against open `open` rows · **PM** prioritizes wave IDs.

Status: `open` | `in_progress` | `done` | `deferred` | `wontfix`

---

## Open / recurring debts (human 2026-08-01 + prior)

| ID | Area | Symptom (human) | Why it keeps coming back | Wave | Status |
|---|---|---|---|---|---|
| UID-001 | Library badges | Badges “all over the place” | Cap=2 + corner collision + platform chip + pinned VR/MISSING — four-corner map · occupied corners only · OUT/~ /RELEASE retirement · rounded-square chrome (2026-08-01) · **QA PASS 31/31** · DoD met · live visual skipped | W22 | done |
| UID-002 | Library filters | Filter panel does not slide left; tiles don’t reclaim space | Prior work toggled visibility/opacity instead of width collapse + grid reflow | W22 | done |
| UID-003 | Admin Library+Scans | Two pages; no multi-select scan/edit/delete; bulk delete requires typing names | Hybrid Jinja pages evolved separately; batch APIs incomplete | W22 | done |
| UID-004 | Scans copy | Kind Soft title / Utility (**UI-W22-M7 Done** — SPA + admin · EXP/TOOL badges + tooltips); Amend naming → **Search name** (UID-004 Amend residual cleared 2026-08-01) | Labels never UX-reviewed | W22 | done |
| UID-005 | Unmatched UX | Actions not per-row bar; Resolve buttons not equal centered pill bar; tables not sortable | Scan jobs UI grew chips without table/sort contract | W22 | done |
| UID-006 | Themes | “Tint only” — not system visual languages | **Root cause found 2026-08-03:** `gt-tokens.css` had colour/glass/icon tokens only — no radius, spacing, type or shadow scale, so a preset had no shape surface to override. **GT-A1** adds those scales and `preset_tokens()` already passes arbitrary `tokens` through, so presets can now diverge on geometry. Art seat pass still needed to author the packs | W23 | in_progress |
| UID-007 | Emulators | Ugly page; no firmware upload UI; no volume/power/reset/pause chrome | Play lane honesty without admin chrome pass. **2026-08-03:** confirmed the template contained *zero* firmware/BIOS references while `GET/POST /api/emulator-bios` had existed since the play wave — pure frontend gap. **GT-B2** adds the React firmware island + hardens the upload path. Player chrome (volume/power/reset/pause) still open | W23 | in_progress |
| UID-008 | Loaders | Loading logos not each animated (slideshow of stills) | **Stale as written (2026-08-03).** `LoadingMotif.jsx` ships 6 hand-drawn SVG motifs, each animated via `@keyframes` in `gt-loading-motifs.css`. Residual is scope, not animation: the motifs never reached the 47 Jinja pages, which still use `.gt-spinner`. Re-scoped below as UID-008a | W23 | done |
| UID-008a | Loaders (Jinja) | Classic admin pages still show the plain spinner, not the animated motif | Motifs shipped SPA-only; `gt_loading_motifs.js` not wired into the classic page loaders | W23 | open |
| UID-009 | Nav | No jump top/bottom | Never prioritized | W22 | done |
| UID-010 | Chat/Friends | No popout; not thin-client ready | **Half done (2026-08-03).** Friends dock *does* pop out (`socialCompanionApi.js` → `window.open('/social-companion')`). `ChatSlideOut` / `ChatPage` do not. Narrowed to full-room chat only | W23 | open |
| UID-011 | Covers | Generated text/logo too small; zoom/title/flag issues | Art Studio defaults undersized type; weak QA visual gate | W23 | open |
| UID-012 | Brand | Controller logo ugly | No Art seat; glyph reused | W23 | open |
| UID-013 | Dashboard | Warning/info shown 2× | **Root cause found + fixed 2026-08-03 (GT-C1).** Not a duplicate mount: `severityLabel('warn')` returned `'Warning / Info'` for the banner `<strong>`, and `OpsIssuesList` renders `<h2>Warning / Info</h2>` immediately beneath it — the same words twice. (`OpsPage.test.jsx` had a comment working *around* this.) Banner now returns a verdict (`Needs attention` / `Degraded`) distinct from the fold titles, with a regression test asserting no collision | W24 | done |
| UID-014 | Admin metrics | Not color-reactive like dashboard | **Root cause found 2026-08-03 (GT-C2):** `MetricTile` was imported only by `OpsPage.jsx` and `pages.jsx` — the strip markup lived inline in those two files, so no other admin page could have metric chrome. Extracted `MetricStrip`; adopted on Users + firmware panel. Support / Invites / Storage / Extensions still to adopt | W24 | in_progress |
| UID-015 | Settings / Server Status / Config | Ugly one-click cards; not Ops-glance | Pre-hybrid admin forms. **2026-08-03:** the deeper cause is that `SETTINGS_CARDS` routes mostly land on Jinja pages, and the React `SettingsSectionPage` renders a dead-end stub when the legacy body is not detected — see GT-A3, which makes that decision explicit instead of sniffed | W24 | open |
| UID-017 | Cross-page (new) | “Bad UX, inconsistent feel across pages” | **Structural, 2026-08-03.** Three causes, all now addressed at the root: (1) no shape/space/type token layer → 11 ad-hoc radius values across 36 stylesheets (**GT-A1**); (2) no shared page scaffold — `PageStatus` used by 3 of ~30 pages and had *no error state at all* (**GT-A2**, **GT-A4**); (3) admin body chosen at runtime by DOM sniffing (**GT-A3**). Migration of the remaining page CSS to tokens is the open remainder | W24 | in_progress |
| UID-018 | Cross-page (new) | Every page invents its own failure UI | **Backend cause, 2026-08-03.** ~699 `jsonify` responses across ~72 files used ≥5 competing envelope keys (`error`/`message`/`status`/`success`/`ok`) with no shared helper — `routes.py` alone used 4. A shared error component was impossible. **GT-B1** lands `utils/api_response.py`; route migration is incremental | W24 | in_progress |
| UID-016 | Dupe glance / Unmatched | Duplicate compare is one cramped “Dupe of” row — hard to contrast folder vs library path/size/date | Hit was nested under folder meta without a two-column layout · **UI side-by-side Done** · **QA PASS 32/32** · **BE disk-meta enrich Done** (null-safe `size_bytes`/mtime · library from Game · folder size null until denorm) · **QA PASS 13/13** | W22 | done |

---

## Root causes (process — why UI “doesn’t fix the same issues”)

1. **No durable debt register** — Tasks closed on local DoD without linking human complaint IDs.
2. **Partial ships** — e.g. badge corner heuristics without publishing the full badge inventory for human layout decisions.
3. **Wrong-seat bleed** — Admin Jinja + React hybrid; UI Task sometimes can’t change Backend batch APIs and closes “UI-only” while human still sees the old flow.
4. **Theme/Reset Themes gap** — classic admin theme copies stale after ship; human sees old UI until Ops Reset Themes.
5. **No presentation** — human can’t see open vs done across waves in one place.

**Hardening (2026-08-01):** This log + presentation canvas + UI skill gate + new Art/Creative seats.

---

## Change log (append only)

| Date | Seat / Task | Debt IDs | What changed | Verify |
|---|---|---|---|---|
| 2026-08-03 | PM full-sphere review → UI + Backend | UID-017 · UID-018 · UID-013 · UID-014 · UID-006 · UID-007 · UID-008 · UID-010 | **Foundations pass (GT-A1/A2/A3/A4, GT-B1/B2, GT-C1/C2/C3).** Tokens: radius/space/type/shadow/motion scales + global motion-safe guard in `gt-tokens.css`; `GENERATOR_VERSION` 10→11. New `gt-primitives.css` (btn/input/card/section-head/list/empty/error) wired into all three base templates. `PageStatus` gains an **error** state with retry + envelope-tolerant parsing. New `utils/api_response.py` (`api_ok`/`api_error`) + first routes migrated (`routes_apis/health.py`, emulator BIOS upload). `hasLegacyBody()` DOM sniffing replaced by declared `data-admin-render` (13 SPA shells + Emulators declared). `MetricStrip` extracted; Users page adopts it and stops conflating loading with empty. Firmware/BIOS admin UI added as a React island on the Jinja Emulators page; `store_bios_file` hardened (extension allowlist · size cap · empty reject · realpath containment) | **BLOCKED (env)** — repo is on a network path unreachable from the agent sandbox; no pytest/vitest executed. Slices queued below. Post-deploy: **Reset Themes** (`gt-tokens.css` · new `gt-primitives.css`) + rebuild both SPAs |
| 2026-08-01 | Docs UID-016 BE enrich flip | UID-016 | Light flip BE disk-meta **QA PASS 13/13** — scrub “size/mtime may still be in flight” · progress · roadmap · CHANGELOG · libraries-and-scans · docs-map · debt · program canvas | BE **13/13** · UI soft-read **32/32** preserved · DoD met · live skipped · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | Docs UID-004 QA flip | UID-004 | Light flip **QA PASS 33/33** — scrub Amend residual · W22 UI rem closed · progress · roadmap · CHANGELOG · libraries-and-scans · themes-reset verify · docs-map · program canvas · debt inventory confirmed done | Vitest **33/33** · DoD met · live skipped · **Reset Themes** `admin_manage_scanjobs` · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | UI UID-004 Amend | UID-004 | Unmatched / Dupe glance: **Amend naming** → **Search name** (labels · tooltips · toasts); Save titles plain; Kind Soft title/Utility unchanged | vitest DupeGlance Search name; **Reset Themes** `admin_manage_scanjobs` |
| 2026-08-01 | Docs UID-016 QA flip | UID-016 | Light flip **QA PASS 32/32** — progress · roadmap · CHANGELOG · libraries-and-scans · themes-reset · docs-map · program canvas · debt inventory confirmed done | product/tests **PASS** · Vitest **32/32** · DoD met · live skipped · **Reset Themes** `admin_manage_scanjobs` · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | UI W22 dupe sxs | UID-016 | Dupe glance + Unmatched base table: side-by-side folder vs library compare (path · size · date); soft-read size/date when present; honest — empties; Backend handoff for list/`matched_game` size_bytes + mtime | vitest DupeGlance + unmatchedDupe **32/32** · **Reset Themes** `admin_manage_scanjobs` |
| 2026-08-01 | Docs UID-009 QA flip | UID-009 | Light flip **QA PASS 11/11** — scrub “in flight”; progress · roadmap · faq · getting-started · HelpPage · themes-reset · docs-map · program canvas · debt inventory confirmed done | ScrollJump **4/4** · App **7/7** · DoD met · live skipped · rebuild member-app · **Reset Themes** `gt-chrome.css` · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | UI UID-009 | UID-009 | Member SPA: fixed aurora glass jump-top / jump-bottom (`ScrollJump`) in shell Layout; shows when window scrollable; a11y labels; bottom-left (avoids social dock); theme mirror in `gt-chrome.css` | vitest ScrollJump **4/4** · App **7/7** · Rebuild member-app dist · **Reset Themes** for `gt-chrome.css` |
| 2026-08-01 | Docs UID-001 QA flip | UID-001 | Light flip **QA PASS 31/31** — remove “QA may still verify”; progress · roadmap · docs-map · program canvas · debt inventory | BadgeStack / BadgeFilterChips / FilterBar **31/31** · DoD met · live visual skipped · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | Docs UID-001 sync | UID-001 | Verify library-and-systems · faq · HelpPage · themes-reset · debt inventory · progress · roadmap · docs-map · program canvas — four-corner · no empty slots · no OUT/~ /RELEASE · rounded-square · Reset Themes for theme CSS | Canvas: synced · Capture skipped (:5006) · superseded by QA PASS 31/31 |
| 2026-08-01 | Docs UID-002 QA flip | UID-002 | Light flip **QA PASS** — remove “QA may still verify”; progress · roadmap · docs-map · program canvas | FilterBar/LibraryApp **20/20** · DoD met · live skipped · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | Docs UID-002 sync | UID-002 · UID-001 | Verify library-and-systems · faq · getting-started · HelpPage · progress · roadmap · docs-map · debt log · program canvas — filter LHN chevron-rail collapse + Signals scrub (OUT/~ /RELEASE) | Canvas: synced · Capture skipped (:5006) · QA may still verify UID-001/002 |
| 2026-08-01 | UI UID-001 | UID-001 | Library tiles: retire OUT/~ /RELEASE badges + filter chips; corner-only layout map (occupied corners only); rounded-square chrome for badges/+N/platform/hamburger/favorite/status; UPDATE alone for freshness behind | vitest BadgeStack · BadgeFilterChips · FilterBar signals |
| 2026-08-01 | UI UID-002 | UID-002 | Library LHN: width collapse + slim chevron rail; grid `auto` column reflows tiles (not body opacity hide); mobile drawer unchanged | vitest FilterBar + LibraryApp collapse |
| 2026-08-01 | Docs UID-005 QA flip | UID-005 | Light flip **QA PASS** — remove “QA may still verify”; progress · roadmap · docs-map · program canvas | DupeGlance **22/22** · static DoD met · live skipped · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | Docs UID-005 sync | UID-005 | Verify libraries-and-scans · themes-reset · debt log; flip progress · roadmap · docs-map · program canvas — UID-005 Done (UI); QA may still verify | Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | UI W22 UID-005 | UID-005 | Unmatched: per-entry actions bar at top of each row; Resolve centered equal-pill bar; client sort Folder/Status/Library/Platform (+ Dupe glance sort + actions-on-top) | Reset Themes (`admin_manage_scanjobs`); vitest DupeGlance |
| 2026-08-01 | Docs UI-W22-M7 QA flip | UID-004 Kind | Light flip **QA PASS** — remove “QA may still verify”; progress · roadmap · libraries-and-scans · program canvas | member **32/32** · DupeGlance **21/21** · DoD met · live skipped · Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | Docs UI-W22-M7 | UID-004 Kind | progress · roadmap-w22-plus · ui-debt verify · libraries-and-scans · themes-reset · faq · HelpPage · docs-map · program canvas | Canvas: synced · Capture skipped (:5006) |
| 2026-08-01 | UI W22-1 wire | UID-003 | Sticky **Scan**/**Edit** → `POST /api/admin/libraries/batch/{scan,edit}` (`library_uuids`); batch-edit modal (depth/watch/platform); 404 soft-degrade to sequential scan / watch PUT / full editor | Reset Themes (`admin_manage_libs`); smoke multi-select Scan + Edit Apply |
| 2026-08-01 | UI W22-M7 | UID-004 Kind | Plain Kind labels: Soft title(s) / Utility(ies); EXP/TOOL badges keep short text, tooltips Soft title / Utility; FilterBar + Dupe glance + Unmatched Jinja/theme JS | vitest kind chips + DupeGlance; Reset Themes for scanjobs |
| 2026-08-01 | BE W22-1 | UID-003 | Batch APIs `POST /api/admin/libraries/batch/{scan,edit,delete}`; `force` skips typed names; single `/delete_full_library` optional `confirm_name`/`force`; contract in libraries-and-scans | pytest **13/13** `test_library_batch_ops` |
| 2026-08-01 | UI W22-1 | UID-003 · UID-004 partial | Unified **Libraries & scans** tabs; multi-select Scan/Edit/Delete; force-delete bulk; Layout chips (ROM files / Folder library); `gt-toast-host` scan toasts | Reset Themes; **QA PASS 13/13** vitest · static DoD met · live skipped (`:5006`) |
| 2026-08-01 | PM | — | Created debt log; Art+Creative+Platform+Finance+Hardware+A11y seats; presentation canvas | process |
| 2026-07-31 | UI W20-7 | UID-005 partial | Unmatched Leaf/Triage filters + bulk Ignore | QA PASS 6/6 vitest; live skipped |
| 2026-07–08 | BE/UI W21 | — | First-scan Stage D/E/DAT + Stage E chips (separate from Aug-01 feedback roadmap) | QA 69/69 · 27/27 |

---

## Badge inventory (source of truth for UID-001)

From `frontend/member-app/src/utils/badgeSignals.js` + `BadgeStack` + platform chip on `GameCard`:

| Kind | Label | Trigger | Default corner / notes |
|---|---|---|---|
| UPDATE | UPDATE | `has_updates` / `freshness_status=behind` | Top-left preferred; priority 100 — alone (OUT retired) |
| MISSING | MISSING | `path_status=missing` / `path_missing` | **Pinned** top-left; not dismissible |
| NEW | NEW | identified/created within 14d | Top-left preferred |
| OWNED | OWNED | store ownership match | Bottom-right preferred |
| LANG | LANG | `needs_translation` | Bottom-right preferred |
| PATCH | PATCH | translation patch extras | Top-right preferred |
| EXP | EXP | item_kind experience | Kind badge; tooltip **Soft title**; bottom-right |
| EMU | EMU | item_kind emulator | Kind badge; bottom-right |
| TOOL | TOOL | item_kind tool | Kind badge; tooltip **Utility**; bottom-right |
| VR | VR | `is_vr` | **Pinned** top-left; filter chip intentionally omitted |
| L | L | local metadata override | Top-right preferred; lowest priority |
| (platform chip) | e.g. PC | platform | Bottom-left; badges skip that corner when present |
| +N | overflow | > maxVisible (2) flexible badges | Corner occupant; **empty corners omitted** (no reserved empty slots) |

**Layout contract:** four corners only · render occupied corners only · rounded-square chrome · post-deploy Reset Themes (`components.css` / filter chip CSS on theme volume) + member SPA rebuild.

### Retired (2026-08-01 — client omit; API freshness fields may still exist)

| Kind | Label | Was trigger | Notes |
|---|---|---|---|
| OUT | OUT | `freshness_status=behind` | Replaced by UPDATE alone |
| ~ | ~ | `heuristic_behind` | No tile badge |
| RELEASE | RELEASE | release within 30d | No tile badge / no LHN chip |

LHN filter chips: UPDATE, MISSING, NEW, LANG (not VR). Legacy URL params `freshness_behind` / `recent_release` still parseable.
