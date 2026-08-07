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
2. **"More" stays in bar one, grouped — decision reversed.** The original call
   was to fold those destinations into bar two and keep "one overflow, not
   two". Implementing it showed why that is wrong: bar two's segmented control
   holds *sibling views of the current section*, and these are **destinations,
   not page actions**. A seventeen-segment strip would be worse than the flat
   list it replaced.
   The rule the two bars actually encode is cleaner than "one overflow":
   **bar one answers "where do I go", bar two answers "what can I do here".**
   Two overflows for two different questions is right; two overflows for the
   same question was the thing worth fixing. So More keeps its place and gains
   four labelled groups — Library, Social, Play, Support.
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
| **UIR-4** | Bar two in Jinja admin | `partials/chrome.html`, `base_admin.html` | `/libraries` renders the same bar two as `/library`; parity pinned by tests |
| **UIR-5** | Group the More menu (**revised**) | `navConfig.js`, `TopNav`, `CommandPalette` | Four labelled groups; no destination lost; `⌘K` still reaches everything |
| **UIR-6** | Re-capture | `scripts/capture_docs_media.py`, how-to videos | Screenshots and videos show the new chrome |
| **UIR-7** | Page actions into bar two, page by page | React: `NewsPage`, `NotificationsPage`, `CalendarPage`. Jinja: libraries & scans, library tools, integrations | The page's own tab strip is gone; its views are bar two's segments and its actions are bar two's actions |

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
* **Admin Jinja and React must not drift again.** The two SPA builds cannot
  import from each other, so the shared artifact is the **stylesheet**: both
  renderers emit the same class names against one `gt-appbar.css`. The markup
  is therefore duplicated in two idioms — a Jinja macro and a React component —
  which is the honest cost of a hybrid app. `tests/test_chrome_parity.py`
  pins it: every context-bar class must exist in the stylesheet *and* in both
  renderers, every shell must link the CSS, and `gt-appbar.css` must never join
  `PRESET_MANAGED_FILES` — that list is the opt-out from theme sync, so a file
  on it freezes at whatever it looked like the day a preset was installed.
  (An earlier version of that last check asserted no installed theme held a
  copy of the file at all. Wrong: `sync_preset_themes` **overwrites** drifted
  copies on boot, so every preset holding one is the system working. The check
  failed on any real install and was testing the generated tree instead of the
  invariant.)
* **Filters in a popover can hide state.** The count badge is not decoration —
  it is the only thing preventing "why is my library empty" support tickets.
* **Capture must follow.** Every screenshot and all ten how-to videos show the
  current chrome. They are stale the moment UIR-2 lands.
* **Looking at the captures is the point.** Three defects reached the
  screenshot and none of them reached a test first: a "Filters 2" badge on an
  untouched library (it was counting the sort keys, which narrow nothing), the
  leftmost tile clipped by a padding I had zeroed, and bar one still carrying
  breadcrumbs — "Library" and "Library home" side by side — after bar two
  started naming the section. Each is now covered by a test, but capture is
  what surfaced them.

## UIR-7 — moving page actions in

UIR-3 hid page *identity* and left page *actions* where they were. Moving them
is per-page work; this is how it goes, and where it has got to.

**Start with the pages that had their own tab strip.** News, Notifications and
Calendar each shipped a hand-rolled row of view buttons directly under the
heading — which is bar two, built three times, in three different styles. Those
convert cleanly and delete markup rather than shuffling it. Pages whose header
holds a single button are a much weaker case and are not done yet.

**Both renderings stay in one list.** Each converted page defines its views once
(`NEWS_VIEWS`, `NOTIFICATION_VIEWS`, the existing `VIEWS`) and both the old
header strip and bar two's segmented control map over it. The flag is still
opt-in, so a page must render correctly both ways until it is not; a duplicated
list would drift the moment a section is added.

**What each page gained:**

