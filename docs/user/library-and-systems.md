# Library & Systems

## Library

Route: `/library`

- Dense cover grid with filters (platform, status, freshness, etc.).
- **Type-to-search:** a **Search by title** field sits in the Library filter chrome (sticky LHN / Filters drawer). Results update as you type (debounced ~300ms) via browse `name=` (alias `q=`; case-insensitive substring) — no separate Search submit. Empty / whitespace query clears the title filter. Same params on `GET /api/favorites`. **Ctrl+K** still opens the command palette for title jumps + nav.
- **Multi-select:** checkbox (hover / while selecting), **long-press**, or **Shift+click** range → sticky bar with **Select page** (all visible tiles) · Favorite / Unfavorite · **Add to wishlist** · **Play status** (Unplayed / Unfinished / Beaten / Completed / Clear) · Refresh freshness / **Refresh covers** (More; librarian+ · max 20) · Clear · count; batch toasts report `updated`/`queued` / `skipped` / `failed`. **Esc** clears selection. Missing batch routes disable with a title.
- **Page size** (items per page) allowlist: **20 / 50 / 100 / 200 / 250 / 300 / 400 / 500 / 1000** — set in Preferences; browse API rejects other values.
- Tile size comes from your preferences (percent slider in TopNav) and animates smoothly on the grid.
- **Filters** sit in a **sticky left-hand column** on desktop (floats while the grid scrolls). On phones/narrow tablets (≤900px), Filters open as a drawer/sheet (same pattern as the top-nav hamburger).
- Title-card chrome: **menu** + **favorite** stack together in the **top-right** band (menu above, favorite below) · transitional badges (UPDATE / OUT / MISSING / NEW / VR / …) own **top-left** exclusively (no overlap with favorite) · **PLAY** sits under the badge stack when both are present (badges win top-left).
- **VR** is a tile badge in the same top-left stack (not dismissable). It is **not** a Library filter chip — use **More → VR** for the VR catalog.
- **MISSING** (not dismissable) means browse marked the title removed from disk (`path_status=missing` / `path_missing`). Tooltip: files are no longer on disk.
- Title-card badges may also show NEW / UPDATE / freshness OUT/~ / **LANG** / **PATCH** when signals exist, plus **EXP** / **EMU** / **TOOL** when the title is cataloged as Experience / Emulator / Tool (gaming software — not a main-game match). Details shows the same kind as a chip.
- **Signals** chips live **inside** the filter section (UPDATE · OUT/~ · MISSING · NEW · RELEASE · LANG) and toggle the same browse params (`has_updates`, `freshness_behind`, `path_missing`, `new_import`, `recent_release`, `needs_translation`); they persist with other library filters. Legacy `is_vr=1` URL params still apply if present. If the API does not filter `path_missing` yet, the Library page still filters the loaded page client-side.
- Watch/scan may toast “N games added to Library …” (top-right); the same row lands in **Notifications**.
- **Kind** chips (Games · Experiences · Emulators · Tools) multi-select `item_kind=` (comma list; alias `content_kind=`). Empty selection omits the param (all kinds). Same cookie/URL persistence as other library filters. Favorites list accepts the same API param.
- **Multi-select bulk** (Waves 9–12): `POST /api/games/batch/favorite` (`uuids` ≤100, `favorite` true|false) · `POST /api/games/batch/status` (`uuids` ≤100, `status` unplayed|unfinished|beaten|completed|'' to clear) · `POST /api/games/batch/wishlist` (`uuids` ≤50; title from `Game.name`; requires request permission; skips pending dupes) · `POST /api/games/batch/freshness/check` (`uuids` ≤50; API still accepts `only_stale`) · `POST /api/games/batch/refresh_images` (`uuids` ≤20; librarian+; 202 `{ queued, skipped, errors }`) — ACL-scoped, partial success. Sticky bar wires favorite · wishlist · play status · freshness · covers (More); missing routes disable with a title. **Refresh freshness** from the sticky bar **always re-probes** the selection (Wave 10). Partial-success toasts surface `updated`/`queued` / `skipped` / `failed`. Not a DRM download queue; admin library-wide refresh remains `POST /api/admin/freshness/refresh`.
- **Ctrl+K** on Library searches **library titles** first (Search library group); Navigate / More / Account categories remain listed.
- **LANG** filter uses your Preferences → Preferred game language (default `en-US`) and only includes titles whose ROM language is known and mismatched — see [translation-patches.md](translation-patches.md).
- Platform skins tint chrome when you are focused on a single system.

## Systems hub

Route: `/systems`

Browse-by-console hub (Style **B+C**):

