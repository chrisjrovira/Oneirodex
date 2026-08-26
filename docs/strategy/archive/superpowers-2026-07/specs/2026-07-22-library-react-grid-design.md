# Library React Grid Island — Design

**Date:** 2026-07-22  
**Status:** Approved for planning (Track 1a)  
**Product sequence (locked):** 1 pagination → 2 ops glance → 3 rename → 4 find/add → 5 settings

## Problem

Flipping Library pages breaks the UI inconsistently (controls, layout, badges/actions) until a full reload. Root cause: **dual markup** — first paint is Jinja SSR (`library_browser.html`); page changes rebuild a divergent tree in `library_pagination.js` (`createGameCardHtml` / popup HTML). Favorites and Discover share the same card pattern risk.

## Goals

- One React-owned card + grid so pagination never drifts from first paint.
- Preserve existing browse/filter APIs, session auth, theme CSS variables, and filter cookie behavior.
- Phase delivery: Library island first; Favorites + Discover reuse the same package.

## Non-goals (Track 1)

- GameTheca rebrand, themes overhaul, advanced/expert metadata, store library import.
- Ops glance, rename UX, find/add picker, settings shell (later tracks).
- Full SPA takeover of sidebar/chrome or client routing across the whole app in 1a.
- New design system; reuse existing dark glass tokens.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Approach | Full client rewrite of the game grid (not JS parity patch, not shared Jinja fragment-only) |
| Scope of surfaces | Library + Favorites + Discover (shared package) |
| Stack | React + Vite |
| Integration | **Hybrid:** Library mount island first (1a); then Favorites/Discover (1b) |
| Failure mode addressed | Inconsistent breakage (controls, layout, content) |

## Architecture — Track 1a (Library)

```
Flask library_browser.html (sidebar, chrome, mount nodes)
        │
        ▼
React island (Vite build → Flask static)
  FilterBar ──► fetch /browse_games + filter APIs
  GameGrid ──► GameCard (single implementation)
  Pagination
```

- New app under e.g. `frontend/library-grid/` (name finalized in plan).
- Build emits hashed JS/CSS into Flask-served static (path finalized in plan; must work with `|theme_asset` or explicit static URL).
- Mount via `data-*` config on the shell: CSRF, `showPlayStatus`, per-page defaults, admin flags, initial filter/cookie snapshot — **no secrets in the bundle**.
- Retire Library use of `library_pagination.js` card/pagination DOM builders once the island is live (helpers that other pages still need stay until 1b).

## Data contracts

Browse JSON must always include fields React cards need:

- Identity: `uuid`, `name`, `cover_url` (stable absolute or app-rooted URL; no hard-coded fragile `/static/` assumptions that diverge from SSR)
- Meta: `genres`, `size` (if shown), `library_uuid` as needed
- Flags: `is_favorite`, `user_status`, `has_local_override`, `is_vr`
- Action support: whatever the current popup already needs (URLs can remain path templates derived from `uuid`)

Filters continue to use existing query params (`library_uuid`, `library_platform`, `igdb_platform`, genre, theme, game_mode, player_perspective, rating, sort, page, per_page). Cookie `libraryFilters` remains for continuity unless a later track replaces it.

## Behavior

- Page/filter change: update React state → fetch → replace grid; **abort** in-flight requests on rapid changes.
- On page change: close menus/popovers; no detached DOM listeners.
- Empty and error states: inline messaging + Retry; keep chrome visible.
- Empty library / no games: preserve admin vs non-admin copy intent from today.
- Favorite / status / popup actions: same capabilities as current Library cards.

## Errors and edge cases

| Case | Handling |
|------|----------|
| Network / 5xx | Inline error + Retry |
| Stale response | Ignore if request id / abort controller superseded |
| Open menu during page flip | Force close before swap |
| Theme asset missing | Fall back to default theme CSS vars already on page |

## Track 1b (after 1a)

- Mount the **same** `GameCard` / `GameGrid` on Favorites and Discover.
- Thinner data adapters (section-specific endpoints); no second card implementation.
- Remove remaining duplicated Jinja/JS card HTML for those pages when mounts ship.

## Testing

- **Unit:** `GameCard` renders L/VR badges, favorite, status from fixture props.
- **Integration:** mock `/browse_games`; page 1→2→1 does not duplicate controls or leave orphan menus.
- **Manual:** Apply/Clear filters, cookie restore, favorite toggle, status change, pagination stress, hard refresh still boots island.

## Success criteria

1. Rapid pagination and filter changes never require a full page reload to “fix” the grid.
2. Card chrome (badges, menus, status, covers) is identical in structure across pages of results.
3. Library island ships without regressing filter APIs or auth.
4. 1b can mount without rewriting cards.

## Follow-on tracks (not this spec)

2. Ops glance (server/network/issues)  
3. Single + bulk rename UX  
4. Find/add with library picker  
5. Settings shell overhaul  
