# Folder → IGDB name-resolution rules

**Audience:** Backend (scan / `game_name_parse` / `gamenames` / `match_scoring` / identify) · Ops/Docs (scan depth)  
**Date:** 2026-07-29 · **Owner:** Game Master (rules) → Backend (**Done** A0–A14) → Ops (rescan after ship)  
**Status:** Stage A0–A14 + C10–C11 **Done** in `parse_game_label` / `generate_goty_variants` / identify (code landed; uncommitted until human ships) · **QA 166 PASS** (parse/gamenames/scoring) · next Ops = **documented** Library A PCWIN propose-only → full rescan `scan_depth=2` (live rescan waits human ship)  
**Related:** [libraries-and-scans.md](../admin/libraries-and-scans.md) · design `docs/superpowers/specs/2026-07-22-game-recognition-and-rename-design.md`

## Gap (evidence) — historical pre-A9; A9–A14 now shipped

Household PC tree `…/_pc/_a…_z` (Library A, **PCWIN**) still yields large **Unmatched** batches after A0–A8. Representative noise on disk (A9–A14 **Done** closes the bold Gap rows below; remaining Unmatched after ship → Ops rescan + Stage B/score triage):

| Pattern class | Disk examples (shape) | After A0–A14? |
|---|---|---|
| Scene/repack bracket tags | `[… Repack]`, `[… HV Repack]` | Covered (A1) |
| Steam App ID in trailing parens | `Title (81735)`, lowercase `title (88323)` | Peel OK (A5); unmatched → Stage B / score (see below) |
| VR suffixes / mod tails | `… VR`, `… VR MOD - … 0 8 1` | Covered when `VR` is **final** token |
| **VR then version** | `… VR v1 2`, `… VR v0.8.1` | **Shipped** A14 (VR re-pass after A6) |
| Version / build junk | `v0 4`, `v1 188`, `(build 18 05 2023)`, `Early Access` | Covered (A3/A6) when shapes match |
| **Incl Update parentheticals** | `Title (Incl Update 3)`, `… (Incl Update)` | **Shipped** A9 |
| **Unbracketed scene/repack suffixes** | `Title - GROUP`, `Title GROUP` (hyphen or space before group token) | **Shipped** A10 |
| **Date-stamp / compact V tails** | `… 2022093001`, `… V21 02 2023`, `… V16092671` | **Shipped** A11 (+ A6 multi-seg) |
| **Update / Build prose + ranges** | `… Update vX`, `… update 1.24.01 - 1.25.01`, `… Build 123` (non-paren) | **Shipped** A12 |
| **Edition / add-on noise** | Complete / Collector / Legendary / bare `HV` / `4K Videos Add-on` | **Shipped** A13 + C10 |
| Missing apostrophe | `Assassins Creed Rogue` | Covered (A8 inject) |
| Trailing years | `Alone in the Dark 2024` / `… 2008` | Covered (C6 variant) |
| Collections / remakes / packs | `Alan Wake Complete Collection`, DLC packs | Covered (C7) |
| **Tools / non-games** | OpenVR Metrics, converters, editors | **Not a peel** — skip-dir / ignore · or `item_kind` Mark as Tool |
| **Bare franchise heads** | `Final Fantasy`, `Battletoads`, `Keeper` | **Manual** — C11 propose-only; do not auto-pick a sequel |

**Root cause (taxonomy, historical):** Identify (`game_core`) builds search variants from **`parse_game_label` only**. Spaced version tails, `Early Access`, and pack/collection strip that lived only in `clean_game_name` never reached IGDB until A0–A8 unified the path. Franchise colon heads required an apostrophe (`assassin's creed`) until A8 inject. **Post-A8 residue** (Incl Update, unbracketed scene/repack, date-stamps, Update/Build prose, edition/add-on, `Title VR v…`) is **shipped** as A9–A14 + C10/C11 (QA **166** PASS).

Prior miss (still covered): `Baldur's Gate Dark Alliance 1` → `Baldur's Gate: Dark Alliance`.

---

## Ops prerequisite — `scan_depth`

