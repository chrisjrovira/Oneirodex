# UI refresh — two-bar chrome, one look everywhere

**Date:** 2026-08-06 · **Status:** planned, Option B approved · **Supersedes the
chrome sections of** [ui.md](ui.md) (that doc stays as the record of how we got here)

## The ask

> *"get rid of all header information on a page and build a second title bar
> under our main one to have all the dropdowns in … more"* — and make library
> and admin look like one product.

## What is wrong today, specifically

Not opinion — measured against the current tree:

| Problem | Evidence |
|---|---|
| Every page pays for a header | `gt-page-header` appears in **22 files**. Each costs an `h1` plus a lede: roughly 90px of vertical space before any content |
| Two overflow menus compete | Bar one has a **More** dropdown with ~14 destinations (Collections, News, Wishlist, Updates, Acquire, Playtime, Activity, Friends, Chat, Notifications, Report, Calendar, Ownership, Big Picture) while pages carry their own action rows |
| Controls have no home | Library filters live in a left rail; admin filters live inline; Systems has neither. Same job, three treatments |
| Three UI idioms | Member SPA, admin SPA, and Jinja admin. `DataTable` unified tables; the chrome around them never converged |

## The shape — Option B

Two bars, and nothing above the content but those two.

**Bar one — identity and destination.** Mark, primary sections, global search
(`⌘K`), account. Slim, unchanging, never page-specific.

**Bar two — context.** Everything the current page can do:

* **Left:** a segmented control for sibling views (`All · Games · Soft titles ·
  Utilities`; admin: `Libraries · Scans · Unmatched · Images`). This is where the
  page title used to be — the name becomes a *switcher*, which is strictly more
  useful than a label.
* **Right:** a single **Filters** popover carrying a count, then one **⋯ More**
  for overflow actions.

The left filter rail goes away. The grid gets the width back — six tiles per row
where five fit before, at the same tile size.

### Why B over the pill-per-control variant

Browsing wants pixels for cover art and shallow filtering. A row of eight
dropdown pills is the right answer when eight controls are all in play at once,
which is an admin problem, not a browsing one. One popover holding the whole
filter set is fewer things on screen and — crucially — the same component in
admin, where it can hold more without redesigning the bar.

### Why admin gets B too, not the pill variant

The stated requirement is that library and admin look the same. Giving admin a
different bar-two pattern would defeat that on day one. Admin's extra density
goes *inside* the Filters popover and the segmented control, not into new chrome.

## Decisions taken (defaults, reversible)

Three questions were raised with the mockups and not answered; taking the
defaults rather than blocking:

1. **The filter drawer is rebuilt, not adjusted.** It was reworked earlier this
   same day into an edge tab fused to the panel. Option B deletes that panel.
   Calling that out plainly: it is the second rebuild of one component in a day.
   The edge-tab work is not wasted — it established the collapse behaviour and
   the scroll-container fix — but the panel itself goes.
2. **"More" moves down.** The ~14 destinations become siblings in bar two's
   segmented control, grouped by section. Bar one keeps ~5 primary destinations
   plus account. **One overflow menu, not two.**
3. **Shared markup before migration.** Bar one and bar two ship as a component
   pair rendered by *both* the React shells and `base_admin.html`. Days, not the
   weeks a full React port would take. The page bodies converge later.

## Slices

Each lands independently and leaves the app shippable.

| # | Slice | Touches | Done when |
|---|---|---|---|
| **UIR-1** | `AppBar` + `ContextBar` components and tokens | new `chrome/` components, `gt-tokens.css` | Both render in member SPA behind a flag; vitest covers segmented + popover |
| **UIR-2** | Library adopts bar two; left rail retired | `LibraryApp`, `FilterBar`, `libraryFilters.css` | Grid full-width; all current filters reachable in the popover; existing filter tests pass |
| **UIR-3** | Retire page titles (**revised** — see below) | one CSS rule + a marker attribute | Titles and ledes gone under v2; header actions still on screen |
| **UIR-4** | Bar two in Jinja admin | `base_admin.html`, shared CSS | `/libraries`, `/scan_management` show the same two bars as `/library` |
| **UIR-5** | Nav consolidation | `navConfig.js`, `TopNav` | One overflow; `⌘K` still reaches everything |
| **UIR-6** | Re-capture | `scripts/capture_docs_media.py`, how-to videos | Screenshots and videos show the new chrome |

## Risks worth naming

* **UIR-3 was mis-scoped and is now corrected.** The plan said "strip
  `gt-page-header` from 22 files". Counting first showed **16 of 18** page
  headers also carry buttons, links or selects, so deleting the block would
  have removed working controls, not just chrome.
  A page header is two things stacked: identity (`h1` + lede) and actions. Only
  identity is redundant once bar two names the section, so **only identity is
  hidden** — one rule scoped to `:root[data-chrome='v2']`, zero page edits, and
  nothing to miss. Moving each page's actions into the context bar's actions
  slot is genuinely per-page work and is **not** done: those actions still sit
  where they were, just without a heading above them.
* **Admin Jinja and React must not drift again.** If bar two is copied rather
  than shared, this whole exercise repeats in three months. UIR-4 is the slice
  that decides whether the refresh holds.
* **Filters in a popover can hide state.** The count badge is not decoration —
  it is the only thing preventing "why is my library empty" support tickets.
* **Capture must follow.** Every screenshot and all ten how-to videos show the
  current chrome. They are stale the moment UIR-2 lands.

## Not in this slice

Icon/colour theming, tile design, the system backdrop, and fonts are all
unchanged — this is layout and information architecture only. Changing both at
once would make it impossible to tell which change caused a regression.
