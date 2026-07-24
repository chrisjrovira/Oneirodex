# GameTheca

Self-hosted multi-user game library and download server. Scan folders, enrich with IGDB metadata, invite friends, and share DRM-free games.

| | |
|---|---|
| **Repo** | https://github.com/chrisjrovira/gametheca |
| **Docker image** | `chrisjrovira/gametheca:latest` |
| **Containers** | `gametheca-app`, `gametheca-db` |
| **Python package** | `gametheca/` |
| **Default port** | `5006` |

## What you get

- Folder scanning with multi-threaded identification (IGDB / Steam / GOG / RAWG)
- Cover art, screenshots, filters, discovery rails
- Streaming ZIP downloads, invite-based access, Discord hooks
- Library React grid with title-card badges and freshness (OUT / ~)
- Ops glance, propose-only scans, theme presets

GameTheca encourages legal use of software only.

## Quick start

### Linux installer

```bash
git clone --depth 1 https://github.com/chrisjrovira/gametheca.git
cd gametheca
chmod +x install-linux.sh
./install-linux.sh
```

Useful flags: `--games-dir /path/to/games`, `--dev`, `--no-db`, `--force`.

### Docker Compose

```bash
cp .env.docker.example .env
# Set SECRET_KEY and DATA_FOLDER_WAREZ / LIBRARY_HOST_PATH
docker compose up -d --build
```

App: http://localhost:5006 — volumes mount games read-only at `/storage` and library assets at `/app/gametheca/static/library`.

### Manual (Windows / Linux)

1. PostgreSQL 17+ with a `gametheca` database  
2. Copy `.env.example` → `.env` and set `DATABASE_URL`, `SECRET_KEY`, `DATA_FOLDER_WAREZ`, `UPLOAD_FOLDER`  
3. `pip install -r requirements.txt`  
4. `./startweb.sh` or `startweb_windows.cmd`

Force setup wizard: `./startweb.sh --force-setup` (required when upgrading from &lt; 2.0).

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URL (`db` host inside Compose) |
| `SECRET_KEY` | Required; container refuses the placeholder |
| `DATA_FOLDER_WAREZ` | Root of on-disk games |
| `UPLOAD_FOLDER` | Covers/themes (Compose: `/app/gametheca/static/library`) |
| `LIBRARY_HOST_PATH` | Host path mounted to `UPLOAD_FOLDER` in Docker |
| `DEV_MODE` | Recopy theme files on startup |
| `PORT` | Web port (default 5006) |

See `.env.example` and `.env.docker.example`.

## Docs map

| Doc | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Full documentation index |
| [docs/strategy/](docs/strategy/) | Roadmap, competitive gaps, UI plan, execution log |
| [docs/runbooks/](docs/runbooks/) | Unraid deploy, container troubleshooting |
| [docs/openapi/openapi.json](docs/openapi/openapi.json) | HTTP API |

## Development

```bash
pip install -r requirements.txt
# optional frontend
cd frontend/library-grid && npm ci && npm test && npm run build
pytest tests/test_q1_foundation_unit.py
```

Set `TEST_DATABASE_URL` (default DB name `gamethecatest`) for DB-backed tests.

## Upgrades

- Overwrite files and re-run `pip install -r requirements.txt` for normal updates  
- Rebuild the Docker image after frontend or package path changes  
- Admin → reset/sync default themes after CSS/JS theme updates on volume mounts  
- IGDB: install &gt; 2.5.2 before August 2025 cutoff for lookups

## License / legal

Use GameTheca only with software you are authorized to share. Unauthorized distribution of copyrighted material is not supported.
