# Store metadata identify · ownership register (beyond IGDB/Steam)

**Date:** 2026-07-29  
**Status:** Strategy lock (Game Master → Backend / UI)  
**Audience:** Backend · UI · Docs · QA  
**Related:** [headset-vr.md](headset-vr.md) · [name-resolution.md](name-resolution.md) · [external-facing-scrub.md](external-facing-scrub.md) · `gametheca/routes_apis/metadata_search.py` · `gametheca/utils/store_ownership.py` · `gametheca/utils/secondary_scrapers.py` · `gametheca/utils/providers/`

> **Locked reminder:** DRM / closed stores = **register-only ownership** + **metadata search**. Never download, install, or queue binaries from stores. No Class A / warez scrapes; no romhacking; no Discord.

---

## Problem

Identify UI today searches **Steam · RAWG · GOG** (`SUPPORTED_SOURCES` in `metadata_search.py`). Artwork providers are IGDB / SteamGridDB / GiantBomb (`providers/`). Ownership sync accepts **steam | gog | epic | amazon** (`VALID_STORES` in `store_ownership.py`) with live Steam only; GOG/Epic = CSV stubs.

**Gap:** Meta Quest Store–exclusive (and similar store-only) titles often miss IGDB/Steam — operators cannot identify or badge them.

---

## Priority order (ship next)

| Pri | Store | Identify / search | Ownership register | Ship when |
|---|---|---|---|---|
| **P0** | **Meta Quest Store** | Yes — name → store id + title + public cover | CSV / manual paste first | This slice |
| **P1** | **itch.io** | Nice (weak public catalog search) | Yes — official OAuth `profile:owned` | After P0 stubs |
| **P1** | **Epic Games Store** | Optional (unofficial store GraphQL only) | CSV already stubbed — keep | Ownership polish; search later |
| **P2** | **Amazon / Prime Gaming** | Low | CSV (already in `VALID_STORES`) | When CSV UX exists |
| **P3** | **SideQuest** | Optional community catalog for sideload titles | N/A (not a DRM ownership source) | After Meta; label as community |
| **Defer** | **PSN · Xbox** | No public third-party catalog API | Manual / Playnite import only | Not live sync in 1.x |

Do **not** prioritize SideQuest over Meta Store for paid Quest exclusives. SideQuest is a sideload/community index, not a substitute for Meta ownership.

---

## API reality (honest)

| Store | Public official API? | Practical path for GameTheca |
|---|---|---|
| **Meta Quest Store** | **No** public Meta Graph “store search” for third-party library apps. Horizon docs cover *developer* discovery UX, not a catalog API we can call. Community reverse-engineered GraphQL (`graph.oculus.com`) exists but is **unofficial**, token/doc_id fragile, ToS-risk. | **Default:** CSV / admin paste of Meta app id + title + cover URL. **Optional later:** unofficial GraphQL behind admin flag + “unsupported” banner — never default-on. Do not vendor Quest Store DB dumps into the product. |
| **itch.io** | **Yes** for *your* library (`api.itch.io`, OAuth `profile:owned`). No first-class public “search all itch games by name” API. | Ownership: OAuth register-only. Identify: defer HTML/RSS scrape or skip until a stable public search exists. |
| **Epic** | **No** documented public catalog API. Store uses internal GraphQL. | Keep CSV ownership. Identify search = unofficial only → same caution as Meta. |
| **Steam / GOG** | Public-enough store search already used | Keep as primary identify sources. |
| **PSN / Xbox** | No usable public catalog/ownership API for self-hosted apps | Register via Playnite CSV / manual only. No live sync claims. |
| **SideQuest** | Community / unofficial | Identify-only helper; never ownership source of truth for Meta purchases. |

Artwork providers (`providers/`) stay cover-focused — do **not** conflate with identify search stubs.

---

## Platform enum · VR mapping

