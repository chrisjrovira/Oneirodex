# Game Recognition + Rename Utility (Phased 1→2→3)

**Date:** 2026-07-22  
**Status:** Approved for implementation planning  
**Delivery:** Approaches 1 → 2 → 3 in phases; test and fix after each phase

## Goal

Reduce bad IGDB matches against real Unraid library naming (FitGirl/HV tags, Steam App IDs in parentheses, versions, abbreviations, letter-bucketed trees), then add a human-gated rename utility for root folders and top-level media after confirmation — without renaming installed game guts.

## Library Context (observed)

| Root | Layout | Patterns that hurt matching |
|------|--------|-----------------------------|
| `Z:\_software\_games\_pc` | Letter buckets `_a`…`_z`, `_#` | `[FitGirl Repack]`, `(84952)` App IDs, versions, lowercase dumps, scene tags |
| `E:\_software-games` | Flat (~199) | FitGirl/HV tags, `(89881)` IDs, versions, P2P, Early Access |
| `E:\games` | Installed/playable | Abbreviations (`FFXV`), clean titles, VR suffixes |

## Decisions Locked

| Topic | Choice |
|-------|--------|
| Scope | Recognition **and** rename, then sidecars, then library doctor |
| Delivery | Approaches **1 → 2 → 3** in phases; test each round |
| Steam `(digits)` | Strong hint; require human confirm when confidence is low |
| Rename naming | Template + preview (`{title}`, `{title} ({year})`, custom) |
| Rename targets | Root folder + top-level archives/ISOs/setup packs via **checkboxes**; never deep installed files |
| Letter buckets | Optional **move to correct `_x` bucket** as a preview checkbox (default off) |
| Auto-import | **High confidence only**; otherwise review queue with candidates |

## Explicit Non-Goals

- Renaming files inside installed game trees (`Engine/`, `datas/`, deep `.exe`/DLL guts)
- Unattended mass rename with no preview/checkboxes
- Replacing IGDB as catalog of record
- Legal/content-acquisition features (repack tags exist only for matching/rename)

## Phase Map & Exit Gates

| Phase | Approach | Goal | Exit gate |
|-------|----------|------|-----------|
| **1A — Recognition core** | 1 | Cleaning upgrades; App ID hint; scoring; high-confidence auto-import; low → review queue | Unit tests on real name samples; fixture scan: fewer wrong autos; pending shows top-N + scores |
| **1B — Confirm + rename** | 1 | After confirm/import (and on existing games): template rename preview with checkboxes + optional bucket move | pytest path safety; manual FitGirl rename; installed guts untouched; bucket move only if checked |
| **2 — Sidecar proposals** | 2 | Write/read proposal sidecars; propose-only mode; batch approve/reject | Sidecar R/W tests; propose-only leaves paths unchanged until approve |
| **3 — Library doctor** | 3 | Admin batch dry-run / write proposals / apply approved rows across roots | Dry-run report on sample of Z:/E:; apply only checked rows |

**Shared rule:** implement → automated tests → short manual checklist → fix → only then next phase.

---

## Phase 1A — Recognition Core

### Cleaning upgrades

Files: primarily `gametheca/utils/gamenames.py`, seeded/`ReleaseGroup` defaults.

- Strip bracket tags case-insensitively: `[FitGirl Repack]`, `[FitGirl HV Repack]`, `[Fitgirl Repack]`, similar
- Extract trailing `(digits)` as `steam_app_id` hint while removing them from the search title
- Expand scene/repack patterns (FitGirl, Dodi, CODEX, common scene groups) via seeded filters + small hardcoded safety net for this library’s dominant tags
- Soften destructive stripping: keep `Remaster` / `Remake` / `Intergrade` when they disambiguate; strip only on fallback retries if needed
- Reduce `.title()` damage: preserve acronyms / Roman numerals where practical

### Candidate pipeline

Replace blind IGDB `limit 1` auto-pick:

1. Parse folder → `{ cleaned_name, steam_app_id? }`
2. If App ID present → Steam store lookup → title hint → IGDB candidates
3. Else IGDB search `limit N` (5–10) with platform filter when known
4. Score candidates (normalized similarity, App ID agreement, platform)
5. **High confidence** → auto `retrieve_and_save_game` (current import path)
6. **Low / ambiguous** → pending proposal (extend unmatched or `MatchProposal`) with top candidates + scores — **no** auto-import

