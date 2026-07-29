# Discover sections (custom zones)

Admin → **Discovery Sections Management** (`/admin/discovery_sections`) controls the shelves members see on `/discover`.

## Built-in vs custom

- **Built-in shelves** (Continue Playing, New Arrivals, Most Favorited, libraries, …) can be **reordered** and **hidden** (visibility toggle) but not deleted.
- **Custom zones** (`section_type = 'custom'`) are admin-authored shelves, shown with a **Custom** badge. Add one with **+ Add Zone**; edit/delete with the row's pencil/trash icons.

## Zone modes

| Mode | Config | Notes |
|---|---|---|
| **Manual game list** | Textarea of game UUIDs (one per line or comma-separated) | Up to **60** games, shown in the order listed; find a game's UUID on its admin details page |
| **Filter** | `library` \| `platform` \| `genre` + a value | Live query — the shelf grows automatically as matching games are added |

Both modes are ACL-filtered per member on `/discover` (parental / library-access rules apply same as any other shelf) and capped at **8** items per shelf on the member feed.

## API

- `POST /admin/api/discovery_sections` — create a custom zone (`section_type=custom`, `mode`, `game_uuids` or `filter_type`/`filter_value`).
- `PUT /admin/api/discovery_sections/<id>` — rename or reconfigure (mode/filter/list) an existing custom zone.
- `DELETE /admin/api/discovery_sections/<id>` — remove a custom zone (built-in sections reject delete).
- Reorder / visibility toggle use the existing discovery-sections endpoints (drag handle, switch).

Validation (`gametheca/utils/discovery_zones.py`): unknown platform/library/genre values are rejected with a 400; an empty/all-unmatched manual list is rejected rather than silently rendering an empty shelf.

Related: [libraries-and-scans.md](libraries-and-scans.md) · [library-and-systems.md](../user/library-and-systems.md)
