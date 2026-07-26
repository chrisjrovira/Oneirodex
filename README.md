# GameTheca

**Version:** [0.1.0](CHANGELOG.md) Â· Self-hosted multi-user game library and download server. Scan folders, enrich with IGDB metadata, invite friends, and share DRM-free games.

| | |
|---|---|
| **Repo** | https://github.com/chrisjrovira/gametheca |
| **Release** | `v0.1.0` (see [CHANGELOG.md](CHANGELOG.md)) |
| **Docker image** | Local build `gametheca:0.1.0` (Compose); Hub publish optional |
| **Containers** | `gametheca-app`, `gametheca-db` |
| **Python package** | `gametheca/` |
| **Default port** | `5006` |

## What you get

- Folder scanning with multi-threaded identification (IGDB / Steam / GOG / RAWG)
- Cover art, screenshots, filters, discovery rails
- Streaming ZIP downloads, invite-based access, Discord hooks
- Library React grid with title-card badges and freshness (OUT / ~)
- Ops glance, propose-only scans, color theme presets + independent icon packs
- Optional modules (feature-flagged): *arr + hardlink pipeline, Ollama AI, VR/Quest PWA, OIDC/Authentik SSO
- Desktop companion (Tauri) â€” unsigned by default; signing hooks documented

GameTheca encourages legal use of software only. **Authentik/SSO is optional** â€” local username/password works for home installs.

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
# Set SECRET_KEY and DATA_FOLDER_WAREZ (HOST path to games) / LIBRARY_HOST_PATH
# Do NOT use DATABASE_URL=@localhost â€” Compose connects to service "db"
docker compose up -d --build
```

App: http://localhost:5006 â€” Postgres is the `db` service; games mount at `/storage`.

Unraid: see [NAS-DEPLOY.md](NAS-DEPLOY.md).

### Manual (Windows / Linux)

1. PostgreSQL 17+ with a `gametheca` database  
2. Copy `.env.example` â†’ `.env` and set `DATABASE_URL`, `SECRET_KEY`, `DATA_FOLDER_WAREZ`, `UPLOAD_FOLDER`  
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
| `ENABLE_ARR_MODULE` | *arr search / qBittorrent |
| `ENABLE_AI_ASSIST` / `ENABLE_AI_AUTO_APPLY` | Ollama triage (+ gated rename) |
| `ENABLE_VR_BROWSE` | `/vr` PWA catalog |
| `OIDC_ENABLED` | Env half of SSO (also enable in Admin â†’ Integrations) |

See `.env.example` and `.env.docker.example`.

## Docs map

| Doc | Contents |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/README.md](docs/README.md) | Full documentation index |
| [docs/strategy/](docs/strategy/) | Roadmap, competitive gaps, UI plan, execution log |
| [docs/runbooks/](docs/runbooks/) | Unraid, OIDC/Authentik, Docker, signing |
| [docs/openapi/openapi.json](docs/openapi/openapi.json) | HTTP API |
| [clients/desktop/README.md](clients/desktop/README.md) | Desktop companion |
| [clients/quest/README.md](clients/quest/README.md) | Quest / VR PWA |

## Development

```bash
pip install -r requirements.txt
# optional frontend
cd frontend/member-app && npm ci && npm test && npm run build
pytest tests/test_q1_foundation_unit.py tests/test_ops_followons.py
```

Set `TEST_DATABASE_URL` (default DB name `gamethecatest`) for DB-backed tests.

## Versioning

Product version is tracked in [`VERSION`](VERSION) (currently **0.1.0**). Desktop, member-app, ops-glance, and api-client package versions follow the same milestone number. Docker tags: `chrisjrovira/gametheca:0.1.0` and `:latest`.

## Upgrades

- Overwrite files and re-run `pip install -r requirements.txt` for normal updates  
- Rebuild the Docker image after frontend or package path changes  
- Admin â†’ reset/sync default themes after CSS/JS theme updates on volume mounts  
- IGDB: install &gt; 2.5.2 before August 2025 cutoff for lookups

## License / legal

Use GameTheca only with software you are authorized to share. Unauthorized distribution of copyrighted material is not supported.
