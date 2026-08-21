# Library & Systems

> 🎬 Watch: [browsing the library](../media/video/howto/howto-library.webm) · [a game page](../media/video/howto/howto-game-details.webm) · [Discover](../media/video/howto/howto-discover.webm) · [Systems](../media/video/howto/howto-systems.webm) — [all how-to videos](../media/video/howto/README.md)

## Library

Route: `/library`

- Dense cover grid with filters (platform, status, freshness, etc.).
- **One tile per title, not per copy.** A title you hold on several systems is a single tile. The platform chip names **the latest system it was released on** and counts the rest: a game on NES, GBA and SNES reads `GBA +2`. Filtered to a system, the chip names *that* system instead — the same game under the NES filter reads `NES +2`, because that is the copy you are looking at. The other copies are reachable from the tile's **Preview → Available on**, with a launcher per emulator core; they are not separate tiles. Titles pair on their normalised name, because `igdb_id` and `slug` are unique per row and so cannot be shared across systems. Page counts count titles, so pages stay full.
- **Type-to-search:** a **Search by title** field sits in the Library filter chrome (sticky LHN / Filters drawer). Results update as you type (debounced ~300ms) via browse `name=` (alias `q=`; case-insensitive substring) — no separate Search submit. Empty / whitespace query clears the title filter. Same params on `GET /api/favorites`. **Ctrl+K** still opens the command palette for title jumps + nav.
- **Multi-select:** checkbox (**bottom-right** of a tile, above the badges there), **long-press**, or **Shift+click** range → sticky bar with **Select page** (all visible tiles) · Favorite / Unfavorite · **Add to wishlist** · **Play status** (Unplayed / Unfinished / Beaten / Completed / Clear) · Refresh freshness / **Refresh covers** (More; librarian+ · max 20) · Clear · count; batch toasts report `updated`/`queued` / `skipped` / `failed`. **Esc** clears selection. Missing batch routes disable with a title.
- **Page size** (items per page) allowlist: **20 / 50 / 100 / 200 / 250 / 300 / 400 / 500 / 1000** — set in Preferences; browse API rejects other values.
- Tile size comes from your preferences (percent slider in the top bar) and animates smoothly on the grid. The slider is **collapsed to a small four-dot mark** until you hover it or tab to it, then opens; the title count reads immediately **before** it, so the number comes first and the control that changes it sits beside it. Tile chrome — corner controls, badges, platform chip, the Preview pill — is sized **from the tile**, so it scales with the slider instead of staying one fixed size. Hover lifts a tile **15%** at every size, without reflowing the grid.
- **One tile menu at a time** — opening a menu on another tile closes the first, rather than leaving two on screen.
- **Tile controls** (favourite · play status · menu, top to bottom) appear **on hover**. A favourited title keeps its heart visible with the pointer elsewhere, so you can see what you have favourited while scanning. Touch devices show all three, since there is no hover to reveal them.
- Hovering a tile **grows it 25%** and drops its resting outline for an accent glow. With OS reduced-motion on you still get the size change — only the animated travel is suppressed. The enlarged tile paints over its neighbours in full: neighbouring badges no longer sit on top of it. A tile grows **downward and inward** — never up past the top bar, and never off the side — so its badges stay on screen wherever it sits in the grid. Opening the tile's menu or its play-status dropdown no longer shrinks the tile back: the panel divides the scale out for itself, so it reads at its true size while the tile you are still pointing at stays enlarged.
- **Tile menu**: themed, every row the same shape, with **Report an issue** at the bottom (it opens the report form already filled in with the title). There is no "Play demo" item — GameTheca ships no demo feature. The menu opens at full size over the grid: the tile drops its hover enlargement while a menu is open, so the menu is never rendered a quarter too large or clipped to the cover.
- **A greyed-out Play** is now a button, not a dead label. Press it and it says why browser play is unavailable for that title (missing firmware, unsupported archive) and offers **Browser play requirements**, **Report an issue**, and — for admins — **Emulator profiles**. The reason used to live only in a mouse-over tooltip, which never appeared on a touch screen.
- **Pagination**: per-page on the left, First/Previous/Next/Last as one segmented control in the middle, page indicator (`Page 3 of 12`) on the right.
- A cover that downloads badly can no longer distort its row — tiles are pinned to 3:4 and crop the overflow.
- **Preview** sits in the middle of a tile on hover: a larger popup with the cover, blurb, **Released** and **Added** dates side by side, **Steam / catalog links** where the title has them, and, at the bottom, **Available on** — every system in your libraries that holds this title, with a **Play** button per emulator core for each. Copies that cannot be launched are still listed, with the reason (missing firmware, catalog-only, no browser core). Backed by `GET /api/games/<uuid>/editions`, ACL-scoped like browse; titles are paired by name because `igdb_id` and `slug` are unique per row and so cannot be shared across systems.
- **Covers with no art** are drawn rather than fetched: themed panel, the GameTheca mark in your accent colour, and the game's title as real text — legible at any tile size, unlike the old baked-in placeholder image.
- **Filters** in the two-bar chrome open from a **Filters** button next to the rail toggle, at the left of the top bar. The panel opens **downward and to the right** from that button, so it never sits over the rail or runs off the left edge when the rail is collapsed. It scrolls only when the window genuinely cannot fit the whole list — on a tall screen every filter is visible at once. The panel is one box — no separate popover header repeating the word "Filters" — and **Apply · Clear · Done** sit together in its own button row.
- **Filters** sit in a **sticky left-hand column** on desktop (floats while the grid scrolls). Desktop collapse (UID-002): the aside shrinks to a slim **chevron rail** so the cover grid **reflows** into the freed width — not opacity-only hide. Preference persists in `localStorage` (`gt.library.filtersVisible`); chevron again restores the full panel. On phones/narrow tablets (≤900px), Filters open as a drawer/sheet (same pattern as the top-nav hamburger); the desktop collapse rail does not apply.
- Title-card chrome (UID-001): **four-corner** placement — **favorite** + **play status** + **menu** stack **top-right** (hover-reveal; a favourited heart persists) · the **select** checkbox sits **bottom-right above the badges** there (it used to be a fourth button in the top-right stack, where it appeared on every tile the moment one was selected and read as a glitch) · transitional badges (UPDATE / MISSING / NEW / VR / …) **top-left** (no overlap with favorite) · platform chip **bottom-left** when present · kind / LANG / OWNED etc. prefer remaining corners. Corner controls reveal on hover; on touch, where there is no hover, they rest visible. All badges share one height, padding and font size. **PLAY** sits under the top-left badge stack when both are present (badges win top-left). **Occupied corners only** — no empty reserved slots. **Rounded-square** chrome on badges, +N overflow, platform chip, hamburger, favorite, and status. Post-deploy: rebuild member SPA dist **and** **Reset Themes** (theme volume CSS copies of badge chrome).
- **VR** is a tile badge in the same top-left stack (not dismissable). It is **not** a Library filter chip — use **More → VR** for the VR catalog.
- **MISSING** (not dismissable) means browse marked the title removed from disk (`path_status=missing` / `path_missing`). Tooltip: files are no longer on disk.
- Title-card badges may also show NEW / UPDATE / **LANG** / **PATCH** when signals exist, plus **EXP** / **EMU** / **TOOL** when the title is cataloged as Soft title / Emulator / Utility (gaming software — not a main-game match; API tokens `experience`|`emulator`|`tool`). Details shows the same kind as a chip. **No OUT / ~ / RELEASE** on tiles (UID-001); RELEASE LHN chip retired; UPDATE alone covers freshness-behind.
- **Signals** chips live **inside** the filter section (UPDATE · MISSING · NEW · LANG) and toggle the same browse params (`has_updates`, `path_missing`, `new_import`, `needs_translation`); they persist with other library filters. Legacy URL params `freshness_behind` / `recent_release` / `is_vr=1` still parse when present but have no chip. If the API does not filter `path_missing` yet, the Library page still filters the loaded page client-side.
- Watch/scan may toast “N games added to Library …” (top-right); the same row lands in **Notifications**.
- **Kind** chips (Games · Soft titles · Emulators · Utilities) multi-select `item_kind=` (comma list; alias `content_kind=`). Empty selection omits the param (all kinds). Same cookie/URL persistence as other library filters. Favorites list accepts the same API param. API/DB tokens stay `experience` / `tool`.
- **Multi-select bulk** (Waves 9–12): `POST /api/games/batch/favorite` (`uuids` ≤100, `favorite` true|false) · `POST /api/games/batch/status` (`uuids` ≤100, `status` unplayed|unfinished|beaten|completed|'' to clear) · `POST /api/games/batch/wishlist` (`uuids` ≤50; title from `Game.name`; requires request permission; skips pending dupes) · `POST /api/games/batch/freshness/check` (`uuids` ≤50; API still accepts `only_stale`) · `POST /api/games/batch/refresh_images` (`uuids` ≤20; librarian+; 202 `{ queued, skipped, errors }`) — ACL-scoped, partial success. Sticky bar wires favorite · wishlist · play status · freshness · covers (More); missing routes disable with a title. **Refresh freshness** from the sticky bar **always re-probes** the selection (Wave 10). Partial-success toasts surface `updated`/`queued` / `skipped` / `failed`. Not a DRM download queue; admin library-wide refresh remains `POST /api/admin/freshness/refresh`.
- **Ctrl+K** on Library searches **library titles** first (Search library group); Navigate / More / Account categories remain listed.
- **LANG** filter uses your Preferences → Preferred game language (default `en-US`) and only includes titles whose ROM language is known and mismatched — see [translation-patches.md](translation-patches.md). Console ROM peel (**BE-DET-4**) persists path/tag `rom_region` / `rom_languages` when known so LANG honesty has something to compare against after scan/identify (not a Class A catalog). Peel covers cart + disc/late leaves (incl. Saturn / Dreamcast / Neo Geo CD · `.gdi`/`.cdi`) when those libraries are scanned — threshold stays high.
- **Multi-disc sets (BE-DET-5):** scan/identify can collapse `(Disc|Disk|CD N)` siblings into one Library title with disc extras; browse/details may expose `is_multi_disc` and `discs[]` for honesty. Member SPA disc chips are still a later UI slice — API fields may appear before chips ship.
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

