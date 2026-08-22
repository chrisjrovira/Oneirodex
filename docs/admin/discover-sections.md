# Discover sections (storefront shelves, zones & events)

> 🎬 Watch: [arranging shelves & scheduling events](../media/video/howto/howto-admin-discover.webm) — [all how-to videos](../media/video/howto/README.md)

Admin → **Discovery Sections Management** (`/admin/discovery_sections`) controls the shelves members see on `/discover`.

## Built-in vs custom

- **Built-in shelves** (Continue Playing, New Arrivals, Most Favorited, libraries, …) can be **reordered** and **hidden** (visibility toggle) but not deleted.
- **Custom zones** (`section_type = 'custom'`) are admin-authored shelves, shown with a **Custom** badge. Add one with **+ Add Zone**; edit/delete with the row's pencil/trash icons.

## Latest Games vs New Library Games

Two shelves that sound alike and answer different questions. They used to be one
shelf answering the second question under the first one's name.

| Identifier | Order | Answers |
|---|---|---|
| `latest_games` | `first_release_date` descending, **future dates excluded** | "What has come out recently, in the world?" |
| `new_library_games` | `date_created` descending | "What has recently appeared *here*?" |

`latest_games` skips unreleased titles on purpose — that is the `upcoming`
shelf's subject, and leaving them in made both shelves open with the same game.
A title with no known release date never appears in `latest_games`; it will
still show under `new_library_games`.

`new_library_games` is seeded for new installs and added to existing ones the
next time init runs (both seeders are additive and skip identifiers that already
exist). If you do not see it, it has not been seeded yet — add it by hand with
identifier `new_library_games`, or re-run init.

## Storefront shelves

Two built-in shelves give `/discover` a storefront feel. Both are derived
**only** from on-box signals — no external recommender, no telemetry leaving the
box.

| Identifier | What it shows |
|---|---|
| `curated_for_you` | Unplayed titles in genres the member already favourites, best-rated first, then most recently added |
| `upcoming` | Titles whose release date is still ahead, soonest first — reuses the dates the Calendar already keeps; no new scraping |

Honesty rules worth knowing before you go looking for a bug:

- `curated_for_you` **excludes anything already favourited**. A "for you" shelf
  that only shows what you already picked is noise.
- A member with no favourites yet has no signal, so the shelf returns nothing
  and is **hidden** rather than padded with a random sample dressed up as a
  recommendation. This is why a fresh account sees fewer shelves.
- `upcoming` is empty on a library of only released games. Also expected.
- Both are ACL-filtered per member like any other shelf.

## Layouts

Each section carries a `layout` controlling its storefront treatment:

| Layout | Use |
|---|---|
| `shelf` | Default — standard horizontal row |
| `hero` | Large feature treatment, for the thing you want seen first |
| `carousel` | Rotating showcase |

## Events (shelves with a schedule)

A shelf given a time window becomes an **event**: it renders only inside that
window and disappears on its own afterwards. Use it for seasonal collections,
a weekend spotlight, or a themed run.

- `starts_at` / `ends_at` are both optional. Set only `starts_at` for "from now
  on", only `ends_at` for "until", or both for a fixed run.
- Timestamps are **UTC**; naive values are read as UTC.
- A shelf must *also* be visible — `is_visible = false` hides it regardless of
  schedule, so the visibility toggle stays a reliable override.
- Outside its window a shelf is simply absent from `/api/discover/sections`;
  members see no placeholder or "coming soon" state.

Schedule via `PUT /admin/api/discovery_sections/<id>/schedule`.

## Zone modes

| Mode | Config | Notes |
|---|---|---|
| **Manual game list** | Textarea of game UUIDs (one per line or comma-separated) | Up to **60** games, shown in the order listed; find a game's UUID on its admin details page |
| **Filter** | `library` \| `platform` \| `genre` + a value | Live query — the shelf grows automatically as matching games are added |

Both modes are ACL-filtered per member on `/discover` (parental / library-access rules apply same as any other shelf) and capped at **8** items per shelf on the member feed.

## API

- `POST /admin/api/discovery_sections` — create a custom zone (`section_type=custom`, `mode`, `game_uuids` or `filter_type`/`filter_value`).
- `PUT /admin/api/discovery_sections/<id>` — rename or reconfigure (mode/filter/list) an existing custom zone.
- `PUT /admin/api/discovery_sections/<id>/schedule` — set `starts_at` / `ends_at` (UTC) and/or `layout`.
- `DELETE /admin/api/discovery_sections/<id>` — remove a custom zone (built-in sections reject delete).
- Reorder / visibility toggle use the existing discovery-sections endpoints (drag handle, switch).
- `GET /api/discover/sections` — what members actually receive; already ACL-filtered and schedule-filtered.

Validation (`gametheca/utils/discovery_zones.py`): unknown platform/library/genre values are rejected with a 400; an empty/all-unmatched manual list is rejected rather than silently rendering an empty shelf.

Related: [libraries-and-scans.md](libraries-and-scans.md) · [library-and-systems.md](../user/library-and-systems.md)
