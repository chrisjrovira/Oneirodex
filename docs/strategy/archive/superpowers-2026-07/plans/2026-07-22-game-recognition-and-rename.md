# Game Recognition + Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve IGDB matching for real Unraid library names (scene/repack tags, Steam App IDs, versions), gate low-confidence imports behind review, then add template-based disk rename, proposal sidecars, and a library-doctor batch job.

**Architecture:** Pure parse/score helpers first (`game_name_parse.py`, `match_scoring.py`); wire into scan/`game_core` for high-confidence auto-import vs pending proposals; rename service with `is_safe_path`; extend `local_metadata` for proposals; admin doctor job reuses the same engines.

**Tech Stack:** Flask, SQLAlchemy, pytest, existing Steam/IGDB HTTP helpers

**Spec:** `docs/superpowers/specs/2026-07-22-game-recognition-and-rename-design.md`

## Global Constraints

- Phases 1A → 1B → 2 → 3; test and fix after each phase before advancing
- Steam `(digits)` = strong hint; low confidence requires human confirm
- High confidence auto-import only; else review queue with top-N + scores
- Rename = template + preview + checkboxes; never deep installed guts
- Optional letter-bucket move checkbox (default off)
- All disk ops through `is_safe_path`
- Prefer unit tests that do not require PostgreSQL for parse/score/rename-path math

## File Map

| File | Responsibility |
|------|----------------|
| `gametheca/utils/game_name_parse.py` | Parse folder label → cleaned name + steam_app_id; strip common scene/repack bracket tags |
| `gametheca/utils/gamenames.py` | Delegate cleaning to parse helpers; keep public `clean_game_name` API |
| `gametheca/utils/match_scoring.py` | Score IGDB candidates; high/low confidence decision |
| `gametheca/utils/game_core.py` | Search limit N; use scorer; stop blind `limit 1` |
| `gametheca/utils/scanning.py` | Pending proposals vs auto-import |
| `gametheca/utils/disk_rename.py` | Safe rename preview/apply (1B) |
| `gametheca/utils/local_metadata.py` | Proposal sidecar R/W (Phase 2) |
| `gametheca/utils/library_doctor.py` | Batch dry-run / propose / apply (Phase 3) |
| Admin templates/routes | Review queue, rename UI, doctor UI |
| `tests/test_utils_game_name_parse.py` | Real-library cleaning fixtures (no DB) |
| `tests/test_utils_match_scoring.py` | Scoring thresholds (no DB) |

---

### Task 1: Parse folder labels (scene/repack tags + Steam App ID)

**Files:**
- Create: `gametheca/utils/game_name_parse.py`
- Modify: `gametheca/utils/gamenames.py` (call into parse helpers)
- Test: `tests/test_utils_game_name_parse.py`

**Interfaces:**
- Produces: `parse_game_label(raw: str) -> dict` with keys `cleaned_name: str`, `steam_app_id: int | None`, `raw: str`
- Produces: `strip_repack_tags(raw: str) -> str`
- Consumes: none

- [ ] **Step 1: Write failing tests** (no DB)

```python
from gametheca.utils.game_name_parse import parse_game_label

def test_repack_tag_stripped():
    r = parse_game_label("Assassin's Creed Shadows [Repack]")
    assert r['cleaned_name'] == "Assassin's Creed Shadows"
    assert r['steam_app_id'] is None

def test_hv_repack_tag_stripped():
    r = parse_game_label("Borderlands 4 [HV Repack]")
    assert "Repack" not in r['cleaned_name']
    assert "Borderlands 4" in r['cleaned_name']

def test_steam_app_id_extracted_and_stripped():
    r = parse_game_label("barony (89881)")
    assert r['steam_app_id'] == 89881
    assert r['cleaned_name'].lower() == "barony"

def test_repack_plus_versionish_left_readable():
    r = parse_game_label("Alan Wake - Remastered [Repack]")
    assert "Alan Wake" in r['cleaned_name']
    # Remastered kept for disambiguation (spec)
    assert "Remastered" in r['cleaned_name'] or "Remaster" in r['cleaned_name']
```

- [ ] **Step 2: Run tests — expect FAIL (import/missing)**

Run: `pytest tests/test_utils_game_name_parse.py -v --noconftest`  
If `--noconftest` unavailable, run from a tiny harness or ensure tests do not request `app`/`db_session` fixtures (conftest still loads env but should not connect until fixtures used).

Expected: FAIL import error

- [ ] **Step 3: Implement `game_name_parse.py`**

```python
import re

# Bracket aliases: common scene/repack tags (seeded list lives in module; keep docs brand-free).
_BRACKET_TAG_RE = re.compile(
    r'\[\s*(?:[A-Za-z0-9]+(?:\s+HV)?)\s*(?:Repack)?\s*\]',
    re.IGNORECASE,
)
_STEAM_ID_RE = re.compile(r'\(\s*(\d{4,7})\s*\)\s*$')
# Destructive tokens only stripped on fallback retries elsewhere — keep Remaster/Remake/Intergrade here


def strip_repack_tags(raw: str) -> str:
    return _BRACKET_TAG_RE.sub('', raw).strip()


def parse_game_label(raw: str) -> dict:
    steam_app_id = None
    working = raw.strip()
    working = strip_repack_tags(working)
    m = _STEAM_ID_RE.search(working)
    if m:
        steam_app_id = int(m.group(1))
        working = working[:m.start()].strip()
    # Light normalize: underscores/dashes to spaces; collapse whitespace
    working = working.replace('_', ' ').replace(' - ', ' - ')
    working = re.sub(r'\s+', ' ', working).strip(' -_')
    # Title-ish without destroying acronyms: only capitalize first letter of words that are all-lowercase
    parts = []
    for w in working.split(' '):
        if w.isupper() or any(c.isdigit() for c in w):
            parts.append(w)
        elif w.lower() == w and w:
            parts.append(w[:1].upper() + w[1:])
        else:
            parts.append(w)
    cleaned = ' '.join(parts)
    return {'raw': raw, 'cleaned_name': cleaned, 'steam_app_id': steam_app_id}
```