- Platforms are grouped by family (Nintendo, Sony, Xbox, Sega, PC & Other, Retro & Classic).
- Family skins include **Switch** under Nintendo, **PSP** under Sony, and **Neo Geo AES** / **Arcade** under Retro & Classic (same leaf enums as create-library). Unknown ids still fall under PC & Other.
- Each tile shows a family mark, game count, and a **Browser** / **Companion** / **Catalog** play-mode badge. Switch / Arcade / Neo Geo AES stay **Catalog** (no fake browser Play).
- Opens Library filtered to that platform (`/api/library_platforms` includes `play_mode`).
- Empty groups mean no scanned games for that family yet — Switch only appears after Ops creates a `SWITCH` library leaf.
- **Set completeness** (optional): after an admin uploads a No-Intro/Redump DAT, tiles show `owned / total · percent` for a region and link to `/systems/completion` for the missing list. Matching prefers file CRC/MD5/SHA1 when hashed, else titles. See [reference-sets.md](../runbooks/reference-sets.md).
- **Export packs** (secondary section below the platform grid — not in the intro): download **ES-DE** `gamelist.xml` (`/api/export/esde`) or **Pegasus** metadata (`/api/export/pegasus`) for external frontends. Optional; you do not need them to browse Systems. Paths are portable (`<library>/…` under configured roots, else basename) — server home/NAS mounts are not leaked. Admins also find the same downloads under Integrations → Export packs.

Play matrix: [browser-play.md](browser-play.md).

## Discover & more

- **Discover** (`/discover`) — shelves / discovery rails.
- **Favorites**, **Collections**, **Wishlist**, **Updates** (freshness inbox + calendar teaser), **Ownership**, **Big Picture**, optional **VR** / **Trailers** / **Calendar** — under primary nav or **More**.
- **Admin** is not a primary TopNav button beside Favorites — admins reach `/admin/dashboard` from the section **context** strip (and Ctrl+K → Admin).
- **Trailers** empty library returns HTTP 200 with a CTA (not an error) — open a title with trailer metadata or ask an admin to enrich covers/videos.

Game details (`/game_details/<uuid>`) is a full member SPA page under the same TopNav: cover, **summary + details in a denser two-column layout** on wide viewports (summary auto-wraps with Show more), **versions** (Default chip · measured size · hide Download + **Missing on disk** when `path_missing` / not downloadable; librarians/admins **Remove missing versions** for orphan cleanup — base-only default, no full GameVersion schema yet), **Extras & DLC** panel (from details `extras[]` — each row shows honest **on-server** when known; versions fallback only if the `extras` key is absent), screenshots (click / double-click + **Fullscreen** lightbox), **trailers/videos** from structured `trailers[].embed_url` (or `video_urls`), **YouTube demo** via `youtube_demo_url` when no trailers, **brand store/catalog link marks**, Play / Steam / companion Install actions, ROM language chips, Social companion dock, and Translations & patches when needed. **Admins** get a **⋮** menu on the **cover tile** (Edit Details / Edit Images / Open path) — same Library card chrome — plus path rows under Details from `full_disk_path` / `server_path`. **Open path** opens **OpenPathModal** — queues companion `open_path` (clipboard fallback when offline or queue fails); it does **not** jump to Auto Scan.

**Details media (Wave 2a shipped):** `GET /api/games/<uuid>/details` includes `video_urls` (parsed list), structured `trailers[]` (`url` · `embed_url` · `provider`), `has_trailers`, `screenshot_count` + honest `screenshots[]`, optional `youtube_demo_url` when no trailer videos, and `extras[]` (`type` dlc/extra/manual/translation_patch · `name` · `on_server` · `uuid`). **Admins only** also receive `full_disk_path` / `server_path`. **PC libraries** associate common `DLC`/`extras` under-game folders (+ sibling `Title DLC` sidecars) on scan — **console/ROM DLC ingest stays deferred** (GM-locked). Extras without a disk presence show `on_server: false` — the UI does not pretend they are on the vault.

**Store / catalog marks (shipped):** Steam · GOG · Epic · PlayStation · Xbox · Amazon/Prime Gaming · Humble · itch.io · EA · Ubisoft · Fandom/Wikia · IGDB · YouTube · Wikipedia · official site · common socials · unknown fallback mark. Icons are **theme-adaptive** (light/dark aurora): PNG silhouettes use CSS `mask-image` + `currentColor` / `--gt-text`; SVG path brands use `fill="currentColor"`. Chip border/hover keeps a brand accent (`--gt-store-color`); Ubisoft is an inline SVG (supplied PNG was solid black / unusable).

**Logo gap:** none for the former human-asset list (itch · Humble · EA · Ubisoft · Xbox · PSN · Amazon · wikia/fandom · unknown). Remaining unmatched store types still open with the unknown mark + plain label.

Related: [getting-started.md](getting-started.md) · [downloads.md](downloads.md) · [translation-patches.md](translation-patches.md) · [preferences-themes.md](preferences-themes.md)
