# Copy GameTheca to Unraid (Compose + built-in Postgres)

Desktop repo: `C:\Users\cephyrix_zyth\Desktop\gametheca`

## 1. Prepare .env on the PC

```powershell
cd C:\Users\cephyrix_zyth\Desktop\gametheca
# Prefer Unraid template (volume sectioning + Compose Manager paths):
copy .env.unraid.example .env
# or: copy .env.nas.example .env
# set SECRET_KEY + DATA_FOLDER_GAMES / LIBRARY_HOST_PATH in .env
```

`.env` must **not** contain `DATABASE_URL=...@localhost...`.

## 2. SMB-copy to NAS

Overwrite `/mnt/user/isos/gametheca/` with at least:

- `docker-compose.yml` (forces `@db`)
- `entrypoint.sh` (rewrites localhost → db)
- `Dockerfile`, `requirements.txt`, `gametheca/`, `frontend/`, scripts
- `.env` (from this PC)

## 3. Unraid Compose Manager

- External ENV File Path: `/mnt/user/isos/gametheca/.env`
- Indirect Compose File: `/mnt/user/isos/gametheca/docker-compose.yml`
- Indirect Path: leave empty

## 4. Start

```bash
cd /mnt/user/isos/gametheca
docker compose down
docker compose up -d --build
docker compose exec app printenv DATABASE_URL DATABASE_HOST
```

Expected: `...@db:5432/...` and `DATABASE_HOST=db`.

Postgres service logs should show ready; app should stop looping on localhost.

## Frontend (member SPA)

Docker image build runs `frontend/member-app` (Vite) and copies `member-app.js` to `/app/gametheca/static/dist/member-app/`. After `docker compose up -d --build`, confirm the file exists if the member UI fails to load:

```bash
docker compose exec app test -f /app/gametheca/static/dist/member-app/member-app.js && echo ok
```
