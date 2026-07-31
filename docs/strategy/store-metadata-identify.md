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
| Unmatched list hint | **Denormalized** onto `UnmatchedFolder.suggested_kind` + `suggested_candidate_name` at propose/log time. `GET /api/unmatched_folders` (+ export) returns those plus derived `suggested_kind_label`, `folder_name`, and deterministic `why_unmatched` / `unmatched_reason` (from `match_reason` · score · kind · folder name) — no list N+1 sidecar reads. Legacy null hints: `POST /api/unmatched_folders/backfill_suggested_kind` (idempotent one-shot). |
| Unmatched catalog | `POST /api/unmatched_folders/<id>/mark_kind` → custom `igdb_id` + `item_kind`; clears Unmatched. Admin Unmatched tab + Dupe glance expose **Mark as Experience / Emulator / Tool** (+ Identify as game). Library cards/details show **EXP** / **EMU** / **TOOL**. |
| Parse | Glued trailing VR peels (`3DSenVR` → `3DSen`) + search variant `3DSen VR`. |
| Deny auto-as-game | Converter / metrics / ripper / editor-style labels → `tool` only (capability language; no Class A tokens). |
| Platform stance | Stay on **PCWIN** (+ kind filter). No `APPS`/`TOOLS` platform enum. |

Ownership remains **register-only** for DRM stores. No download/install queues for software or games.

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