| Concept | Today | Recommendation |
|---|---|---|
| `LibraryPlatform` | No Quest / Meta / Android / VR leaf (`platform.py`) | **Do not** add `QUEST` / `META` for this slice. Leaf libs stay PC / OTHER / console as today. |
| VR signal | `is_vr` from IGDB `Virtual Reality` perspective **or** Steam categories (`steamvr`, `vr only`, …) in `secondary_scrapers.py` | Keep VR as a **flag / perspective**, not a platform enum. Meta hit → ensure `Virtual Reality` perspective on the game so `/vr` + `is_vr` filters work. |
| SteamVR vs Quest | SteamVR = PC VR via Steam (PSVR2/Index/…). Quest Store = standalone Meta titles (friend seat per [headset-vr.md](headset-vr.md)) | Same `is_vr=true`; distinguish via **store external id** / `GameURL` type, not by inventing a fake Steam app id. |
| Disk libraries | Quest APK / sideload trees (if any) | `LibraryPlatform.OTHER` until a dedicated ANDROID leaf is justified; scan honesty per [android-apk-vr.md](android-apk-vr.md). |

---

## No IGDB match · Meta/Quest hit exists

Reuse existing **custom game** path (`igdb_id >= 2000000420` in `routes_games_ext/add.py`) — do not invent a fake real IGDB id.

| Step | Behavior |
|---|---|
| 1 | Admin identify: search Meta (or paste id) when IGDB/Steam/GOG miss |
| 2 | Create/update Game as **custom** (`igdb_id` in custom range) with Meta title + summary if available |
| 3 | Persist store link: prefer new nullable `meta_app_id` (string) **or** `GameURL(url_type='meta_quest'|similar)` until schema settles — mirror how `steam_app_id` works for Steam |
| 4 | Cover: store public CDN/cover URL if present; else default cover |
| 5 | Set player perspective **Virtual Reality** so `game_card_flags` → `is_vr: true` |
| 6 | Ownership: `UserOwnedTitle(store='meta'|`quest`, external_app_id=…)` matches library via store id when column exists; else unique normalized name (same GOG/Epic pattern) |
| 7 | Name-resolution ([name-resolution.md](name-resolution.md)): Stage B-style “prefer store title when store id present” once Meta id is on the folder/game |

Never auto-force an IGDB collision. Ambiguous name matches → proposal queue / manual link.

---

## Gaming software / emulators / tools (non-Main-Game)

IGDB `/games` has **no** separate “apps” catalog that covers household VR emulators and utilities. Steam **does** return `type=software` (and related) on storesearch.

| Concept | Behavior |
|---|---|
| `item_kind` on `Game` | `game` \| `experience` \| `emulator` \| `tool` (default `game`). Orthogonal to `LibraryPlatform` and IGDB `Category`. JSON also aliases as `content_kind`. |
| Browse filter | `GET /browse_games?item_kind=` (comma list or repeated; alias `content_kind=`) — omit = all kinds. Same param on `GET /api/favorites`. Library SPA **Kind** chips (Games · Experiences · Emulators · Tools) in FilterBar multi-select that param (UI vitest 13). |
| Steam identify | `search_steam_games(..., include_software=True)` tags `steam_type` + `item_kind`. Never auto-import software as IGDB Main Game. |
| IGDB miss | Proposal sidecar gains `software_candidates` + `suggested_kind` (`enrich_proposal_with_software`). |
| Unmatched list hint | **Denormalized** onto `UnmatchedFolder.suggested_kind` + `suggested_candidate_name` (+ W21-BE-2b: `stage_e_candidates` / `stage_e` JSON) at propose/log time. `GET /api/unmatched_folders` (+ export JSON) returns those plus derived `suggested_kind_label`, `folder_name`, and deterministic `why_unmatched` / `unmatched_reason` — no list N+1 sidecar reads; Stage E keys soft-omitted when absent. Legacy null hints: `POST /api/unmatched_folders/backfill_suggested_kind` (idempotent one-shot). |
| Unmatched catalog | `POST /api/unmatched_folders/<id>/mark_kind` → custom `igdb_id` + `item_kind`; clears Unmatched. Admin Unmatched tab + Dupe glance expose **Mark as Experience / Emulator / Tool** (+ Identify as game). Library cards/details show **EXP** / **EMU** / **TOOL**. |
| Parse | Glued trailing VR peels (`3DSenVR` → `3DSen`) + search variant `3DSen VR`. |
| Deny auto-as-game | Converter / metrics / ripper / editor-style labels → `tool` only (capability language; no Class A tokens). |
| Platform stance | Stay on **PCWIN** (+ kind filter). No `APPS`/`TOOLS` platform enum. |

Ownership remains **register-only** for DRM stores. No download/install queues for software or games.

---

## Manual match enrichment parity (W20-3) — Done (uncommitted)