| Page | Views | Actions / state |
|---|---|---|
| News | All · Admins · Free now · Headlines, each with a live count | — |
| Notifications | All · Unread | "Mark all read"; unread count moves from the lede into the summary slot |
| Calendar | List · Month · Agenda | The two window selects become a Filters popover, badged only when the window differs from its default; the window itself is stated in the open, because two selects' worth of state must not vanish when collapsed |
| Help | — | Expand all · Collapse all · Report an issue, with "*n* of *m* open" as the summary. Report an issue stays a link: turning it into a button would quietly kill middle-click and open-in-new-tab |
| Collections | — | The create form moves behind a **New collection** popover. A permanently visible three-field form above the list is exactly the furniture bar two exists to absorb — and the empty state had to change with it, since "create your first shelf with the form above" stops being true |

Counts are omitted while a feed is still loading. A "0" beside *Free now* reads
as "there is nothing free" when the truth is that the request has not returned.

### Admin bar one is now the same bar, not a lookalike

`AdminTopNav` was structurally the member `AppBar` — brand, destinations,
actions — with its own class names and its own block in `styles.css`. That is
why the two could never match however carefully each was styled: they were two
implementations of one thing.

Under v2 it emits the shared `gt-appbar` classes instead and takes its
appearance from the `gt-appbar.css` both shells already link. Same trick as
UIR-4: the stylesheet is the shared artifact, so this costs no cross-build
import. The flag is read straight off `document.documentElement.dataset.chrome`
rather than adding shell-config plumbing to admin-app — that attribute is
already the single source of truth the CSS keys on.

Its breadcrumb buttons (Dashboard, "… home") go the same way as the member
ones, for the same reason: bar two names the section. Library and Log out stay,
because both leave the admin app and nothing else offers them.

### Admin's React pages were inheriting the marker and none of the effect

`base_admin.html` has set `data-chrome="v2"` since UIR-4, so the admin SPA was
already carrying the marker — but the retirement rule only matched
`.gt-page-header`, which admin-app does not use. The result was the exact
mismatch this refresh exists to end: member pages lost their headings while
every admin `h1` stayed put.

admin-app wraps each page in `.gt-admin-page` with the heading and lede as
direct children, so two more selectors cover all eleven pages plus the shared
`Page` component, with no JSX edits. It is also a simpler case than the member
one: here the heading is a sibling of the page content rather than sharing a
block with the page's controls, so hiding it cannot take a button with it.

### The Jinja half, and what nearly broke silently

Three admin pages had the same shape and converted the same way: **libraries &
scans**, **library tools**, **integrations**. All three keep their views as
panes of one document, so the macro gained `data_toggle='tab'` — turning
in-page tabs into full page loads to gain a prettier strip would be a straight
downgrade.

That is where the interesting part is. Bootstrap's tab plugin has three
contracts, all checked against the vendored 5.3.2 bundle and then **verified in
a browser**, because every failure here is silent — the strip renders perfectly
and simply does nothing:

1. It binds via `closest('.list-group, .nav, [role="tablist"]')` and no-ops
   when that misses. A `role="group"` strip switches nothing.
2. `_getActiveElem()` finds the pane to hide by looking for **its own**
   `active` class. Mark selection with only our `is-active` and the first click
   shows the new pane without hiding the old one.
3. It moves `active` and never touches `is-active`. So in tab mode selection is
   marked with `active` *instead of* `is-active`, and the stylesheet matches
   both — otherwise the highlight stays welded to whichever segment rendered
   first while the panes change underneath it.

The browser probe is what caught (3): (1) and (2) were fixed from reading the
bundle, the page then switched panes correctly, and the highlight still did not
move.

Two page-specific dependencies also had to survive:

* **Image queue** lazy-loads on `shown.bs.tab` via `getElementById('imageQueue-tab')`.
  Bar two's segment has no such id, so the lookup now goes by what it points
  at — which works for both strips.
* **Integrations** restores the open tab from the URL fragment by id, and every
  pane's `aria-labelledby` names a trigger. So the macro takes an optional
  anchor id per view (a 4th tuple element) and an id for the strip itself, and
  its controller reads `data-bs-target` *or* `href` and no longer says
  `button` in its selector.

## Not in this slice

Icon/colour theming, tile design, the system backdrop, and fonts are all
unchanged — this is layout and information architecture only. Changing both at
once would make it impossible to tell which change caused a regression.