| Library root shape | Required `scan_depth` | Why |
|---|---|---|
| `…/_pc` with children `_a`…`_z`, `_#` | **2** | Depth 1 treats buckets as “games”; depth 2 unwraps buckets → real titles |
| Flat roots (`E:\_software-games`, `E:\games`) | **1** | Immediate children *are* games |

Documented for operators in [libraries-and-scans.md](../admin/libraries-and-scans.md) (including [After A0–A8 PCWIN rescan](../admin/libraries-and-scans.md#after-a0a8-ship--library-a-pcwin-rescan)). Wrong depth = thousands of false “games.”

---

## Ordered pipeline (Backend)

Run once per folder label. Deduplicate case-insensitively; **stop early** on high-confidence match (existing scorer). Cap ~8–12 unique queries.

**Hard rule:** Stages **A0–A14** must all execute inside `parse_game_label` (or a single helper it owns). Identify must not depend on `clean_game_name` for strip quality. Alias token lists for scene/repack tags stay **in code only** — public docs say “scene/repack tags.”

### Stage A — PC folder cleanup (before variants)

| # | Rule | Notes |
|---|---|---|
| **A0** | Trim; basename only | No path segments |
| **A1** | Strip scene/repack **bracket** tags | Extend `strip_repack_tags`; aliases in code, not docs |
| **A2** | Strip bracketed multi-part version junk | `[1 0 4 1]`, `[1.0.4.1]` — existing `strip_version_brackets` |
| **A3** | Strip trailing `(build …)` parenthetical | Spaced or dotted dates OK; **not** a Steam App ID |
| **A4** | Strip VR / mod tails | Order: `VR MOD…` → vendor-mod tails → bare trailing `VR` |
| **A5** | Extract trailing `(digits)` → `steam_app_id` | 4–7 digits only; strip from title. Prefer Steam store title as variant #0 (Stage B) |
| **A6** | Strip trailing version / access junk | Spaced or dotted: `\bv\d+(?:[.\s_]\d+)+\b` tails (+ optional letter e.g. `v1.1.0a`); bare `Early Access` / `EA` as **trailing** tokens only. Do **not** strip mid-title `v` letters (`Avowed`) |
| **A7** | Normalize whitespace / casing | `_`→space; collapse spaces; title-case all-lowercase dumps; preserve intentional ALLCAPS tokens with digits |
| **A8** | Apostrophe / smart-quote normalize | Map `’` `‘` `ʼ` `´` → ASCII `'`. Keep one **de-apostrophized** copy later (Stage C). Add **franchise apostrophe inject** for known heads missing `'` (e.g. `Assassins Creed …` → `Assassin's Creed …`) as a search variant (prefer inject before colon-head match) |

Tiny stylized aliases (`ADR1FT`→`Adrift`) may live in `_ALIAS_MAP` after A7.

### Stage A9+ — Post-A8 peel gaps (**Done** 2026-07-29)

Ordered for Backend. All run inside `parse_game_label` (or its owned helper). **Do not** expand Class A brand catalogs in public docs — say “scene/repack tags”; keep alias lists in code only.

| # | Rule | Shape (examples) | Easy IGDB after peel? |
|---|---|---|---|
| **A9** | Strip `(Incl Update…)` / `Incl Update` parentheticals | `Pathologic 2 (Incl Update 3)`, `Dragon's Dogma Dark Arisen (Incl Update)` | **Yes** — title core is clear |
| **A10** | Strip trailing **unbracketed** scene/repack suffixes | Hyphen or space before a known group token (`Title - GROUP`, `Title GROUP`). Aliases in code only | **Yes** when ≥2 head tokens remain; else review |
| **A11** | Strip date-stamp / compact version tails | Bare `YYYYMMDD` / `YYYYMMDDnn` (`2022093001`); single-block `V`+digits (`V16092671`); keep multi-seg `V21 02 2023` covered via A6 or explicit | **Yes** |
| **A12** | Strip Update / Build **prose** tails + version ranges | `Update vX`, `update 1.24.01 - 1.25.01`, bare trailing `Build N` (non-paren; A3 already covers `(build …)`) | **Yes** |
| **A13** | Strip / peel edition & add-on noise (display clean + search variants) | Trailing `Complete` / `Collector` / `Collector's` / `Legendary` / bare `HV` / `4K Videos Add-on` / similar add-on phrases — **keep** Remastered/Remake/Edition for disambiguation unless pure junk | **Yes** for add-on/HV junk; edition peels → Stage C10 (keep full + peeled) |
| **A14** | Re-apply trailing VR after version strip | Fixes `Title VR v1 2` → A6 leaves `Title VR` → A4 never re-runs. Implement as **A4 second pass after A6** (or extend A4 to `VR` + optional following `v…`) | **Yes** — `Title` |

**Pipeline order (shipped):** A0→A1→A2→A3→A4→A5→A6→**A14 (VR re-pass)**→A9→A10→A11→A12→A13→A7→A8.  
A9–A13 may run before A7 as long as Steam ID extract (A5) still sees a trailing `(digits)` when present. If junk trails the Steam paren, strip A9/A10/A11/A12 **before** A5 on a second design pass — prefer making A5 match `(digits)` not only at end-of-string when followed only by peelable junk.

### Stage B — Prefer Steam title when App ID present

| # | Rule |
|---|---|
| B1 | If `steam_app_id` resolves via Steam store → **prepend** that exact title as variant #0 |
| B2 | Still generate folder-derived variants; score with `steam_title` bump (`match_scoring`) |
| B3 | Low confidence → proposal queue (never blind auto-import) |

#### Steam `(digits)` still Unmatched — diagnose before more peel

| Observation | Likely cause | Action |
|---|---|---|
| `steam_app_id` **not** extracted | Digits not trailing / not 4–7 / junk after paren | Peel order (A9–A12 before A5, or A5 allow peelable suffix) |
| ID extracted; Steam title **null** | Store lookup fail / removed app / rate limit | Soft-fail; rely on folder variants; do not invent title |
| Steam title present; still Unmatched | IGDB search/score gap, not peel | Stage C / scorer — **not** a new A-strip |
| ID looks like build, not App ID | 4–7 digits that are builds mid-name | Keep A5 **trailing-only**; A3/A12 for Build prose |

### Stage C — Ordered search variants

Given cleaned tokens from Stage A:

| Priority | Variant kind | Rule | Example |
|---|---|---|---|
| 0 | Steam title | B1 when present | `Abandon Ship` from App ID |
| 1 | Cleaned as-is | After A0–A14 | `Assassin's Creed Rogue` (post-inject) |
| 2 | Franchise / known subtitle colon | Known subtitle phrase or franchise head + tail | `Assassin's Creed: Rogue` |
| 3 | Drop trailing bare `1` | Last token bare arabic `1`, ≥3 tokens precede | BGDA1 family |
| 4 | Sequel digit ↔ Roman | Trailing `2`↔`II`, `3`↔`III`, `4`↔`IV` | |
| 5 | Heuristic colon (≥4 tokens) | Fallback only; **never** for 3-token titles | |
| 6 | Drop trailing year | Standalone `(19\|20)\d{2}` as **extra** variant; keep year form too | `Alone in the Dark` + `… 2024` |
| 7 | Pack / collection peel | If tail matches edition/collection tokens (`Complete Collection`, `Collection`, `DLC Pack`, `Pack` after ≥2 head tokens) → add peeled head as variant; **keep** full string first for exact IGDB pack titles | `Alan Wake` + `Alan Wake Complete Collection` |
| 8 | De-apostrophized | Remove `'` for one query | `Assassins Creed: Rogue` |
| 9 | Hyphen ↔ space / GOTY | Existing `generate_goty_variants` | |
| **10** | Edition peel (post-A13) | Keep full; add head without trailing Complete/Collector/Legendary when ≥2 head tokens | `Title Collector's Edition` → + `Title` |
| **11** | Do **not** auto-variant bare franchise-only labels | Single-token or known ambiguous franchise heads with no subtitle → leave for Fix search / propose | `Final Fantasy`, `Battletoads`, `Keeper` |

**Do not** make heuristic colon (row 5), pack peel (row 7), or edition peel (row 10) the sole auto-import path — require existing high-confidence score + gap.

### Easy vs skip / manual (post-A8 residue)

| Bucket | Examples (shape) | Disposition |
|---|---|---|
| **Easy after peel** | Incl Update parens; unbracketed scene/repack suffix; date-stamps; Update/Build prose; `Title VR v…`; HV / 4K add-on tails; Collector/Complete/Legendary noise with a real head | **Shipped** A9–A14 + C10 |
| **Steam ID triage** | Trailing `(digits)` still Unmatched | Diagnose B1 vs peel order (table above) — not a blind new strip |
| **Skip-dir / ignore** | OpenVR Metrics, converters, editors, installer/tool folders in the PC tree | Admin `dir:` globs or small PCWIN tool denylist — **do not** force IGDB match |
| **Manual / propose only** | Bare `Final Fantasy`, `Battletoads`, `Keeper`, other franchise-only or 1-token ambiguous names | Fix search / proposal queue; **no** auto-pick of a numbered sequel |

### Known subtitle / franchise seeds (code, not UI copy)

Insert `: ` before contiguous phrases (non-exhaustive):  
`Dark Alliance`, `Enhanced Edition`, `Definitive Edition`, `Complete Edition`, `Game of the Year`, `GOTY`, `Remastered`, `Remake`, `Director's Cut`, `Royal Edition`, …

Franchise colon heads (require ≥1 token after head; **match after A8 inject**):  
`Assassin's Creed`, `Baldur's Gate`, `Grand Theft Auto`, `The Elder Scrolls`, `Far Cry`, `Call of Duty`

Hyphen subtitle heads (existing): `Agatha Christie`.

### Sequel `1` / year / pack caution

- Drop bare trailing `1` / year / pack tail as **search variants**, not as the only cleaned display name written to disk.
- Do **not** drop years mid-title or when the year *is* the identity (`Anno 1800` keeps `1800` — only strip `(19|20)xx` as trailing 4-digit year).
- Nearby series siblings → scorer gap; ambiguous → review queue.
- Remastered / Remake / Edition tokens: **keep** for disambiguation unless they are pure junk (`Repack`, `Proper`).

---

## Acceptance fixtures (folder → clean query)

Backend unit tests (no DB): `parse_game_label` → `cleaned_name` + optional `steam_app_id`; then `generate_goty_variants` must include the **expected clean query**. Scene/repack aliases in fixtures may use generic `[Repack]` / `[HV Repack]` in public docs; code tests may use household tag strings.

| # | Folder basename | `cleaned_name` (Stage A) | `steam_app_id` | Expected clean query (must appear in variants) |
|---|---|---|---|---|
| 1 | `Abyssus [Repack]` | `Abyssus` | — | `Abyssus` |
| 2 | `Assassin's Creed Odyssey [HV Repack]` | `Assassin's Creed Odyssey` | — | `Assassin's Creed: Odyssey` |
| 3 | `Assassins Creed Rogue` | `Assassins Creed Rogue` *(or injected)* | — | `Assassin's Creed: Rogue` |
| 4 | `Abandon Ship (81735)` | `Abandon Ship` | `81735` | Steam title #0 + `Abandon Ship` |
| 5 | `angeline era (88323)` | `Angeline Era` | `88323` | Steam title #0 + `Angeline Era` |
| 6 | `A Fishermans Tale VR` | `A Fishermans Tale` | — | `A Fishermans Tale` *(no colon)* |
| 7 | `Alien Isolation VR MOD - MotherVR 0 8 1` | `Alien Isolation` | — | `Alien Isolation` |
| 8 | `Some Game v0 4` | `Some Game` | — | `Some Game` |
| 9 | `Some Game v1 188` | `Some Game` | — | `Some Game` |
| 10 | `ADR1FT (build 18 05 2023)` | `Adrift` | — | `Adrift` |
| 11 | `Title Early Access` | `Title` | — | `Title` |
| 12 | `Alone in the Dark 2024` | `Alone In The Dark 2024` | — | `Alone In The Dark 2024` **and** `Alone In The Dark` |
| 13 | `Alone in the Dark 2008` | `Alone In The Dark 2008` | — | year-kept + year-dropped |
| 14 | `Alan Wake Complete Collection` | `Alan Wake Complete Collection` | — | full string **and** `Alan Wake` |
| 15 | `Baldur's Gate Dark Alliance 1` | `Baldur's Gate Dark Alliance 1` | — | `Baldur's Gate: Dark Alliance` |
| 16 | `agatha christie death on the nile (85933)` | `Agatha Christie Death On The Nile` | `85933` | Steam #0; hyphen form OK |
| 17 | `barony (89881)` | `Barony` | `89881` | Steam #0 + `Barony` |

### A9+ fixtures (shipped)

| # | Folder basename (shape) | `cleaned_name` | Expected clean query |
|---|---|---|---|
| 18 | `Pathologic 2 (Incl Update 3)` | `Pathologic 2` | `Pathologic 2` |
| 19 | `Dragon's Dogma Dark Arisen (Incl Update)` | `Dragon's Dogma Dark Arisen` | `Dragon's Dogma: Dark Arisen` *(subtitle colon if seeded)* |
| 20 | `Some Game - GROUP` *(generic scene/repack suffix)* | `Some Game` | `Some Game` |
| 20b | `BeachHead-<scene>` *(hyphen-glued; single-token head OK; aliases in code only)* | `BeachHead` | `BeachHead` |
| 21 | `Some Game 2022093001` / `Alfred Hitchcock Vertigo 2022093001` | date-stamp peeled | clean title |
| 22 | `Some Game V16092671` | `Some Game` | `Some Game` |
| 23 | `Some Game Update v1.2` | `Some Game` | `Some Game` |
| 24 | `Some Game update 1.24.01 - 1.25.01` | `Some Game` | `Some Game` |
| 25 | `Some Game Build 18` | `Some Game` | `Some Game` |
| 26 | `Some Game VR v0 8 1` / `All In One Summer Sports VR v0 4` | VR+version peeled | clean title *(A14)* |
| 27 | `Some Game 4K Videos Add-on` | `Some Game` | `Some Game` |
| 28 | `Some Game Collector's Edition` | full **and** peeled | `Some Game Collector's Edition` + `Some Game` |
| 29 | `Final Fantasy` | `Final Fantasy` | **no auto-import** — propose / manual (C11) |
| 30 | `OpenVR Metrics` | *(skip-dir)* | **do not match** — Ops `dir:` / tool denylist (not IGDB force-match) |
| 31 | `3 Minutes to Midnight v1.1.0a` / `ATOM RPG v1 188` | version peeled | clean title |
| 32 | `49 keys (87117)` / `63 days (88642)` / `1000x Resist (77125)` | title + steam id | Steam #0 + cleaned |
| 33 | `Baldur's Gate 1 Enhanced Edition (68994)` / `Baldur's Gate 2` | EE kept + id / Gate 2 kept | colon / Roman variants |

Optional pack/DLC: `Title DLC Pack` → keep full + peel to `Title` (same rules as row 14).

---

## Example — BGDA1 variant list (ordered, deduped)

Folder: `…/_pc/_b/Baldur's Gate Dark Alliance 1`

1. `Baldur's Gate Dark Alliance 1`
2. `Baldur's Gate: Dark Alliance 1` *(known subtitle)*
3. `Baldur's Gate Dark Alliance` *(drop trailing 1)*
4. `Baldur's Gate: Dark Alliance` *(subtitle + drop 1)* ← expected IGDB hit
5. `Baldurs Gate: Dark Alliance` *(de-apostrophe)*

Canonical target: **Baldur's Gate: Dark Alliance**. Must not auto-pick BG3 / BG1 EE / Dark Alliance 2 without failing the score gap.

---

## Backend DoD

### Still true (prior slice)

- [x] `generate_goty_variants` covers Stage C core for BGDA1
- [x] Trailing `(digits)` → Steam title preferred as variant #0 when lookup succeeds
- [x] Apostrophe / smart-quote normalization + one de-apostrophized variant
- [x] Known-subtitle colon before blind ≥4-token heuristic; heuristic never sole auto-import
- [x] Drop bare trailing `1`; bidirectional `2`↔`II`, `3`↔`III` variants
- [x] Ops docs state `scan_depth=2` for letter-bucket `_pc`

### Done — PC folder cleanup wave (2026-07-29)

- [x] **Unify Stage A0–A8 in `parse_game_label`** so identify does not need `clean_game_name` for strip quality
- [x] Spaced version tails (`v0 4`, `v1 188`) stripped in Stage A6
- [x] Trailing `Early Access` / `EA` stripped in Stage A6
- [x] Franchise **apostrophe inject** so `Assassins Creed …` hits colon-head Stage C
- [x] Pack/collection peel variant (Stage C row 7) without discarding exact pack title
- [x] Unit fixtures ≥15 from table above (`tests/test_utils_game_name_parse.py` + `TestRealFolderPipeline` in `tests/test_utils_gamenames.py`)
- [x] `match_scoring` / identify path unchanged for high/low confidence + propose-only
- [x] No mass rename; strip tags for matching only

### Done — A9–A14 peel wave (2026-07-29)

- [x] A9 Incl Update parentheticals (+ `(oculus)` platform paren)
- [x] A10 unbracketed scene/repack suffixes (aliases in code only; ≥2 head tokens)
- [x] A11 date-stamp / compact `V########` tails
- [x] A12 Update/Build prose + version ranges
- [x] A13 add-on/HV junk strip; C10 edition peel (keep-full + peel)
- [x] A14 VR re-pass after A6 (`Title VR v…`)
- [x] Lettered `v1.1.0a` in A6; fixtures 18–29 (+ household shapes)
- [x] C11 bare franchise → propose/manual only (`bare_franchise` on parse; identify skips auto-import)
- [ ] Skip-dir / Admin `dir:` for PC tools (OpenVR Metrics, converters, editors) — Ops + Backend config, not IGDB force-match
- [ ] Steam unmatched triage logging (`steam_app_id` extracted? Steam title null?) — optional follow-up

## Explicit non-goals

- No Discord / webhooks  
- No pirate-index / romhacking scrape; strip tags only for matching quality  
- No DRM store download queues (Steam App ID → title lookup for match only; ownership register-only)  
- No mass rename in this slice (rename remains Phase 1B+)  
- No expanding Class A scene/repack brand catalogs in public docs (aliases in code only)

## Handoff map (files)

| Seat | File / area | Work |
|---|---|---|
| **@agent-backend** | `gametheca/utils/game_name_parse.py` | **Done** A0–A14 (Incl Update · unbracketed scene/repack · date-stamps · Update/Build prose · edition/add-on · VR re-pass · `bare_franchise`) |
| **@agent-backend** | `gametheca/utils/gamenames.py` | **Done** Stage C + C10 edition peel + C11 bare-franchise single-variant |
| **@agent-backend** | `gametheca/utils/match_scoring.py` | Keep `steam_title` bump; do not loosen auto-import threshold |
| **@agent-backend** | `gametheca/utils/game_core.py` (scan identify) | **Done** variant_base = `parse_game_label` only; C11 propose-only on bare franchise |
| **@agent-backend** / **@agent-ops** | skip-dir / Admin `dir:` | PCWIN tool folders (OpenVR Metrics, converters, editors) — skip, do not match |
| **@agent-qa** | `tests/test_utils_game_name_parse.py`, `tests/test_utils_gamenames.py` (+ scoring) | **Done** A0–A14 + C10/C11 · **QA 166 PASS** |
| **@agent-docs** | this file + progress + canvas | Residuals truth sync · canvas rewrite |
| **@agent-ops** | Unraid rescan Library A PCWIN `scan_depth=2` | **Documented** — propose-only then full after human ship; prefer ship A9+ before second full rescan |