- **Discover** (`/discover`) — storefront shelves: **Curated for you** (unplayed titles in genres you already favourite), **Upcoming** (releases still ahead), plus whatever shelves your admin has arranged. Some shelves are **timed events** and appear only during their run. A shelf with nothing honest to show is hidden rather than padded — a brand-new account with no favourites yet will see fewer shelves until it has something to go on.
- **Favorites**, **Collections**, **Wishlist**, **Updates** (freshness inbox + calendar teaser), **Ownership**, **Big Picture**, optional **VR** / **Trailers** / **Calendar** — under primary nav or **More**.
- **Admin** is not a primary TopNav button beside Favorites — admins reach `/admin/dashboard` from the section **context** strip (and Ctrl+K → Admin).
- **Trailers** empty library returns HTTP 200 with a CTA (not an error) — open a title with trailer metadata or ask an admin to enrich covers/videos.

Game details (`/game_details/<uuid>`) is a full member SPA page under the same TopNav: cover, **summary + details in a denser two-column layout** on wide viewports (summary auto-wraps with Show more), **versions** (Default chip · measured size · hide Download + **Missing on disk** when `path_missing` / not downloadable; librarians/admins **Remove missing versions** for orphan cleanup — base-only default, no full GameVersion schema yet), **Extras & DLC** panel (from details `extras[]` — each row shows honest **on-server** when known; versions fallback only if the `extras` key is absent), screenshots (click / double-click + **Fullscreen** lightbox), **trailers/videos** from structured `trailers[].embed_url` (or `video_urls`), **YouTube demo** via `youtube_demo_url` when no trailers, **brand store/catalog link marks**, Play / Steam / companion Install actions, ROM language chips, Social companion dock, and Translations & patches when needed. **Admins** get a **⋮** menu on the **cover tile** (Edit Details / Edit Images / Open path) — same Library card chrome — plus path rows under Details from `full_disk_path` / `server_path`. **Open path** opens **OpenPathModal** — queues companion `open_path` (clipboard fallback when offline or queue fails); it does **not** jump to Auto Scan.

