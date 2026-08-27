# Unraid Compose — live checkout

The Unraid stack **is** this git tree. Do not copy files to `/mnt/user/isos/gametheca/` (retired).

| Role | Path |
|---|---|
| Unraid compose / env | `/mnt/user/infernal-data-streams/_projects/Gametheca` |
| Windows mapping | `Z:\_projects\Gametheca` |
| Games scan root (RO) | `/mnt/user/infernal-data-streams/_software/_games` |
| Library / uploads (RW) | `/mnt/cache/appdata/gametheca/library` |

Full operator runbook: [docs/runbooks/unraid-deploy.md](docs/runbooks/unraid-deploy.md).

## Compose Manager

- External ENV File Path: `/mnt/user/infernal-data-streams/_projects/Gametheca/.env`
- Indirect Compose File: `/mnt/user/infernal-data-streams/_projects/Gametheca/docker-compose.yml`
- Indirect Path: leave empty

`.env` must **not** contain `DATABASE_URL=...@localhost...`. Compose builds the URL with host `db`. Prefer `.env.unraid.example` (or `.env.nas.example`) if you are creating `.env` from scratch — set `SECRET_KEY`, `DATA_FOLDER_GAMES`, and `LIBRARY_HOST_PATH`. Do not overwrite a live `.env`.

`docker-compose.override.yml` in this tree requests an NVIDIA GPU for Windows Docker Desktop. Unraid has no GPU: leave `--profile artwork` off, or set `COMPOSE_FILE=docker-compose.yml` in the Unraid `.env` if a stack update dies with `nvml error: driver not loaded`.

## Start / rebuild

```bash
cd /mnt/user/infernal-data-streams/_projects/Gametheca
docker compose down
docker compose up -d --build
docker compose exec app printenv DATABASE_URL DATABASE_HOST
```

Expected: `...@db:5432/...` and `DATABASE_HOST=db`. Confirm readiness with `curl -f http://<unraid-ip>:5006/readyz`.

## Frontend (member SPA)

The image build runs `frontend/member-app` (Vite) and copies the bundle into `/app/gametheca/static/dist/member-app/`. After rebuild:

```bash
docker compose exec app test -f /app/gametheca/static/dist/member-app/member-app.js && echo ok
```
