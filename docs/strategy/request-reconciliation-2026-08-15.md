# Request reconciliation — every ask, against the registers

**Date:** 2026-08-15 · **Question asked:** *"are all bugs, features requests full build outs complete? including all my notes over all the past conversations"*

**Answer: no.** This file is the evidence.

> **Update, same day — closed since this was written.** The root cause of "my fixes never land" was
> found and fixed: static responses carried `public, max-age=3600` with **no validator**, and theme
> files are rewritten in place at a fixed URL, so a completed Reset Themes stayed invisible for up to
> an hour. That single defect explains a large share of the "still broken" reports below, including
> tile hover, which needed no code change at all.
>
> Also closed: the two theme pickers merged to one · fonts and firmware install with the server ·
> the tile menu that rendered under the row beneath it · grid dead space and the displaced pagination
> bar · off-theme tile controls · the boxed, unaligned rail scroll pair · News ordering with admin
> notes conditional · Help as one segmented control and panelled like the admin guide · **editable
> art-studio text (UID-011's second half)** · and a **ratchet for UID-018**, whose baseline had grown
> from 699 to 1194 while being recorded as "incremental".
>
> Still true: everything under *Blocked on you*, and every item needing art direction.

## Method, and its limits

Read all **150 human turns across 8 transcripts** (~65 MB) in
`~/.claude/projects/Z---projects-Gametheca/`, then checked each concrete request against the
registers and the tree.

Two things worth stating up front:

* [carryover-w28.md](carryover-w28.md) was built from **five** sessions, because that is what the
  session list returned. There are **eight** transcripts on disk. The largest — 35 MB, 2026-08-03 to
  08-07, 66 human turns — was never in that list. Most of the original feature dump lives there.
* Turns like "cont", "fix em all", "do it all" carry no content of their own. The substance is in
  about **fifteen** turns, several of which are long multi-item dumps. Those are what is tracked below.

Where a row says *unverified*, it means the register claims it or the code suggests it, but nobody has
confirmed it against the running product — and per the standing lesson, that is not the same as done.

---

## Closed, and confirmed in the tree

Filter panel slide-out · chat launcher removed from bottom-right · page title cards into the top bar ·
rail label wrap · Libraries & Scans merged to one page · server info folded into Ops · image queue
classic retired · unmatched button overlap · bad-match feedback with reasons · trailer title into the
player card · Help page legibility · loading motifs on classic pages · browse loading as a blocking
overlay · SharewareZ references removed · fonts · system backdrop · related-media strip · AGPL
licence · BIOS subdirectory discovery · emulator refresh-rate clock · cover-art composition variety ·
chat pop-out · Steam metadata mapping · scan freshness (updates/DLC) · admin metric strips ·
**tables sortable across the UI** (this session).

---

## Open — your words, and where they actually stand

### Never built

| Your request | State |
|---|---|
| "we need a cheat system like wand or pcchests for pc games that are installed" | `FEAT-D2`. Reopened by you on 08-03 after being deferred. **Not built.** Model `PcCheat` exists; no surface |
| "gaming services we link to need to **sync** to the service like steam does not just a upload that wont stay up to date" | GOG/Epic live sync. **Not built, deliberately** — neither store has a documented ownership API. The honesty layer (`STORE_SYNC_MODE`) shipped instead, so the UI admits a snapshot is stale |
| "claiming free games should be seemless when an account is attached" | `FEAT-D6`. Depends on the above. **Not built** |
| "emulators pages need to be redesigned and have the look feel, visuals of the system being played and what a users room, arcade would look like" | `UID-007`. Player chrome (volume/power/reset/pause), per-system UI. **Not built.** You named Provenance-Emu as the target |
| "statistices should be redone, and look better and have more graphs, tables, etc" | `W27-D3`. **Not built** — re-report of `UX-C13`, which added content without fixing layout |
| "the whole unmatched table needs a better UI as it seems cramped, dupes are too small" | `W27-C4`, including the pop-out dupe preview. **Not built** |
| "library tools needs to be much more user friendly" + "auto scan and library maker should be on the same page not two" | Libraries & Scans overhaul. **Not built** |
| "remake a new logo as the controller one is too silly" | `UID-012`. **Not built** — needs art direction |
| "the artwork we create the text is still tiny and not legiable it should be editable in the art studio" | `UID-011`. Legibility floors landed; the **editable** part did not |
| Themes "named after consoles/systems", each reflecting that system | `W27-E1` / `UID-006`. Token scales exist; **packs never authored** |
| "All LHN icons should follow the selected theme's colour" | `W27-E4`. **Not built** |
| Competitive-scan adoption: nested AND/OR filter builder + saved filters, Apprise notifications, session tracking + activity heatmap, taste-profile picker, persistent "not interested", copy-level physical detail, RAWG/Wikidata sources, public list pages with RSS | From your ~47-repo review. Recorded as candidates; **none started** |
| ~20 emulator repos (08-13) for the "mobile look" systems visuals | Reviewed; **the visual direction was never built** |

### Half-adopted — the failure mode this project keeps repeating

| Your request | What actually happened |
|---|---|
| "toast notifications should be used for all user and admin pages / should be able to be closed / should only show games when a library has been **fully** added" | `UX-B7`. Dismiss shipped. **Admin adoption did not**, and the "only when fully added" gate needs a backend completion signal that was never built |
| "check stores should be renamed to show its for updates/dlcs" | Renamed on the React details page with a comment explaining why — and **missed on the Jinja page**, which still said "Check stores" until this reconciliation. Fixed now |
| "details should also be reworked to not allow so much emtpy space under summary" | `UX-B4`. Row sizes to the summary; later sections still do not flow up beside the rail |
| "all tables should be fiterable and sortable across the UI" | Substantially closed this session. `DataTable` was React-only, so classic pages could never use it — now `gt_sortable_table.js` covers them. Two Ops tables stay hand-rolled by decision |
| "every category of button" must match | Started this session: `.gt-cbtn` gained the disabled state it never had, focus unified. **`.gt-cbtn` is still off the token scales**, and ten page-local button classes are untouched |
| "i want to get rid of all header information on a page and build a second title bar" | Landed, but `UIR-3` left per-page header actions in place; moving them is per-page work that was never finished |

### Reported broken, still unexplained

| Your report | State |
|---|---|
| "some images are blown up" / "the bigger tiles in the setting from others is just there on load, there is no hover" | **No root cause.** `aspect-ratio: 3/4` is in all five deployed themes, so the obvious explanation is ruled out. The session that chased it stopped rather than invent one — correct, but it means this is genuinely open |
| "the context menu is hidden under the tile below" | Not traced to a fix |
| "i still see the page vanish for a split second when its refreshing" | Not traced to a fix |
| "ownership link is broken" | `UX-A4`. Not reproduced; needs a retest after redeploy with the server log line |
| "emulated games run very bad, audio is glitchy and a bit fast" | Refresh-rate fix shipped, then you confirmed **60 Hz, both windowed and fullscreen** — which is the case the old default already handled. So the fix cannot explain what you saw, and the real cause is still unknown |

### Blocked on you, not on work

* **Reset Themes.** Theme CSS only reaches `static/library/themes/` on that action. 36 of 85 assets were
  behind and 3 never deployed when last measured. Everything classic-side from this session — sortable
  tables, button states, focus rings — is invisible until it runs.
* **EMU-1** needs a >60 Hz display to verify.
* The whole 08-13/08-14 bug batch cannot be trusted either way until a reset, because it is impossible
  to tell a real defect from a stale-CSS artifact.

### Smaller items with no clear register entry

From your 08-13 list, these were never given IDs and I cannot confirm any of them shipped:
green accent on the **right** side of the selected rail item · scrollbar styling (thinner when the rail
is minimised) · auto-scan welcome overlaying its section rather than sitting on top · "active scan
jobs" showing when there could not have been any · discover row titles standing out more · tile hover
scaling **relative** to current tile size rather than a fixed jump.

Also unconfirmed from the original dump: "page should default to 50 titles not 20", "show more in
content should not appear unless it has more text than expected", "companion offline should be next to
the size/status/freshness row", and the four tile buttons being "black, same size, and aligned".

---

## The pattern worth naming

Three separate mechanisms have let your requests fall out of sight:

1. **Closed while half-adopted.** W27 found four W26 items marked Done that had shipped on one surface.
   The "Check stores" rename found here is a fifth. The bar should be *adopted everywhere*.
2. **Registers drift from reality.** `UID-018` is recorded as 699 call sites across 72 files; it is now
   **1194 across 84**. Migration is losing to growth, so counting it as "incremental progress" is wrong.
3. **Guards that pin markup, not behaviour.** Three stale tests were found this session, each asserting
   a specific element that a refactor moved. All failed against correct code, and all sat outside the
   CI gate where nobody saw them.

## What would actually close the gap

Nothing here needs invention — it needs sequencing and your eyes on two things:

1. **Run Reset Themes**, then re-report the 08-13/08-14 batch. That single action decides which of a
   dozen items are real.
2. **Art direction** unblocks `UID-011`, `UID-012`, `W27-E1`, `W27-E4` and the emulator room visuals —
   five items waiting on a judgement no amount of code will supply.
3. **A decision on GOG/Epic**: depend on an unofficial surface, or keep the snapshot honesty layer and
   close `FEAT-D6` as won't-build.
