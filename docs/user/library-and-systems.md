# Library & Systems

## Library

Route: `/library`

- Dense cover grid with filters (platform, status, freshness, etc.).
- Tile size comes from your preferences (percent slider in TopNav) and animates smoothly on the grid.
- **Filters** sit in a **sticky left-hand column** on desktop (floats while the grid scrolls). On phones/narrow tablets (≤900px), Filters open as a drawer/sheet (same pattern as the top-nav hamburger).
- Title-card chrome: **menu** top-right · **favorite** bottom-right of the cover · transitional badges (UPDATE / OUT / NEW / VR / …) **top-left** · **PLAY** sits under the badge stack when both are present (badges win top-left).
- **VR** is a tile badge in the same top-left stack (not dismissable). It is **not** a Library filter chip — use **More → VR** for the VR catalog.
- Title-card badges may also show NEW / UPDATE / freshness OUT/~ / **LANG** / **PATCH** when signals exist.
- Quick **badge filter chips** in the LHN (UPDATE · OUT/~ · NEW · RELEASE · LANG) toggle the same signals as browse filters (`has_updates`, `freshness_behind`, `new_import`, `recent_release`, `needs_translation`); they persist with other library filters. Legacy `is_vr=1` URL params still apply if present.
- **LANG** filter uses your Preferences → Preferred game language (default `en-US`) and only includes titles whose ROM language is known and mismatched — see [translation-patches.md](translation-patches.md).
- Platform skins tint chrome when you are focused on a single system.

## Systems hub

Route: `/systems`

Browse-by-console hub (Style **B+C**):

- Platforms are grouped by family (Nintendo, Sony, Xbox, Sega, PC & Other, Retro & Classic).
- Each tile shows a family mark, game count, and a **Browser** / **Companion** / **Catalog** play-mode badge.
- Opens Library filtered to that platform (`/api/library_platforms` includes `play_mode`).
- Empty groups mean no scanned games for that family yet.
- **Set completeness** (optional): after an admin uploads a No-Intro/Redump DAT, tiles show `owned / total · percent` for a region and link to `/systems/completion` for the missing list. Matching prefers file CRC/MD5/SHA1 when hashed, else titles. See [reference-sets.md](../runbooks/reference-sets.md).
- **ES-DE / Pegasus export** (`/api/export/esde`, `/api/export/pegasus`): paths are portable (`<library>/…` under configured roots, else basename) — server home/NAS mounts are not leaked.

Play matrix: [browser-play.md](browser-play.md).

## Discover & more

- **Discover** (`/discover`) — shelves / discovery rails.
- **Favorites**, **Collections**, **Wishlist**, **Updates**, **Ownership**, **Big Picture**, optional **VR** / **Trailers** — under primary nav or **More**.

Game details (`/game_details/<uuid>`) is a full member SPA page under the same TopNav: cover, **full-width summary**, metadata, versions, screenshots (tap to open lightbox), **brand store/catalog link marks** when metadata provides them, Play / Steam / companion Install actions, ROM language chips, Social companion dock, and Translations & patches when needed.

**Store / catalog marks (shipped):** Steam · GOG · Epic · PlayStation · Xbox · Amazon/Prime Gaming · Humble · itch.io · EA · Ubisoft · Fandom/Wikia · IGDB · YouTube · Wikipedia · official site · common socials · unknown fallback mark. Icons are **theme-adaptive** (light/dark aurora): PNG silhouettes use CSS `mask-image` + `currentColor` / `--gt-text`; SVG path brands use `fill="currentColor"`. Chip border/hover keeps a brand accent (`--gt-store-color`); Ubisoft is an inline SVG (supplied PNG was solid black / unusable).

**Logo gap:** none for the former human-asset list (itch · Humble · EA · Ubisoft · Xbox · PSN · Amazon · wikia/fandom · unknown). Remaining unmatched store types still open with the unknown mark + plain label.

Related: [getting-started.md](getting-started.md) · [downloads.md](downloads.md) · [translation-patches.md](translation-patches.md) · [preferences-themes.md](preferences-themes.md)
