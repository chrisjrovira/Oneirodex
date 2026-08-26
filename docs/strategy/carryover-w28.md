# W28 carryover — what five sessions left behind

**Written:** 2026-08-14 · **Updated:** 2026-08-16 — the whole line landed on `main` (`6acf7e1c`) and
the branch cleanup this file recommended was carried out. Items marked *Update 2026-08-16* below have
moved since; everything else still stands.

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

| Branch | State | Action | Done |
|---|---|---|---|
| `w28-carryover` | 22 commits ahead of `main`; the superset | fast-forward onto `main` | **2026-08-16** — `main` = `6acf7e1c`, pushed. Branch kept |
| `w27-ux-feedback` | 1 commit ahead of `main`; base of `w28-carryover` | absorbed into `main` | kept 2026-08-16 — safe to delete whenever |
| `claude/dazzling-sammet-b1bb36` | identical SHA to `w27-ux-feedback`; its own worktree | absorbed | **deleted 2026-08-16** (worktree removed) |
| `test-harness-clean-db-failures` | fully merged; `git diff main...` is empty | deletable | **deleted 2026-08-16** |
| `cursor/feedback-fix-waves` | fully merged; diff empty | deletable | **deleted 2026-08-16** |
| `cursor/readme-live-screenshots` | fully merged; diff empty | deletable | **deleted 2026-08-16** |
| `claude/great-mclaren-7e8309` | **zero commits** — that session edited the main repo, not its worktree, and said so | worktree removable | **deleted 2026-08-16** |
| `feature/wave2-admin-fixes` | **unrelated history** — own root, predates `chore: replace repository with clean 0.2.0 tree` | left in place, see below | **kept** — only copy of the pre-rewrite line |

**On `feature/wave2-admin-fixes`:** it shares no merge base with `main` — its root is
`32f6dcd4 Initial commit: SharewareZ rewrite` (2026-07-23), four days before
`17b3e856 chore: replace repository with clean 0.2.0 tree`. Its 58 commits are the pre-0.2.0 line that
the clean-tree replacement superseded. Decision 2026-08-14: **leave the branch alone**, do not restore
its orphaned assets, record it here so the call is visible instead of implied by a deletion. Re-affirmed
2026-08-16 during the branch cleanup — it is the only copy of that history, so it is the one branch not
deleted.

Re-verified 2026-08-16: **nine** files exist there and nowhere in `main`, not the two recorded on
2026-08-14. The count grew because the tree kept retiring things, not because anything was missed —
`chrome/TopNav.jsx` and its test went in GT-B2, `templates/settings/settings_panel.html` and
`admin_manage_users.html`/`.js` in the theme-picker merge (`97c64e26`), alongside
`admin_manage_image_queue.html`, `new_server_info.html` and the two `searching*.gif` spinners. Every
one is a deliberate removal with no live reference in the current tree — checked by grep, not assumed.
Feature coverage on `main` is a superset by every probe tried (emulators, household, cheats,
translation, NZBGet, icon packs).

---

## Open work, by where it is already tracked

Nothing new is invented here. These are pointers, so the registers stay authoritative.

### The four big rocks — [W26 § Open set](roadmap-w26-ux-overhaul.md)

| Item | Why it is still open |
|---|---|
| Emulator player chrome — volume · power · reset · pause, per-system UI | **Done 2026-08-25** — UID-007. Clock + BIOS island were earlier; bar + overlay chrome landed. |
| Libraries & Scans overhaul — auto-scan / library-maker unification | **Done 2026-08-26** — Library tools is a tab of `/scan_management?active_tab=tools`. `/admin/library_tools` redirects there. |
| Card layout redesign | surfaces unified, individual layouts untouched; extends UX-B5 |
| GOG / Epic live sync | **Done 2026-08-26** — unofficial Galaxy / launcher surfaces, register-only (no DRM download). Honesty layer stays: Amazon is still snapshot. |

### Smaller, still open — [W26 § Open set](roadmap-w26-ux-overhaul.md)

`UID-006` theme packs **done 2026-08-26** (`GENERATOR_VERSION` 16).

`UX-C8` DataTable migration and `UX-B4` game-details dead space **closed 2026-08-26**.
`UID-008a` and `UID-014` are listed as open there but **closed since** — see the debt log, which
stayed current when that file did not.

### W27 — [roadmap-w27-ux-feedback.md](roadmap-w27-ux-feedback.md)

23 of ~30 done. Open by decision, all redesign or art direction rather than defect:
`D5` layout half (density + extra attrs) · `E1` console-named slugs (geometry landed as UID-006; names stay generic) · `E4` per-theme icon *drawings* (code half done: resting glyphs use `--gt-accent`) · `E2` full colour per console.

`C4` dupe pop-out on the live Jinja unmatched table **done 2026-08-26**. `D3` Statistics grid **done 2026-08-26**. `/admin/server_status_page` now redirects to Ops. Dead sidebar chrome stripped. Library tools is a tab of Libraries & scans.

### Debt log — [ui-debt-log.md](../dev/ui-debt-log.md)

`UID-011` cover type sizing · `UID-012` controller logo · `UID-006` ·
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
Themes, then re-report.** Until that happens, every item in that batch is unverifiable, and picking any
of them up means possibly chasing a fix that already shipped.

> **Update 2026-08-16 — the second half of this had a root cause, and it is fixed (`97c64e26`).** Drift
> was only one layer of it. Even a correctly deployed asset stayed invisible: `asgi.py` served every
> static file `public, max-age=3600` with **no validator**, and Reset Themes rewrites theme files *in
> place behind an identical URL*, so the browser had no reason to re-fetch for up to an hour. That is
> why "hard-refresh" had become the standing workaround. Theme URLs now carry an mtime+size version and
> `/static/library/themes/` serves `no-cache`. **The re-report step above no longer needs a hard
> refresh** — a Reset Themes plus a normal reload is now sufficient and trustworthy. At least one item
> in that batch (tile hover enlarge) was confirmed to be purely this, needing no code change at all.

The `Theme assets` Ops panel now reports drift so this cannot hide again — it distinguishes *drifted*
from *never deployed*, and never copies anything itself.

> **Update 2026-08-21 — the debt has a second, newer half, tracked as MISS-QA-4.** The batch above is the 2026-08-13/14 reports. Since then W29-1, W29-2, W29-3 and W29-5 have each shipped chrome work closing with *live verification owed* — Docker Desktop was down for every one of them. Same blocker, different list: those four are **not** stale-CSS suspects, they are simply unseen. W29-5 in particular touches only bundled component CSS, so it needs an SPA rebuild rather than a Reset Themes. Cleared together in one pass — [pm-miss-backlog.md](pm-miss-backlog.md) MISS-QA-4, with MISS-DOC-4 (README capture) riding the same instance.

### 3. Two verifications blocked on hardware — [W26](roadmap-w26-ux-overhaul.md)

* **EMU-1** — the refresh-rate fix cannot be confirmed on a 60Hz panel; needs a >60Hz display. 60Hz is
  precisely the case the old default already handled, so a 60Hz test proves nothing.
* **UX-A4** — ownership link 404 not reproduced; needs a retest after redeploy, with the server log line.

### 4. Dead chrome left deliberately for its owner

**Done 2026-08-26.** `gt_shell_rail.js` is rail toggle only. Submenu handlers, `closeAllSubmenus`, and the `.container-filtersandsort` hide-when-not-`/library` hack are gone. `.user-expand-icon` / account-menu CSS removed from `base.css`; `.sidebar-link.has-submenu` rule removed from `sidebar.css`. Reset Themes for those two stylesheets.

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
