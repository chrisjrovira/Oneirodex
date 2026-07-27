# Library & Systems

## Library

Route: `/library`

- Dense cover grid with filters (platform, status, freshness, etc.).
- Tile size comes from your preferences (S/M/L/XL) and a quick control on library pages.
- Title-card badges may show NEW / UPDATE / freshness OUT/~ / VR / **LANG** / **PATCH** when signals exist.
- Quick **badge filter chips** (VR · UPDATE · OUT/~ · NEW · RELEASE · LANG) toggle the same signals as browse filters (`is_vr`, `has_updates`, `freshness_behind`, `new_import`, `recent_release`, `needs_translation`); they persist with other library filters.
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

Game details (`/game_details/<uuid>`) is a full member SPA page under the same TopNav: cover, summary, metadata, versions, screenshots (tap to open lightbox), external store links when metadata provides them, Play / Steam / companion Install actions, ROM language chips, Social companion dock, and Translations & patches when needed.

Related: [getting-started.md](getting-started.md) · [downloads.md](downloads.md) · [translation-patches.md](translation-patches.md) · [preferences-themes.md](preferences-themes.md)
