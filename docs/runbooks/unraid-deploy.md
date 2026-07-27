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
| `DATA_FOLDER_GAMES` | Yes | Inside container, usually `/storage` (`DATA_FOLDER_WAREZ` deprecated alias) |
| `POSTGRES_*` | If using bundled db | Match `DATABASE_URL` |

## Volume mounts

| Host | Container | Mode |
|---|---|---|
| Games share | `/storage` | **ro** |
| Appdata library | `/app/gametheca/static/library` | rw |
| Optional appdata WebRetro cores | `/app/gametheca/static/vendor/webretro/cores` | rw — must include shipped cores or run `fetch-webretro-cores` first; [webretro-cores.md](webretro-cores.md) |

## Image

`chrisjrovira/gametheca:latest` (or build from this repo). The image includes `bash` for `entrypoint.sh`.

## First boot checklist

1. Set a real `SECRET_KEY`
2. Start container; watch logs until Postgres is ready
3. Confirm healthy: `curl -f http://<unraid-ip>:5006/readyz` (Compose healthcheck uses this; `/healthz` is liveness-only)
4. Open `http://<unraid-ip>:5006`
5. Complete setup wizard (admin → SMTP optional → IGDB)
6. Admin → Themes → **Reset Default Themes** (installs presets; regenerates at `GENERATOR_VERSION` 6)
7. Add a library pointing at `/storage/...`
8. Run a small scan before a full library scan

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

0. `curl -f http://<host>:5006/healthz` and `/readyz` both succeed (Unraid Docker health should track `/readyz`)
0b. Admin → Ops (`/admin/ops`): **Services** tile shows LiveKit · malware/ClamAV · companions · queues (via `/admin/api/ops/summary`)
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
13. **Updates** (`/updates`): freshness inbox; store search binds to library games; Want pack; Download / Apply
14. **Acquire** (`/acquire`, optional): ENABLE_ARR_MODULE / ENABLE_DEBRID — indexer search + librarian send
15. **Big Picture** (`/big-picture`): fullscreen shell (no TopNav); Open / Download / Install; Exit → Library
16. **Emulator play**: WebRetro cores for mapped platforms; cloud save button; .cht select when uploaded
17. Companion (optional): Install/Apply; assist packs when ENABLE_GAME_ASSISTS
18. **Social**: `/activity`, `/chat`, `/notifications`, `/report` load; admin `/admin/support` inbox
19. **LiveKit** (optional): `ENABLE_LIVEKIT` + `--profile livekit` — Activity voice lobby mints token ([livekit-unraid.md](livekit-unraid.md))

Operator sign-off: tick the list above after `build --no-cache` + Reset Default Themes, then mark Unraid smoke done in `docs/strategy/progress.md`.

See also [docker-compose-deploy.md](docker-compose-deploy.md) · [observability-profile.md](observability-profile.md) · [themes-reset.md](../admin/themes-reset.md) · [support-inbox.md](../admin/support-inbox.md).
