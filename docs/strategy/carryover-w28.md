# W28 carryover — what five sessions left behind

**Written:** 2026-08-14 · **Branch:** `w28-carryover` (off `w27-ux-feedback` @ `5509c84a`)

**Why this exists.** Work through W26/W27 ran across five separate agent sessions and six branches.
Each session ended with its own recap in its own transcript, and two of them ended mid-verification.
Reading any one of them gave a partial answer to "what is left"; nothing gave the whole one. This file
is that single answer, reconciled against the git history rather than against the recaps — because a
recap says what a session *believed* it left, and the tree says what it actually left.

It supersedes nothing. [ui-debt-log.md](../dev/ui-debt-log.md), [W26](roadmap-w26-ux-overhaul.md) and
[W27](roadmap-w27-ux-feedback.md) stay the per-item registers; this file is the index over them plus
the items that only ever existed in a chat transcript.

---

## Nothing was lost in transit

Verified before writing anything below: working tree clean, no stashes, no dirty worktree.

Every session's output landed in **one commit** — `5509c84a`, 278 files. That includes work its own
commit message does not mention: the `run_in_background` conversion and
[tests/test_background_workers.py](../../tests/test_background_workers.py) are both in it, though the
message describes only the chrome wave and three review fixes.

### Branch disposition

| Branch | State | Action |
|---|---|---|
| `w27-ux-feedback` | 1 commit ahead of `main`; the superset | base of this branch |
| `test-harness-clean-db-failures` | fully merged; `git diff main...` is empty | deletable |
| `cursor/feedback-fix-waves` | fully merged; diff empty | deletable |
| `cursor/readme-live-screenshots` | fully merged; diff empty | deletable |
| `claude/great-mclaren-7e8309` | **zero commits** — that session edited the main repo, not its worktree, and said so | worktree removable |
| `feature/wave2-admin-fixes` | **unrelated history** — own root, predates `chore: replace repository with clean 0.2.0 tree` | left in place, see below |

**On `feature/wave2-admin-fixes`:** it shares no merge base with `main`. Its 58 commits are the
pre-0.2.0 line that the clean-tree replacement superseded. Exactly two files exist there and nowhere
in `main` — `gametheca/static/newstyle/searching.gif` and `searching_small.gif`, referenced only by
that branch's copy of `admin_manage_scanjobs.html`. Nothing in the current tree wants them. Decision
2026-08-14: **leave the branch alone**, do not restore the assets, record it here so the call is
visible instead of implied by a deletion.

---

## Open work, by where it is already tracked

Nothing new is invented here. These are pointers, so the registers stay authoritative.

### The four big rocks — [W26 § Open set](roadmap-w26-ux-overhaul.md)

| Item | Why it is still open |
|---|---|
| Emulator player chrome — volume · power · reset · pause, per-system UI | UID-007; clock fix done, chrome untouched. Reference target named by the human: Provenance-Emu |
| Libraries & Scans overhaul — auto-scan / library-maker unification | extends UX-C2 · UX-C3 |
| Card layout redesign | surfaces unified, individual layouts untouched; extends UX-B5 |
| GOG / Epic live sync | genuinely unbuilt, deliberately — neither store has a documented ownership API. The honesty layer (`STORE_SYNC_MODE`) shipped in its place |

### Smaller, still open — [W26 § Open set](roadmap-w26-ux-overhaul.md)

`UX-C8` DataTable migration · `UX-B7` admin toast adoption + library-add completion signal ·
`UID-006` theme packs (art seat) · `UX-B4` game-details dead space.

`UID-008a` and `UID-014` are listed as open there but **closed since** — see the debt log, which
stayed current when that file did not.

### W27 — [roadmap-w27-ux-feedback.md](roadmap-w27-ux-feedback.md)

23 of ~30 done. Open by decision, all redesign or art direction rather than defect:
`C4` unmatched redesign + dupe preview · `D3` Statistics · `D5` layout half ·
`E1` console-named themes · `E4` per-theme icon alternates · `E2` full colour per console.