### Out of scope for 1A

Disk rename, sidecars, library doctor.

---

## Phase 1B — Confirm + Rename Utility

### When it appears

- After human confirm/import from a pending match
- Admin action on an existing library game (“Rename on disk”)

### Preview UI

- Template picker: `{title}`, `{title} ({year})`, custom using those tokens (filesystem-sanitized)
- Live preview of new names
- Checkboxes (default: root folder **on**; others **off**):
  - Rename **root game folder**
  - Rename matching **top-level** archives/ISOs/setup packs (allow-list e.g. `.iso`, `.img`, `.rar`, `.zip`, `.7z`; single-file installers sharing old basename — not every `.exe` in an installed tree)
  - **Move to letter bucket** (`_a`…`_z`/`_#`) when parent matches Z: scheme; default **off**
- Manual override text field per checked item
- Apply / Cancel

### Safety

- All targets via `is_safe_path` + allowed bases
- Refuse if destination exists
- Never recurse into installed guts
- On success: update `Game.full_disk_path` (and related file records if any); update local metadata if enabled
- If DB update fails after disk rename: clear error + log; no silent path drift

### Out of scope for 1B

Batch rename of entire libraries (Phase 3).

---

## Phase 2 — Sidecar Proposals

### Format

Extend existing local metadata (`gametheca.json` via `local_metadata.py`):

- Confirmed imports keep today’s confirmed fields (`igdb_id`, `manually_verified`, …)
- Low-confidence / propose-only writes a **proposal** section, or sibling `gametheca.proposal.json` if required to avoid confusing confirmed metadata:

```json
{
  "proposal": {
    "cleaned_name": "Barony",
    "steam_app_id": 89881,
    "candidates": [
      {"igdb_id": 123, "name": "Barony", "score": 0.94}
    ],
    "confidence": "low",
    "proposed_at": "..."
  }
}
```

### Scan modes / settings

- **Normal (1A):** high → import (+ optional confirmed sidecar); low → DB pending + proposal sidecar
- **Propose-only:** never auto-import; only proposals + pending queue

### Admin batch UI

- List folders with proposal sidecars / pending matches
- Approve → import + promote sidecar to confirmed `igdb_id`
- Reject / ignore → mark ignored; leave or clear proposal
- Optional: jump into Phase 1B rename after approve

### Safety

- Write only under `is_safe_path` game roots
- Never overwrite confirmed `manually_verified` without explicit force

---

## Phase 3 — Library Doctor (Batch)

### What it is

Admin-triggered job using the same recognition/rename engines from Phases 1–2. Walks selected library roots (or explicit paths under allowed bases, including the three observed roots).

### Modes

1. **Dry-run (default):** downloadable report (JSON/CSV): path, cleaned name, App ID, top candidates + scores, suggested template rename, bucket-move suggestion  
2. **Write proposals:** create/update Phase 2 sidecars + pending DB rows — no renames  
3. **Apply approved:** only checked rows (or imported approval list) — import and/or rename via Phase 1B rules  

### Guards

- `is_safe_path`, API rate limits, scan-job-style progress UI
- Never deletes; never renames unchecked items; never deep file renames
- Letter buckets: treat `_a`…`_z`/`_#` as containers, not games

### Out of scope

Unattended full-library rename with no report.

---

## Cross-Cutting Error Handling

- Recognition failures → pending/unmatched + log; never invent an IGDB link
- Rename failures → stop that item, report failures; leave already-applied items
- Steam/IGDB timeouts → backoff / degrade to name-only candidates

## Testing Standard

**Automated (per phase):** cleaning fixtures from real patterns; scoring thresholds; rename dry-run path math; sidecar R/W; doctor dry-run on a tiny fake tree.

**Manual (per phase):** samples from `Z:\_a`, `E:\_software-games`, `E:\games` (installed).

## Architecture Sketch

```text
Folder name
  → parse/clean (+ steam_app_id?)
  → candidates (Steam hint + IGDB N) + scores
  → high? import : pending proposal (+ optional sidecar)
  → human confirm
  → optional rename preview (template + checkboxes + bucket move)
  → safe disk ops + DB path update

Library doctor = batch driver over the same engines (dry-run / propose / apply approved)
```

## Relation to Other Work

Platform-filters + hardening remains a separate branch/plan. This design does not block or replace that work unless explicitly merged later.
