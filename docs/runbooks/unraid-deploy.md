# Unraid deploy — GameTheca

## Prerequisites

- Unraid 6.12+ with Docker
- A share for game files (read-only mount into the container)
- A writable share for library data (covers, themes, zips)
- Postgres (compose `db` service or external)

## Required environment

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | **Yes** | Must not be the example placeholder. Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL` | Yes | e.g. `postgresql://user:pass@db:5432/gametheca` |
| `DATA_FOLDER_WAREZ` | Yes | Inside container, usually `/storage` |
| `POSTGRES_*` | If using bundled db | Match `DATABASE_URL` |

## Volume mounts

| Host | Container | Mode |
|---|---|---|
| Games share | `/storage` | **ro** |
| Appdata library | `/app/gametheca/static/library` | rw |

## Image

`chrisjrovira/gametheca:latest` (or build from this repo). The image includes `bash` for `entrypoint.sh`.

## First boot checklist

1. Set a real `SECRET_KEY`
2. Start container; watch logs until Postgres is ready
3. Open `http://<unraid-ip>:5006`
4. Complete setup wizard (admin → SMTP optional → IGDB)
5. Admin → Themes → **Reset Default Themes** (installs presets; regenerates at `GENERATOR_VERSION` 6)
6. Add a library pointing at `/storage/...`
7. Run a small scan before a full library scan

## Theme / JS not updating?

Library volume persists old theme files. After every code deploy:

1. `docker compose build --no-cache && docker compose up -d`
2. Watch logs for theme sync / `[OK] Default theme` / token presence
3. Admin → Themes → **Reset Default Themes** (or delete `themes/default` under the library volume and restart)

Also confirm `member-app.css` loads in the browser (View Source on Discover/Library). Missing CSS means a rebuild is required — the SPA chrome will look unstyled without it.

## Compose Manager paths

- External ENV File Path: `/mnt/user/isos/gametheca/.env`
- Indirect Compose File: `/mnt/user/isos/gametheca/docker-compose.yml`
- Indirect Path: leave empty

## Smoke checklist (Style B+C + Systems + Wave 5/6)

1. First-boot logs show theme tokens OK (or Reset Default Themes after `GENERATOR_VERSION` 6)
2. Discover/Library: View Source includes **`member-app.css`** and `member-app.js`
3. Admin pages: View Source includes **`admin-app.css`** and `admin-app.js` (React admin SPA)
4. Default accent reads **green `#2fd67b`** (not teal/orange); Ocean/Forest still recolour — hard refresh
5. Top nav only on member pages (Discover, Library, **Systems**, Downloads, Favorites, More)
6. **Systems** (`/systems`): family groups load; click a console → library filtered with platform skin
7. Preferences swatch grid responds; page reloads after save; tile size changes grid density
8. Covers show for games with downloaded images (fallback only when truly missing)
9. Admin: React top bar — no member left sidebar; Dashboard / Libraries / Settings work
10. `/admin/settings` card grid; Themes → Reset Default Themes after rebuild
11. Collections: create, search-add, reorder, edit, delete
12. **Game details SPA** (`/game_details/<uuid>`): TopNav present; summary/versions/screenshots load; Check stores works
13. **Updates** (`/updates`): freshness inbox loads; store search returns Steam/GOG links; local Update/DLC shows Download / Apply when packs exist
14. Companion (optional): Install from details; Apply update/DLC from Updates or details versions; heartbeat claims command within ~60s

Operator sign-off: tick the list above after `build --no-cache` + Reset Default Themes, then mark Unraid smoke done in `docs/strategy/progress.md`.

See also [docker-compose-deploy.md](docker-compose-deploy.md) · [themes-reset.md](../admin/themes-reset.md).