Wire `clean_game_name` to optionally use `parse_game_label` for bracket/App ID first, then existing pipeline on `cleaned_name` **without** re-stripping Remastered via the `Repack|Edition|Remastered|Remake` regex — change that line to strip `Repack|Proper` and similar generic tokens only (keep Remastered/Remake/Edition for scoring). Update existing tests that expected Remastered removal. Functional alias lists stay in `game_name_parse.py` / tests — not in public docs.

- [ ] **Step 4: Run parse tests PASS; fix broken clean_game_name tests**

Run: `pytest tests/test_utils_game_name_parse.py tests/test_utils_gamenames.py::TestCleanGameName -v`

- [ ] **Step 5: Commit**

```bash
git add gametheca/utils/game_name_parse.py gametheca/utils/gamenames.py tests/test_utils_game_name_parse.py tests/test_utils_gamenames.py
git commit -m "Parse library folder labels for scene/repack tags and Steam App IDs."
```

---

### Task 2: Match scoring helper

**Files:**
- Create: `gametheca/utils/match_scoring.py`
- Test: `tests/test_utils_match_scoring.py`

**Interfaces:**
- Produces: `score_candidate(cleaned_name: str, candidate_name: str, *, steam_title: str | None = None) -> float` (0–1)
- Produces: `classify_confidence(scores: list[float], *, high_threshold=0.92, ambiguous_gap=0.08) -> str` → `"high" | "low"`
- High only if best ≥ high_threshold AND (best - second) ≥ ambiguous_gap (or only one candidate)

- [ ] **Step 1: Failing tests** — exact match → ~1.0; cleaned repack label vs IGDB title high; unrelated low; two close scores → low
- [ ] **Step 2: Implement** using `difflib.SequenceMatcher` ratio on normalized lowercase alphanumeric strings
- [ ] **Step 3: Tests PASS + commit** `Add IGDB candidate confidence scoring.`

---

### Task 3: Wire scan/search to multi-candidate + confidence

**Files:**
- Modify: `gametheca/utils/game_core.py` (`search_igdb_for_game` → `limit N`, return list)
- Modify: `gametheca/utils/scanning.py` / callers in `retrieve_and_save_game`
- Test: unit tests with mocked IGDB HTTP (no live DB if possible); extend existing scan tests when PG available

**Interfaces:**
- `search_igdb_for_game(..., limit=10) -> list[dict]`
- Auto-import only when `classify_confidence` is `high`; else call pending-proposal path (Task 4)

- [ ] Implement + mock tests + commit `Use scored multi-candidate IGDB matches during scan.`

---

### Task 4: Pending match proposals (DB + unmatched UI hook)

**Files:**
- Modify: `UnmatchedFolder` status or add `MatchProposal` model + migration/schema update pattern used by project
- Modify: admin unmatched / identify flow to show top candidates + scores
- Test: model/API tests when PG up; otherwise logic-unit tests for proposal payload builder

- [ ] Store `{path, cleaned_name, steam_app_id, candidates[]}` for low confidence
- [ ] Manual pick still imports via existing identify route
- [ ] Commit `Queue low-confidence matches for human review.`

**Phase 1A exit checklist:** parse fixtures green; scoring green; mocked multi-candidate path; manual sample of Z:/E: names look saner in logs/UI.

---

### Task 5 (Phase 1B): Disk rename service

**Files:**
- Create: `gametheca/utils/disk_rename.py`
- Test: `tests/test_utils_disk_rename.py` (temp dirs, no PG)

**Interfaces:**
- `build_rename_plan(game_root, *, title, year, template, rename_root, rename_top_level_media, move_letter_bucket) -> list[{from,to,kind}]`
- `apply_rename_plan(plan, allowed_bases) -> results` using `is_safe_path`

- [ ] Templates `{title}`, `{title} ({year})`; sanitize Windows-illegal chars
- [ ] Top-level media allow-list; never recurse
- [ ] Letter bucket detect parent `_a`…`_z`/`_#`
- [ ] Commit `Add safe disk rename planner for confirmed games.`

---

### Task 6 (Phase 1B): Rename UI + DB path update

- Admin route + template/JS preview with checkboxes
- Update `Game.full_disk_path` after success
- Commit `Wire rename preview UI after match confirmation.`

**Phase 1B exit:** temp-dir pytest; manual scene/repack-tagged folder rename; installed `E:\games\FFXV` guts unchanged.

---

### Task 7 (Phase 2): Proposal sidecars

- Extend `local_metadata.py` read/write proposal section or `gametheca.proposal.json`
- Propose-only scan setting
- Batch approve/reject admin list
- Commit `Persist match proposals to local sidecars.`

**Phase 2 exit:** R/W unit tests; propose-only leaves no new Game rows.

---

### Task 8 (Phase 3): Library doctor

- `library_doctor.py` dry-run / write proposals / apply approved
- Admin trigger + progress + downloadable report
- Commit `Add library doctor batch match and rename job.`

**Phase 3 exit:** dry-run on tiny fake tree; apply only checked rows.

---

## Self-Review (plan vs spec)

| Spec | Tasks |
|------|-------|
| 1A cleaning + App ID + scoring + high/low | 1–4 |
| 1B rename template/checkboxes/bucket | 5–6 |
| 2 sidecars + propose-only | 7 |
| 3 library doctor | 8 |
| Non-goals (no deep rename, no unattended mass rename) | Constraints + Task 5/8 guards |
