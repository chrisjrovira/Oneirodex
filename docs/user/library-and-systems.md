# Library & Systems

## Library

Route: `/library`

- Dense cover grid with filters (platform, status, freshness, etc.).
- Tile size comes from your preferences (S/M/L/XL) and a quick control on library pages.
- Title-card badges may show NEW / UPDATE / freshness OUT/~ / VR when signals exist.
- Platform skins tint chrome when you are focused on a single system.

## Systems hub

Route: `/systems`

Browse-by-console hub (Style **B+C**):

- Platforms are grouped by family (Nintendo, Sony, Xbox, Sega, PC & Other, Retro & Classic).
- Each tile shows a family mark and opens Library filtered to that platform.
- Uses `/api/library_platforms` — empty groups mean no scanned games for that family yet.

## Discover & more

- **Discover** (`/discover`) — shelves / discovery rails.
- **Favorites**, **Collections**, **Wishlist**, **Updates**, **Ownership**, **Big Picture**, optional **VR** / **Trailers** — under primary nav or **More**.

Game details may still open a hybrid Jinja + React island page; Download and metadata live there.

Related: [getting-started.md](getting-started.md) · [downloads.md](downloads.md)
