# Getting started (web)

GameTheca is a self-hosted multi-user game library. Members browse and download DRM-free titles your admin has scanned.

## Sign in

1. Open the server URL (default port **5006**).
2. Sign in with the account your admin invited, or local credentials from first-run setup.
3. Optional SSO (Authentik/OIDC) if the admin enabled it — same login page when configured.

## Member chrome

After login you land in the **member SPA** with a **top nav** (no left sidebar):

| Link | What it is |
|---|---|
| Discover | Shelves / discovery |
| Library | Full grid + filters |
| Systems | Browse by console / family |
| Downloads | Queue and history |
| Favorites | Your favorites |
| More | Collections, wishlist, updates, playtime, calendar, ownership, Big Picture, … |
| Admin | Admins only — opens the admin shell |

If Discover/Library look unstyled, the deploy is missing **`member-app.css`** — ask an admin to rebuild the image.

## First things to try

1. Open **Library** and filter by platform or search.
2. Open **Systems** and pick a console family.
3. Open a game → **Download** (streaming zip).
4. Open preferences (account menu) → theme swatch + tile size.

More: [library-and-systems.md](library-and-systems.md) · [preferences-themes.md](preferences-themes.md) · [downloads.md](downloads.md)
