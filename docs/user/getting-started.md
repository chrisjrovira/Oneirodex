# Getting started (web)

GameTheca is a self-hosted multi-user game library. Members browse and download DRM-free titles your admin has scanned.

**Defaults (operators):** Most product modules ship **on** (`ENABLE_*` in `.env.example`). **OIDC / SSO stays off** until you set `OIDC_ENABLED=true` and enable it under Admin → Integrations. Optional ClamAV: `docker compose --profile clamav up -d` when you want daemon scans in addition to filename heuristics — [settings-modules.md](../admin/settings-modules.md).

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
| More | Collections, wishlist, updates, playtime, calendar, ownership, Big Picture, Activity, Friends window, Chat, Notifications, Report issue, … |
| Admin | Admins only — opens the admin shell |

**Keyboard:** Tab to **Skip to main content** (first focusable control) to jump past the top nav into `#main-content`. Top nav and the **Ctrl/Cmd+K** command palette show a visible focus ring on keyboard focus.

**Command palette:** press **Ctrl+K** (⌘K on Mac) or the top-nav **Search** hint to jump to any primary/More page, Preferences, Admin, or Help. Screenshot backlog for palette / Ops / health probes: [CAPTURE.md](../assets/readme/CAPTURE.md).

If Discover/Library look unstyled, the deploy is missing **`member-app.css`** — ask an admin to rebuild the image.

On phones and narrow tablets (≤900px), the top nav becomes a **hamburger** menu, Chat stacks channels above messages with larger touch targets, library tiles clamp denser, and Library **filters / pagination** stack full-width (your saved tile preference still applies on desktop).

## First things to try

1. Open **Library** and filter by platform or search.
2. Open **Systems** and pick a console family.
3. Open a game → **Download** (streaming zip).
4. Open preferences (account menu) → theme swatch + icon pack + tile size.
5. Optional: **Friends** pill / **More → Friends window**, **Activity** (presence / voice if enabled), **Chat**, or **Report issue**.

More: [library-and-systems.md](library-and-systems.md) · [preferences-themes.md](preferences-themes.md) · [downloads.md](downloads.md) · [social-and-voice.md](social-and-voice.md) · [faq.md](faq.md) · [troubleshooting.md](troubleshooting.md)
