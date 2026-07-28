# Folder → IGDB name-resolution rules

**Audience:** Backend (scan / `game_name_parse` / `game_core` variants) · Ops/Docs (scan depth)  
**Date:** 2026-07-27 · **Owner:** Game Master (rules) → Backend (implement)  
**Related:** [libraries-and-scans.md](../admin/libraries-and-scans.md) · design `docs/superpowers/specs/2026-07-22-game-recognition-and-rename-design.md`

## Gap (evidence)

Household PC tree `…/_pc/_a…_z` holds ~2200 letter-bucketed folders. Example miss:

| Disk folder | Expected IGDB |
|---|---|
| `Baldur's Gate Dark Alliance 1` | `Baldur's Gate: Dark Alliance` (colon; no trailing `1`) |

Also present nearby: BG1 EE, BG2, BG3, Dark Alliance 2 — so wrong auto-picks are costly. Awkward labels also include scene/repack brackets, trailing `(steamId)`, spaced version tokens (`v1 0 4 1`), dots-as-spaces, lowercase Steam folders, and hyphenated titles (`Bad Dream - Afterlife`).

Today: `parse_game_label` strips scene/repack brackets, version junk like `[1 0 4 1]`, and trailing `(digits)`; `generate_goty_variants` expands GOTY, known/heuristic colon subtitles, trailing bare `1`, Arabic↔Roman sequels, and a de-apostrophized copy before IGDB search.

---

## Ops prerequisite — `scan_depth`

| Library root shape | Required `scan_depth` | Why |
|---|---|---|
| `…/_pc` with children `_a`…`_z`, `_#` | **2** | Depth 1 treats buckets as “games”; depth 2 unwraps buckets → real titles |
| Flat roots (`E:\_software-games`, `E:\games`) | **1** | Immediate children *are* games |

Documented for operators in [libraries-and-scans.md](../admin/libraries-and-scans.md). No code change required for depth itself — wrong depth = thousands of false “games.”

---

## Ordered pipeline (Backend)

Run once per folder label. Deduplicate case-insensitively; **stop early** on high-confidence match (existing scorer). Cap ~8–12 unique queries.

### Stage A — Normalize (before variants)

| # | Rule | Notes |
|---|---|---|
| A1 | Strip scene/repack bracket tags | Extend existing `parse_game_label` / `strip_repack_tags` (aliases stay in code, not public docs) |
| A2 | Extract trailing `(digits)` → `steam_app_id` | Already present; strip from title string |
| A3 | Apostrophe / smart-quote normalize | Map `’` `‘` `ʼ` `´` → ASCII `'`; keep one de-apostrophized copy for search only |
| A4 | Existing cleaners | Underscores → spaces; dots-as-spaces; strip `v1.0.4.1` / spaced version tokens; Title-case lowercase dumps |

### Stage B — Prefer Steam title when App ID present

| # | Rule |
|---|---|
| B1 | If `steam_app_id` resolves via Steam store → **prepend** that exact title as variant #0 |
| B2 | Still generate folder-derived variants; score with `steam_title` bump (existing `match_scoring`) |
| B3 | Low confidence → proposal queue (never blind auto-import) |

### Stage C — Ordered search variants

Given cleaned tokens from Stage A (example: `Baldur's Gate Dark Alliance 1`):

