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

Library volume persists old theme files. Use **Reset Default Themes** or delete `themes/default` under the library volume and restart so `_setup_default_theme` reinstalls.