Scan identify and manual Identify/apply attach the same taxonomy depth.

| Path | Behavior |
|---|---|
| **Scan identify** | `attach_igdb_taxonomy_to_game` upserts Genre / Theme / GameMode / Platform / PlayerPerspective via `get_or_create_entity`, then optional Steam enrich |
| **Manual Identify apply** (`add_game_manual` / `game_edit`) | Form checkboxes still apply; **server then re-fetches IGDB by id** and upserts missing taxonomy so names absent from the checkbox list are **not** silently dropped |
| **Steam enrich** (`enrich_game_with_steam`) | Summary (if empty) · VR/perspectives · **genres** · GameMode rows mapped from Steam categories (Single-player → Single player, etc.) |
| **Not modeled** | Steam freeform tags/keywords (no Game column); Steam category strings are **not** written to IGDB `Category` enum |

No DRM download queues. Custom-range IGDB ids (`≥ 2000000420`) skip the IGDB taxonomy re-fetch.

**Tests:** `tests/test_w20_manual_match_enrichment.py` · Steam genre assertions in `tests/test_utils_secondary_scrapers.py`.

---

## Stage D — IGDB miss → Steam/GOG custom (W20-5a) — Done (uncommitted)

**Upstream (W21-BE-3):** before Stage D, IGDB scoring recovers easy cleaned titles — remaster primary-head peel, sequel asymmetry cap, stylized `Nx` compact variants — without lowering default `match_high_threshold` **0.92**. See [name-resolution.md](name-resolution.md#w21-be-3--easy-cleaned-title-igdb-misses-scoring-edges). Stage D App-ID corroboration unchanged.

After Stage A–C + IGDB high-confidence miss, scan identify may resolve from **existing** Class D store search before logging Unmatched. No new scrapers.

| Gate | Behavior |
|---|---|
| **Skip** | C11 bare franchise · `propose_only_scan` — stay proposal / Unmatched |
| **Steam App ID** | Folder `(digits)` extracted → `fetch_steam_app_details` **must succeed** + **title corroboration** (casefold exact or primary-title prefix before ` - `/`: ` remaster/subtitle) → custom `igdb_id ≥ 2000000420` with `steam_app_id` + title/summary/cover; `item_kind` from `steam_type` when software |
| **Wrong-namespace digits** | Steam details miss **or** title mismatch → **do not** stamp `steam_app_id`; fall through to exact-title Steam/GOG (W21-BE harden) |
| **Steam exact title** | Else `search_steam_games` — **one** casefold-exact title hit only → same custom path |
| **GOG exact title** | Else `search_gog_games` — one casefold-exact hit → custom Game + `GameURL(url_type=gog)` store page (register-only) |
| **Ambiguous** | Multiple exact titles (or no exact) → **no** auto-import; software proposal + Unmatched as today |
| **Forbidden** | Fuzzy multi-hit auto-import · install/download/magnet URL fields · Epic/itch/Meta cascade (later tickets) · TheGamesDB/MobyGames in Stage D auto-cascade (manual-only until score gates proven) |

**Code:** `resolve_stage_d_store_candidate` / `try_stage_d_store_identify` in `software_identify.py` · hooked from `retrieve_and_save_game` IGDB-miss branch.

**Tests:** `tests/test_w20_stage_d_store_cascade.py` (mocked HTTP — no live store calls).

### W21 note — unmatched `(digits)` sample (PC)

Export `unmatched_folders_all.json` PC trailing `(4–7)` folders (~71) peel via A5 as `steam_app_id`, but sampled digits (**77125**, **19090**, **86630**, …) fail Steam `appdetails` and do **not** match folder titles as IGDB ids (wrong catalog namespace — not Steam / not title-matching IGDB / not GOG). Pre-Stage-D scan rows stay Unmatched with `why=Could not auto-match to IGDB`. Re-scan only after App-ID verify gate above (else old “details-miss still import” would poison `steam_app_id`).

---

## Stage E — Moby / TheGamesDB after Stage D (propose-only) — Done (uncommitted, W21-BE-2)

**Status:** Propose-only first-scan fallback **landed** — **no** `Game` create from Moby/TGDB in W21. Manual Identify chips remain the apply path. Auto-import only after score gates + admin opt-in (later ticket).

| Gate | Behavior |
|---|---|
| **When** | After Stage D miss/ambiguous on IGDB-miss path (alongside software proposal → Unmatched) |
| **PC** | Exact-title (casefold) **MobyGames** → `stage_e_candidates` on `gametheca.proposal.json` + denormalize `suggested_candidate_name` + `stage_e_candidates` / `stage_e` onto `UnmatchedFolder` (list/export); **never** create Game |
| **Console** | Exact-title **TheGamesDB** with **platform filter** (library leaf ↔ TGDB platform names/aliases) → same propose-only sidecar; multi-hit / no platform corroboration → no preferred name |
| **Keys** | `MOBYGAMES_API_KEY` / `THEGAMESDB_API_KEY` (or GlobalSettings) — unset → skip that source silently (`skipped[]` in proposal `stage_e`) |
| **DAT hash short-circuit** | **Done (uncommitted, W21-BE-DAT)** — after Stage D miss on console leaves: hash ROM → unique DAT CRC/MD5/SHA1 across reference sets for that platform → custom-range Game with DAT title + honest summary provenance; ambiguous / missing DAT / unhashable / PC / C11 / `propose_only_scan` → leave Unmatched (Stage E may still propose TGDB) |
| **Forbidden** | Fuzzy multi-hit auto-import · Moby/TGDB Game create · pirate scrapers · romhacking · DRM queues · Meta GraphQL / Epic/itch cascade |

**Code:** `resolve_stage_e_catalog_hints` / `enrich_proposal_with_stage_e` in `software_identify.py` · DAT unique-hash auto via `lookup_unique_dat_hash_hit` / `try_dat_hash_identify` in `set_completion.py` (hooked from `retrieve_and_save_game` after Stage D, before Stage E) · `hint_fields_from_proposal` reads `stage_e_candidates`.

**Proposal JSON:** `proposal.stage_e_candidates[]` (`source`, `id`, `name`, `url`, `cover_url`, `match_mode`, `propose_only: true`) · `proposal.stage_e` (`match_reason`, `skipped`, `propose_only`). **List/export (W21-BE-2b):** same fields denormalized onto `UnmatchedFolder` JSON columns — soft-omitted when absent.

**Tests:** `tests/test_w21_stage_e_propose.py` (mocked HTTP) + `tests/test_w21_dat_hash_identify.py` (unique/ambiguous/missing DAT + propose_only skip) + Stage D regression `tests/test_w20_stage_d_store_cascade.py`.

---

## W20-5b — MobyGames manual search (Done, uncommitted)

Class D catalog source for **manual** identify + **Stage E propose-only** exact-title hints after Stage D miss (W21-BE-2). Not Stage D auto-import; never creates Game from Moby in W21.

| Gate | Behavior |
|---|---|
| **Source chip** | `GET /api/search_metadata?source=mobygames` (alias `moby`) |
| **API** | `https://api.mobygames.com/v1/games?title=…&format=normal` via `search_mobygames_games` |
| **Key** | Optional `MOBYGAMES_API_KEY` env **or** `GlobalSettings.mobygames_api_key` — unset → **empty results** + `needs_key` / `key_configured: false` note (no 500) |
| **Hit shape** | `{ source, id, name, url, cover_url, summary, mobygames_id, moby_score?, platforms? }` — no download/install fields |
| **Apply path** | Operator selects hit → existing custom / enrich path (custom `igdb_id ≥ 2000000420` + `GameURL` as appropriate) |
| **Out** | No Stage D auto-import · no pirate scrapers · no DRM queues |

**Code:** `gametheca/utils/providers/mobygames.py` · `search_mobygames_games` in `secondary_scrapers.py` · `metadata_search.py` · `updateschema` column `mobygames_api_key`.

**Tests:** claimed **27/27** (mocked HTTP — no live MobyGames calls) including Stage D regression (cascade still Steam/GOG-only; MobyGames not auto-imported). BE [0e5c9db1](0e5c9db1-bbaf-4566-bdd6-6736924b4ef1).

**Env:** `.env.example` → `MOBYGAMES_API_KEY=` · key signup: https://www.mobygames.com/info/api/

**Ops:** app restart for `mobygames_api_key` column · set `MOBYGAMES_API_KEY` (or Admin key) for live hits · **UI Identify chip Done** — ArtworkPicker + Jinja Search MobyGames · vitest **3/3** claimed (UI [cb422066](cb422066-9428-4fe4-9a0a-02a15d463476)).

---

## W20-5c — TheGamesDB manual search (Done, uncommitted)

Class D catalog source for **manual** console-leaf identify / covers + **Stage E propose-only** platform-filtered exact-title hints (W21-BE-2). Not Stage D auto-import; never creates Game from TGDB in W21.

| Gate | Behavior |
|---|---|
| **Source chip** | `GET /api/search_metadata?source=thegamesdb` (alias `tgdb`) |
| **API** | `https://api.thegamesdb.net/v1.1/Games/ByGameName?name=…&include=boxart,platform` via `search_thegamesdb_games` |
| **Key** | Optional `THEGAMESDB_API_KEY` env **or** `GlobalSettings.thegamesdb_api_key` — unset → **empty results** + `needs_key` / `key_configured: false` note (no 500) |
| **Hit shape** | `{ source, id, name, url, cover_url, summary?, thegamesdb_id, release_date?, platforms? }` — no download/install fields |
| **Apply path** | Operator selects hit → existing custom / enrich path (custom `igdb_id ≥ 2000000420` + `GameURL` as appropriate) |
| **Out** | No Stage D auto-import · no pirate scrapers · no DRM queues · no romhacking |

**Code:** `gametheca/utils/providers/thegamesdb.py` · `search_thegamesdb_games` in `secondary_scrapers.py` · `metadata_search.py` · `updateschema` column `thegamesdb_api_key`.

**UI:** ArtworkPicker Identify chip (`thegamesdb` in `IDENTIFY_CHIP_IDS`) · Jinja **Search TheGamesDB** · `admin_game_identify.js` sends canonical `source=thegamesdb` · soft honesty via API `note` / `needs_key` / `· key` chip.

**Tests:** pytest claimed **31/31** (mocked HTTP; Stage D Steam/GOG-only) · BE [5cccddb6](5cccddb6-2b9b-40c9-8cd8-05111a5a6c71) · admin vitest ArtworkPicker **4/4** (incl. TheGamesDB soft-honesty) · UI [5d558888](5d558888-febc-4c1b-bf9f-07610fff342d).

**Env:** `.env.example` → `THEGAMESDB_API_KEY=` · key signup: https://thegamesdb.net/api/register.php

**Ops:** app restart for `thegamesdb_api_key` column · set `THEGAMESDB_API_KEY` (or Admin key) for live hits · **UI Identify chip Done** · **Reset Themes** for identify JS · hard-refresh admin SPA.

---

## Acceptance criteria — Backend provider stubs

Extend identify search (same shape as `search_steam_games` / `search_gog_games`):

```text
{ source, id, name, url, cover_url, summary? , <store>_id }
```

| # | Criterion |
|---|---|
| AC1 | `GET /search_metadata?name=&source=meta` (or `quest`) returns ≤20 hits: **store id + title + cover_url** when the chosen backend can supply them; empty list on miss/error (no 500 for “not found”) |
| AC2 | Stub documents API mode: `csv_only` \| `unofficial_graphql` \| `disabled` — default **csv_only / disabled** until product flips a flag |
| AC3 | No download URLs, binary CDNs for install, or “Add to install queue” fields in the payload |
| AC4 | `VALID_STORES` gains `meta` (or `quest`) for CSV import; `import_store_csv` accepts `external_id,name` like GOG/Epic |
| AC5 | Matching: if `Game.meta_app_id` (or agreed field) exists → exact match; else unique normalized name; never multi-match auto-link |
| AC6 | Selecting a Meta hit in identify UI can create a **custom** game with VR perspective + store URL without requiring IGDB |
| AC7 | Unit tests: mock HTTP / CSV rows; no live Meta calls in CI |
| AC8 | Scrub: no Class A brand names; UI copy says “Meta Quest Store” / “ownership register only” |

UI (handoff): source chip on identify; show “IGDB miss — store hit” path; ownership settings list Meta beside Steam/GOG/Epic.

---

## Explicit non-goals

- Meta / SteamVR / SideQuest **store client** listing for GameTheca  
- DRM download / sideload install queues from any store  
- Bundling third-party Quest catalog dumps  
- Live PSN / Xbox ownership sync  
- Discord / webhooks  
- Changing `/vr` product stance (Quest remains friend seat; SteamVR primary for PC VR owners)