| Priority | Variant kind | Rule | Example |
|---|---|---|---|
| 0 | Steam title | B1 when present | *(n/a for BGDA1)* |
| 1 | Cleaned as-is | After A1–A4 | `Baldur's Gate Dark Alliance 1` |
| 2 | Known subtitle colon | If a **known subtitle phrase** matches as a contiguous tail/mid token run, insert `: ` immediately before it | `Baldur's Gate: Dark Alliance 1` |
| 3 | Drop trailing bare `1` | If last token is bare arabic `1` (not `01`, not Roman) and ≥3 tokens precede it → drop `1` | `Baldur's Gate Dark Alliance` / `Baldur's Gate: Dark Alliance` |
| 4 | Sequel digit ↔ Roman | Map trailing `2`↔`II`, `3`↔`III`, `4`↔`IV` (both directions as separate variants) | `… Dark Alliance 2` ↔ `… Dark Alliance II` |
| 5 | Heuristic colon (≥4 tokens) | **Fallback only:** `tokens[:-2] + ": " + tokens[-2:]` | `Baldur's Gate: Dark Alliance` (after drop-1) |
| 6 | De-apostrophized | Remove `'` for one query | `Baldurs Gate: Dark Alliance` |
| 7 | Hyphen ↔ space / existing GOTY | Keep `generate_goty_variants`; try ` - ` → space and vice versa lightly | `Bad Dream Afterlife` |

**Do not** make heuristic colon (row 5) the sole auto-import path — require existing high-confidence score + gap.

### Known subtitle triggers (seed list — code, not UI copy)

Insert `: ` before the first match of (case-insensitive contiguous phrases), non-exhaustive:

`Dark Alliance`, `Enhanced Edition`, `Definitive Edition`, `Complete Edition`, `Game of the Year`, `GOTY`, `Remastered`, `Remake`, `Director's Cut`, `Royal Edition`, `Legacy of the Void`, `Wings of Liberty`, `Heart of the Swarm`

Franchise heads that commonly need a colon before the rest (optional second pass): `Baldur's Gate`, `Assassin's Creed`, `Grand Theft Auto`, `The Elder Scrolls`, `Far Cry`, `Call of Duty` — only when ≥1 token remains after the head.

### Sequel `1` caution

- Drop bare trailing `1` as a **search variant**, not as the only cleaned display name written to disk.
- Do **not** drop `1` inside versions (`v1`, `1.0`) or when the sole numeric identity is mid-title (`Half-Life 2` keeps `2`).
- Nearby series siblings (BG1/2/3 vs Dark Alliance) → rely on scorer gap; ambiguous → review queue.

---

## Example — BGDA1 variant list (ordered, deduped)

Folder: `Z:\_software\_games\_pc\_b\Baldur's Gate Dark Alliance 1`

1. `Baldur's Gate Dark Alliance 1`
2. `Baldur's Gate: Dark Alliance 1` *(known subtitle)*
3. `Baldur's Gate Dark Alliance` *(drop trailing 1)*
4. `Baldur's Gate: Dark Alliance` *(subtitle + drop 1)* ← expected IGDB hit
5. `Baldurs Gate: Dark Alliance` *(de-apostrophe)*
6. *(optional)* heuristic colon after drop-1 if not already produced by known list

Canonical target: **Baldur's Gate: Dark Alliance**. Must not auto-pick BG3 / BG1 EE / Dark Alliance 2 without failing the score gap.

---

## Backend DoD

- [x] `generate_goty_variants` emits ordered list covering Stage C for fixtures including BGDA1 → includes `Baldur's Gate: Dark Alliance`
- [x] Trailing `(digits)` → Steam title preferred as variant #0 when lookup succeeds (`retrieve_and_save_game`)
- [x] Apostrophe / smart-quote normalization + one de-apostrophized variant
- [x] Known-subtitle colon before blind ≥4-token heuristic; heuristic never sole auto-import
- [x] Drop bare trailing `1`; bidirectional `2`↔`II`, `3`↔`III` variants
- [x] Unit tests (no DB): BGDA1, Dark Alliance 2 / II style sequel swaps, version-bracket strip
- [x] Existing high/low confidence + propose-only paths unchanged
- [x] Ops docs state `scan_depth=2` for letter-bucket `_pc` (confirm; no Discord)

## Explicit non-goals

- No Discord / webhooks  
- No pirate-index scrape; strip tags only for matching quality  
- No mass rename in this slice (rename remains Phase 1B+)
