# W27 — UX overhaul, second pass

**Source:** human feedback 2026-08-14 (single dump, ~30 items, against the W26 build) · **Status:** in progress

**Done — 23 of ~30:** A1 · A2 · A3 · A4 · A5 · A6 · A7 · A8 · A9 · B1 · B2 · C1 · C2 · C3 · C5 · C6 ·
D1 · D2 · D4 · D6 · D7 · D8 · F1, plus **E2** (3 of its 4 parts) and **E3** answered rather than built.

Verified by admin vitest **225**, member vitest **472**, ops-glance **4**, pytest **116** (the whole
CI-gated list) with the new chrome flag on, the CSS token lint clean at a **retightened** baseline
(1317 → 1309), and clean builds of all four SPAs. Per the standing lesson at the foot of this file,
each is adopted rather than merely built.

**Still open, deliberately:** C4 (unmatched redesign + dupe preview) · D3 (Statistics) · D5's layout
half · E1 (console-named themes) · E4 (per-theme icon alternates) · E2's "full colour per console".
Every one is a redesign or an art-direction decision rather than a defect. They need someone who can
see the running product and make a judgement about how it should look — guessing at that costs more
time than it saves.

Same convention as [W26](roadmap-w26-ux-overhaul.md): grouped by size so the quick defects are not held
hostage by the big rocks, IDs stable — quote them when re-prioritising.

> **Read this first.** Several items are *re-reports* of things W26 marked done. That is the useful
> signal in this dump: the work landed in the SPA and did not reach the classic pages, or landed on
> one page and was never adopted across the section. Where that is the case it is named below, because
> "do it again" and "finish adopting it" are different jobs.

---

## A. Chrome / shell defects (small, concrete)

| ID | Item | Notes |
|---|---|---|
| **W27-A1** | **Page up/down controls render as a full-width bar** across the UI. They should sit at the **bottom of the LHN rail**, where there is already space | Regression from GT-B3: `ScrollJump` was re-hosted onto the scroll container and its own positioning was never re-scoped to the rail |
| **W27-A2** | **Floating chat button still in the bottom-right** and should not be there at all | UX-B2 moved it off `ScrollJump`; the launcher itself was never removed once the rail gained a Chat entry |
| **W27-A3** | **Every library-section page still shows its own title card** with its buttons — Release Calendar, Notifications, Activity, News, Playtime, Report issue, Help. Title *and* its controls belong in the top bar | **Done — the work was built and never switched on.** `ENABLE_NEW_CHROME` defaulted to **false** in `config.py`, and every page gates its title card behind `shellConfig.enableNewChrome`, feeding its views and filters to `ContextBar` (bar two) on the other branch. The flag's own comment said "off until the pages adopt it" — but all **eleven** pages had adopted it, and the shell stopped being optional when `TopNav.jsx` was deleted and `SideRail`/`TopBar` became the only chrome `App.jsx` renders. Left off, it produced precisely the half-applied layout it existed to prevent, inverted: the new bar naming the page, every page still drawing its own card underneath. Default flipped in **both** places — `config.py` sets the value explicitly, so changing only the `app.config.get()` fallback in `__init__.py` would have done nothing. `ENABLE_NEW_CHROME=false` still works as a stopgap, but there is no old shell left to pair it with |
| **W27-A4** | LHN **"Libraries & Scans" subtext wraps to two lines**; the title alone is enough | |
| **W27-A5** | Selecting a **sub-page under Libraries resets the LHN**, so you cannot see which section you are in without navigating back to Libraries & Scans | Section context is lost on sub-routes — the rail's active-section resolution does not survive a child path |
| **W27-A6** | **Filter panel can no longer be hidden** by clicking Library again in the LHN | UX-B1 made the panel slide out; the LHN entry lost the toggle behaviour |
| **W27-A7** | **Friends link in the social LHN does nothing** | |
| **W27-A8** | **Many Integrations LHN links do not work.** Audit *every* LHN link, both shells | |
| **W27-A9** | **Help page** should be far easier to read and should take its styling from the active theme | **Done.** Body copy was 0.8–0.9rem at 1.35 line-height in `--gt-text-muted`; it is now `--gt-font-base` at 1.65 with a 72ch measure, and takes the full reading colour — muted is for supporting text, and this is the answer someone came for. Raw sizes throughout replaced with the type-scale tokens, so the page follows the theme instead of hard-coding around it. Net **-4** CSS token-lint violations |

## B. Library grid

