# Docker Compose deploy — GameTheca

Concise local/NAS path using the repo `docker-compose.yml` (`gametheca-app` + `gametheca-db`).

## Prerequisites

- Docker Compose v2
- Host path to games (mounted read-only at `/storage`)
- Writable host path for library data (covers, themes)

## Setup

```bash
cp .env.docker.example .env
# Set SECRET_KEY (required — container refuses the placeholder)
# Set DATA_FOLDER_WAREZ = HOST games path
# Set LIBRARY_HOST_PATH = HOST library/appdata path (default ./data/library)
# Do NOT set DATABASE_URL=@localhost — Compose builds URL with host "db"
docker compose up -d --build
```

App: http://localhost:5006

## Volumes

| Env / mount | Container |
|---|---|
| `DATA_FOLDER_WAREZ` → `/storage` | Games (**ro**) |
| `LIBRARY_HOST_PATH` → `/app/gametheca/static/library` | Covers / themes (rw) |
| `db_data` volume | Postgres |

## After first start

1. Complete setup wizard
2. Admin → Themes → **Reset Default Themes** (ensures `#2fd67b` tokens / `GENERATOR_VERSION` 6)
3. Add library under `/storage/...`, run a small scan

## Rebuild after frontend/theme changes

```bash
docker compose build --no-cache && docker compose up -d
```

Then Reset Default Themes if the library volume still has stale CSS.

## Smoke

- View Source on Discover/Library: `member-app.css` + `member-app.js` present
- Accent green `#2fd67b`; Systems hub (`/systems`) loads
- Admin uses top bar only (no member LHN)

Unraid-specific notes: [unraid-deploy.md](unraid-deploy.md). Break-glass: [container-wont-start.md](container-wont-start.md).