### Debt log — [ui-debt-log.md](../dev/ui-debt-log.md)

`UID-011` cover type sizing · `UID-012` controller logo · `UID-006` · `UID-007` ·
`UID-017` page-CSS token migration · `UID-018` route migration to `api_response.py`.

---

## Items that existed only in a chat transcript

These have no register entry anywhere. They are the actual reason this file exists.

### 1. The giant-tiles bug is unresolved and unexplained

Reported by the human against the running app. `aspect-ratio: 3/4` is present in all five **deployed**
themes, so covers should be constrained regardless — and the `auto-fit` change was reverted. Confirmed
to happen on load with no hover. The session that chased it stopped rather than invent a cause, which
was correct. **No root cause is known.** Not the same thing as the stale-CSS problem below; this one
probably survives a Reset Themes.

### 2. A verification pass is owed, and the list it would clear is stale

The theme-freshness checker found **36 of 85 theme assets behind source and 3 never deployed at all** —
including `gt-shell.css`, the entire rail/shell stylesheet. Every shell fix written before that
discovery had been invisible in the browser since the moment it was written.

The consequence: a large batch of "still broken" reports from 2026-08-13/14 cannot be trusted either
way. They may be real defects or they may be stale-CSS artifacts. **Run Admin → Themes → Reset Default
Themes, hard-refresh, then re-report.** Until that happens, every item in that batch is unverifiable,
and picking any of them up means possibly chasing a fix that already shipped.

The `Theme assets` Ops panel now reports drift so this cannot hide again — it distinguishes *drifted*
from *never deployed*, and never copies anything itself.

### 3. Two verifications blocked on hardware — [W26](roadmap-w26-ux-overhaul.md)

* **EMU-1** — the refresh-rate fix cannot be confirmed on a 60Hz panel; needs a >60Hz display. 60Hz is
  precisely the case the old default already handled, so a 60Hz test proves nothing.
* **UX-A4** — ownership link 404 not reproduced; needs a retest after redeploy, with the server log line.

### 4. Dead chrome left deliberately for its owner

The session that retired the `user-expand-icon` JS stopped short of adjacent cleanup, on the grounds
that it meant editing freshly-written GT-B2 code:

* [base.html:167](../../gametheca/templates/base.html) — `.sidebar-link.has-submenu` / `.submenu`
  handlers match nothing any template renders, **but** `closeAllSubmenus()` is wired into the live rail
  toggle at line 156. Removing the dead half means touching the live half.
* [base.html:188](../../gametheca/templates/base.html) — `.container-filtersandsort` lookup, dead.
* [base.css:418](../../gametheca/setup/default_theme/css/base.css) — `.user-expand-icon` survives as a
  live rule driving a rotation nothing triggers. **One source file**; the ten copies under
  `static/library/themes/` are generated by `install_preset_themes`, so editing them is both wrong and
  futile. Same shape for `icon-chevron` in `sidebar.css`.

Note the reinstall wrinkle: deleting these rules will not reach existing installs until themes
reinstall — which is the same Reset Themes step as item 2.

### 5. pytest was never run against the wave commit

`5509c84a`'s own message says so: *"pytest not run: no test database available in this environment."*
The suites reported green in other sessions (387 in the review session, 116 CI-gated) were run against
the working tree at other moments, not against this commit. Frontend is covered — admin vitest 250,
member vitest 481, css-token-lint clean at 1308.

Per the standing note in memory: the test DB needs a manual start; port 5432 is closed on a fresh
session. Probe before planning backend test work.

---

## Standing lesson, carried forward

From the foot of [W27](roadmap-w27-ux-feedback.md), and it earned its place twice more this wave:

> A component that exists is not a component that shipped. Prefer **adopted everywhere** as the bar for
> closing a UI item.

W27 found four W26 items closed while half-adopted. The theme-asset discovery is the same failure one
layer down — code that was written, committed, and never *served*. Both cost days. "Built" and "in
front of the human" are different claims.