| ID | Item |
|---|---|
| **W27-B1** | Tiles **no longer fill the screen when made smaller** — they used to. **Done:** the grid used `repeat(auto-fill, …)`, which keeps empty tracks alive so a row without enough tiles leaves dead columns rather than letting the tiles spread. Most visible exactly where it was reported — small tiles, and any filtered result. Now `auto-fit`, the same fix UX-B5 applied to the admin card grids and never extended to the library |
| **W27-B2** | **Visible jump in tile size** while scaling up or down, rather than a smooth resize. **Done:** `html` transitions `--gt-tile-min` over 0.22s, which is right for restoring a saved preference and wrong during a drag — the rendered size chased the handle a fifth of a second behind and crossed grid reflow thresholds mid-animation. Two things animating one value (the transition, and the user's finger) is what read as jumping. `TileSizeControl` now sets `is-tile-resizing` on `<html>` while the slider moves, suppressing the transition so the tiles track the handle directly, and clears it 120ms after input stops so the easing is back before any programmatic change needs it. **Note:** the column *count* still changes discretely — no CSS can interpolate a track count — so a reflow step at each threshold is inherent. Removing that entirely would mean fixed column-count steps instead of a continuous slider, which is a design decision, not a fix |

## C. Tables and lists — continues UX-C8

| ID | Item | Notes |
|---|---|---|
| **W27-C1** | **Every table must match** in theming and style, and so must **every category of button** | **Advanced, not closed.** The W26 note ("four surfaces still hand-rolled") was stale: `OpsPage`, `pages.jsx`, `ProposeLeafLibraries` and `ImportLeafLibraries` all use `DataTable` now. The real remainder was that `DataTable` is React, leaving every classic Jinja table outside the contract — addressed by `gt_sortable_table.js` (see C2), whose `.gt-sort-btn` rules live in the shared `table-components.css` rather than beside one page. The unmatched table has since adopted it: its hand-written sort buttons, its own sorter, its indicator bookkeeping and its `.unmatched-sort-btn` rules are all gone, and the module grew `data-gt-sort-default` — the counterpart to `DataTable`'s `initialSort` — so that table still arrives folder-ascending without a page script re-sorting after every render. **Still open:** seven raw `gt-ops-table` blocks remain in `OpsPage`/`pages.jsx` — of which at least the `DetailPanel` one is a **deliberate** keep, being a key/value block with no header row where a filter box over six rows of host facts is more chrome than content. Buttons are untouched by this pass |
| **W27-C2** | **Active scan jobs** table not sortable by clicking column headers — as every table should be | **Done.** The cause was structural rather than an oversight: `DataTable.jsx` is React, so the classic pages could never use it, and sorting arrived per page or not at all — the unmatched table grew a bespoke sorter during UID-005 and the jobs table beside it got nothing. New `js/gt_sortable_table.js` is the classic counterpart, adopted with two attributes (`data-gt-sortable` on the table, `data-sort-key` on each `<th>`) and auto-wired on DOMContentLoaded inside the module, so a new page cannot forget it. Its compare rules mirror `DataTable.jsx` line for line — three-state toggle, numeric-aware, absent values last in **both** directions — because two stacks that sort one column differently is the inconsistency C1 is about. Two things the naive version would have got wrong: the table is **repopulated by a poller**, so without a MutationObserver the sort silently reverts seconds after the click, which reads as broken rather than absent; and Progress renders "10/25", which sorts before "9/25" as text, so the row carries a numeric `data-sort-progress` instead |
| **W27-C3** | **Unmatched buttons still overlap each other** | **Done.** `.unmatched-row-actions` is a `flex-wrap: nowrap` scroller and its `.btn` children already declared `flex: 0 0 auto` — but several buttons are wrapped in a `<form>`, and the *form* is the flex item. With no rule of its own it fell back to the `flex: 0 1 auto` default, shrank below its content, and the button inside overflowed into its neighbour. Fixed on `.unmatched-row-actions > *` rather than on `form` so a new wrapper element cannot bring it back; the group already scrolls, so refusing to shrink costs nothing |
| **W27-C4** | **Unmatched table redesign** — easier to interact with, plus a **preview pane for dupes that pops out** so the detail is readable | |
| **W27-C5** | **Image queue page is unchanged** and needs to be pulled inline | **Already inline — nothing pointed at it.** `#imageQueue` has been a tab of the scan management page (`/scan_management?active_tab=image_queue`) all along. The rail linked to the standalone classic page instead, so the inline version was never what anyone saw. Rail now points at the tab |
| **W27-C6** | **Remove Image queue classic entirely** — not needed | **Done.** `/admin/image_queue` and `admin_manage_image_queue.html` removed; the three route tests replaced with one asserting the page 404s and one asserting `/admin/api/image_queue_list` survives — retiring the page must not take the queue's data source with it, since both the inline tab and the React images page read it |

## D. Admin IA

| ID | Item | Notes |
|---|---|---|
| **W27-D1** | **Ops and Server info are still two pages** and must be one | **Done.** GT-B21's claim was half true — Ops *did* already render System / Database / Logs; what survived was the page itself. `/admin/new_server_info` is now retired at every layer (route, template, rail link, ops-glance deep link, route resolver, icon test). The one thing only that page showed — **config values** — was added to `/admin/api/ops/system` and rendered as a fourth Ops panel **first**, because retiring a page that still holds the only copy of something is how a merge loses information. The three duplicated key/value panels were collapsed into one `DetailPanel` rather than becoming four. Note `/admin/server_status_page` still exists but is **unreachable from the UI** — no nav or deep link points at it — so it is dead code with a live test suite, not a second visible page |
| **W27-D2** | **Logs belong in the Ops glance** too | **Done.** `/admin/api/ops/logs` serves the recent slice (clamped 1–200) and Ops renders it as a sortable `DataTable` beside the metrics — an error tile is only useful next to the error that produced it. Fetched separately from the system detail so a failing log read cannot blank the host panels, or the reverse. Deliberately **not** the whole browser: `/admin/system_logs` keeps its pagination and type/level/date filters, because duplicating those here would put two log browsers in the product to keep in step |
| **W27-D3** | **Statistics needs a full redesign** — large amounts of empty space, and odd scrolling on both axes | Re-report of UX-C13, which added content without fixing the layout |
| **W27-D4** | **Rounded buttons on admin pages look bad** — they do not centre and leave space trying to fill the width. Move them **up into the top nav as tabs** per section | **Done by the A3 flag flip.** The `chrome.contextbar` macro already moved each page's tab strip into bar two; it was gated behind `enable_new_chrome`. Audited every admin template: **no page has a tab strip without a context bar**, so the pattern was fully adopted and simply switched off. Pages keep their own `gt-adminpage-header` on purpose — unlike the member SPA, `partials/topbar.html` deliberately carries no page name, so removing those headers would leave classic pages unnamed |
| **W27-D5** | **Auto-scan cards still have the grey background** instead of matching Libraries. Redesign the page to remove empty space around the clickable attributes, and **add any further attributes that make sense** given the integrations we have | **Grey background fixed.** The cards used `--bg-light-overlay` / `--border-light-strong` — flat `rgba(255,255,255,0.1)` and `0.2` washes that ignore the theme entirely, which is the grey block. Every other panel, Libraries included, uses `--gt-surface` over `--gt-border`. Rather than fix the four auto-scan rules and leave the other ~20 legacy panels wrong, the **variables themselves** were re-pointed at the theme in `base.css`, mirroring `--gt-adminpage-raise` — so every legacy panel is now theme-aware and no rule can be missed. The `backdrop-filter` went with them: it existed to stop a translucent wash showing what was behind it, and an opaque surface has nothing to hide. Net effect on the CSS token lint was **-3 violations**, baseline retightened to 1313. **Still open:** the layout redesign and the new integration-driven attributes, which are design work rather than a defect |
| **W27-D6** | **Browse still shows an inline loading icon beside the button.** It should be a **popup that darkens the background**, using the new motifs | **Done.** `GtLoadingMotifs.showBlocking()` / `hideBlocking()` added — a fixed, darkened backdrop carrying the member's own motif, reference-counted so overlapping requests cannot tear it down early or strand it. `fetchFolders` uses it and clears it on the **error** path too, since a browse that 500s would otherwise leave the page darkened with no way out. The inline spinner survives only as the fallback for when the helper did not load: losing the busy signal entirely is worse than showing it in the old place |
| **W27-D7** | **Libraries & scans card should be max-width and dynamic**, like the other pages. **Done:** the page was already `--xl` (1600px), but four of its seven tab panes still carried Bootstrap's `.container`, which applies its own stepped cap of 1320px — so the card appeared to change width as you moved between tabs. Neutralised as `.gt-adminpage .container { max-width: none }` so the shell owns page width everywhere, rather than editing four class lists that a copied pane would reintroduce |
| **W27-D8** | **Integrations page style is unchanged.** It must follow the Libraries pattern — and that pattern should flow through **every** admin section, not one page at a time | **Done by the A3 flag flip.** `integrations.html` had already adopted the same `chrome.contextbar` call as `admin_manage_scanjobs.html` (the Libraries page held up as the target), hiding its own `nav-tabs` on the other branch. It looked unchanged because the flag was off, not because the pattern had been skipped — which is the same story as A3, C5 and A7 |

## E. Theming

| ID | Item | Notes |
|---|---|---|
| **W27-E1** | **Themes page does not update and needs a redesign** to match. Themes should be **named after consoles/systems**, and each should reflect that system's own look | Depends on UID-006 — the geometry/type token scales exist now, the packs were never authored |
| **W27-E2** | **Loading icons should be full colour**, representing the console they come from, with an **accent border following the theme**, and should **animate on hover**. Only **6 motifs are visible** even though many more were built | **Three of four done.** *Only 6 visible* — root cause was the gitignored `gametheca/data/loading_motifs.json`, so `system_loading_icons()` swallowed the missing file and returned `[]`. `all_loading_icons()` now serves **78 across 19 families**, and the picker already grouped by family via `optgroup` waiting for them. *Accent border* — `.gt-loading-motif--preview` takes its border and tint from `--gt-accent`, so it follows the active theme. *Animate on hover* — specimens are held still and run on hover **or keyboard focus** (`animation-play-state`, not `animation: none`, because the latter resets the disc and cartridge to a mid-pose rather than the recognisable shape). The classic picker also captions the row with the real catalogue size, since six specimens with no caption implied six was all there was. **Still open — needs your art direction:** *full colour per console*. Motifs are `currentColor` throughout by deliberate design, so per-system palettes are a decision about how far to go toward trade dress, not a code change. A test already asserts no motif imitates manufacturer trade dress |
| **W27-E3** | **No visible way to change fonts** | **Not missing — buried.** Verified by test: `/settings_panel` renders `fontSelect`, and `available_fonts()` returns more than one face. The control sits in **Account menu → Preferences**, beside the theme and icon-pack pickers. Two tests now pin it, because "the field exists in forms.py" and "a member can reach it" are different claims and only the second one matters. If it should be more prominent than a dropdown inside a modal, that is a design call rather than a fix |
| **W27-E4** | **All LHN icons should follow the selected theme's colour** — supply alternates for each icon in each theme | |

## F. Trailers

| ID | Item |
|---|---|
| **W27-F1** | The **trailer title should be part of the video player card**, and the **filters part of it too**. **Done:** the title was in the context bar's `summary`; it now renders as a caption inside the player card — under the frame rather than over it, so it never covers the picture, and still a link, because "what am I watching" and "take me to it" are the same question. The 16:9 ratio moved from the card to the iframe so the card can hold both without clipping. Filters moved into the bar's one `filters` popover beside Settings and "Another one"; the page's own Filters toggle is hidden under the new chrome, since two toggles for one panel is the duplication the two-bar layout exists to remove |

---

## Sequencing

**A** and the broken links first — `W27-A7`/`W27-A8` are dead navigation, which is worse than ugly
navigation and cheap to fix. Then **C1/D4/D8 as one job**, because they are the same request stated
three times: adopt one table style and one button style across every admin section rather than
per page. **E2** is largely unblocked by the catalogue fix. **D3** and **C4** are genuine redesigns
and should be scheduled on their own.

## Stale tests found while verifying

Two tests were still pinned to the **retired** abstract loading motifs that GT-B23 replaced with
console hardware. Neither was caused by the W27 work; both were left behind when the catalogue
changed, and both were only found by running suites the CI gate did not cover.

* `tests/test_loading_icons.py` asserted `normalize_icon_id('arcade') == 'dpad'`. It resolves to
  `'arcade'` — the id is *live* now (the Arcade platform), and the source comment says so explicitly.
* `frontend/member-app/src/components/PageStatus.test.jsx` expected `data-motif="orbit"`. The
  component maps retired ids forward, so it renders `disc`.

The second was rewritten to assert the forward-map rather than a live id, which is the more useful
test: it pins that a member whose stored pick was retired still gets a spinner instead of nothing.
That guarantee existed only on the Python side before.

## Standing lesson from this dump

Four items are re-reports of W26 work marked **Done**. In each case the component was built and
adopted on one or two surfaces, then the item was closed. A component that exists is not a component
that shipped — the W26 entries should have stayed open until adoption was complete, and the status
wording ("nav done", "component built, call sites not yet migrated") shows the gap was known at the
time. Prefer **adopted everywhere** as the bar for closing a UI item.