**Details media (Wave 2a shipped):** `GET /api/games/<uuid>/details` includes `video_urls` (parsed list), structured `trailers[]` (`url` · `embed_url` · `provider`), `has_trailers`, `screenshot_count` + honest `screenshots[]`, optional `youtube_demo_url` when no trailer videos, and `extras[]` (`type` dlc/extra/manual/translation_patch · `name` · `on_server` · `uuid`). **Admins only** also receive `full_disk_path` / `server_path`. **PC libraries** associate common `DLC`/`extras` under-game folders (+ sibling `Title DLC` sidecars) on scan — **console/ROM DLC ingest stays deferred** (GM-locked). Extras without a disk presence show `on_server: false` — the UI does not pretend they are on the vault.

**Store / catalog marks (shipped):** Steam · GOG · Epic · PlayStation · Xbox · Amazon/Prime Gaming · Humble · itch.io · EA · Ubisoft · Fandom/Wikia · IGDB · YouTube · Wikipedia · official site · common socials · unknown fallback mark. Icons are **theme-adaptive** (light/dark aurora): PNG silhouettes use CSS `mask-image` + `currentColor` / `--gt-text`; SVG path brands use `fill="currentColor"`. Chip border/hover keeps a brand accent (`--gt-store-color`); Ubisoft is an inline SVG (supplied PNG was solid black / unusable).

**Logo gap:** none for the former human-asset list (itch · Humble · EA · Ubisoft · Xbox · PSN · Amazon · wikia/fandom · unknown). Remaining unmatched store types still open with the unknown mark + plain label.

## Related media

Above the screenshots, a game can carry the **media connected to it** —
adaptations, tie-ins, novelisations, documentaries, and soundtracks. Click any
card for a popup with the detail and a link out to where that thing legitimately
lives.

- Kinds: film · TV series · anime · book · comic · soundtrack/music · podcast.
- Relations: adaptation · tie-in · soundtrack · novelisation · documentary ·
  inspired by.
- Only the kinds actually present are shown — you never get a row of empty
  categories, and a game with no related media shows **no section at all**.
- Librarians and admins add entries; every member can read them.

**This is context, not a tracker.** There is deliberately nothing to mark
watched, rate, or progress — those fields do not exist on the model. Links must
point at a store or streaming page; anything download-shaped is refused outright.

API: `GET`/`POST /api/games/<uuid>/related_media` ·
`DELETE /api/games/<uuid>/related_media/<id>`.

Related: [getting-started.md](getting-started.md) · [downloads.md](downloads.md) · [translation-patches.md](translation-patches.md) · [preferences-themes.md](preferences-themes.md)
