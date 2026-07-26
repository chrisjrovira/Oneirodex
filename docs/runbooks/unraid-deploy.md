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
5. Admin → Themes → **Reset Default Themes** (installs 10 presets on the volume)
6. Add a library pointing at `/storage/...`
7. Run a small scan before a full library scan

## Theme / JS not updating?

Library volume persists old theme files. After every code deploy:

1. `docker compose build --no-cache && docker compose up -d`
2. Watch logs for theme sync / `[OK] Default theme`
3. Admin → Themes → **Reset Default Themes** (or delete `themes/default` under the library volume and restart)

Also confirm `member-app.css` loads in the browser (View Source on Discover/Library). Missing CSS means a rebuild is required — the SPA chrome will look unstyled without it.

## Compose Manager paths

- External ENV File Path: `/mnt/user/isos/gametheca/.env`
- Indirect Compose File: `/mnt/user/isos/gametheca/docker-compose.yml`
- Indirect Path: leave empty

## Smoke checklist (chrome rewrite)

1. First-boot logs show `[OK] Theme tokens present` (or Reset Default Themes)
2. Discover/Library: View Source includes `member-app.css` and `member-app.js`
3. Apply Ocean/Forest — accent + surfaces recolour; hard refresh
4. Preferences swatch grid responds; page reloads after save
5. Tile grid is dense (small gaps); XL tiles fill the grid cells
6. Covers show for games with downloaded images (fallback only when truly missing)
7. Admin pages: top bar only — **no** member left sidebar
8. `/admin/settings` card grid one-click; Arr/AI toggles + hub badges
9. Collections: create, search-add, reorder, edit, delete

