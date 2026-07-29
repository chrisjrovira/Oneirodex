# Settings & modules

Admin settings use a **card grid** at `/admin/settings` (whole card → destination; `?section=` redirects). Chrome is the React admin top bar (`frontend/admin-app`); many forms remain Jinja until migrated. Live React bodies include Dashboard, Libraries/Scans hubs, Themes, Plugins, Announcements, **Support inbox**, and the **Integrations hub** (grouped IGDB · SMTP · OIDC · LiveKit · Support cards with deep links into classic forms).

## Hub badges

Settings hub shows On/Off (and Storage “Apply off”) for optional modules so you can see state without opening each page.

## Feature defaults

Product modules default **on**. Disable during **setup → Features**, under **Admin → Features**, or via `.env` / Compose.

**Stays off by default:** `OIDC_ENABLED` (SSO/auth).  
**Safety locks (also off):** `ENABLE_AI_AUTO_APPLY`, `ALLOW_HARDLINK_APPLY`.  
**Patch catalog:** operator YAML/JSON at `PATCH_CATALOG_PATH` — GameTheca does not scrape romhacking.net or similar sites.

| Env / module | Default | Notes |
|---|---|---|
| Most `ENABLE_*` product flags | on | See `.env.example` |
| `ENABLE_MALWARE_SCAN` | on | ClamAV when reachable + heuristics; blocks/skips on match; Admin → Features |
| `MALWARE_SCAN_BLOCK_ON_HIT` | on | Skip library adds on heuristic warn or ClamAV hit |
| `CLAMAV_*` | host `127.0.0.1:3310` (native) / `clamav:3310` (Compose profile) | Optional `docker compose --profile clamav up -d` |
| `ENABLE_LIVEKIT` | on | Needs `LIVEKIT_*` + compose profile for actual SFU |
| `ENABLE_VR_BROWSE` | on | `/vr` catalogue |
| `ENABLE_PCDOS_BROWSER` | on | Needs vendored dosbox WASM |
| `ENABLE_FREE_GAMES` | on | News free-games poller + API |
| `ENABLE_EMAIL_DIGEST` | on | Scheduler on; members still opt in |
| `ENABLE_LOGIN_RATE_LIMIT` | on | In-process login / password-reset rate limit |
| `OIDC_ENABLED` | **off** | Also requires Admin → Integrations toggle |

## Arr

- Env: `ENABLE_ARR_MODULE`, `ENABLE_ARR_HARDLINK_PIPELINE`, plus Prowlarr/Jackett/qBittorrent URLs in `.env`.
- Admin toggle via Arr settings / `PUT /api/arr/module` (env **or** DB enable).
- On by default; disable under Features if you are not bringing your own indexers.

## AI

- Env: `ENABLE_AI_ASSIST`, `ENABLE_AI_AUTO_APPLY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`.
- Admin AI page: enable + Ollama URL/model (`PUT /api/ai/config`) and Test.
- Ollama-only by default; never required for core library use.

## Storage / hardlinks

- `ENABLE_HARDLINK_HELPERS` and `ALLOW_HARDLINK_APPLY` are **env-only** safety gates (no DB toggle).
- Hub banners explain why Apply is disabled when helpers/apply are off or the games mount is RO.

## LiveKit voice

- Env: `ENABLE_LIVEKIT`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Compose: `docker compose --profile livekit up -d` — [livekit-unraid.md](../runbooks/livekit-unraid.md).
- Plugin registry: `rtc.livekit` (configured when env is complete).

## Remote play (Moonlight / BYO host)

- Env: `ENABLE_REMOTE_PLAY` (**off** by default), optional `SUNSHINE_BASE_URL` / `WOLF_BASE_URL`, hint vars — see `.env.example`.
- Admin: **Settings → Remote play** (`/admin/remote_play`) or `PUT /api/admin/remote-play/config`.
- Members: `GET /api/remote-play/status`; game details **Play via Moonlight** copies host + hints.
- **No Wolf/GOW in GameTheca image** — operator runs Sunshine/Wolf on a GPU host; LAN URLs need `ALLOW_PRIVATE_LAN_URLS=true`.
- Plugin registry: `remote_play.moonlight`.
- Guide: [gow-remote-play.md](../strategy/gow-remote-play.md).

## Malware scan

- Env: `ENABLE_MALWARE_SCAN`, `MALWARE_SCAN_BLOCK_ON_HIT`, `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_SOCKET`.
- Compose: `docker compose --profile clamav up -d` — [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md).
- Library scans **skip/block** adds on heuristic filename match or ClamAV hit when `MALWARE_SCAN_BLOCK_ON_HIT=true` (default).
- Admin status: `GET /api/admin/malware-scan/status` or Admin → Features.

## Challenge solver (BYO sidecar)

- Env: `ENABLE_CHALLENGE_SOLVER` (**off** by default), `CHALLENGE_SOLVER_URL`, `CHALLENGE_SOLVER_PROVIDER`, `CHALLENGE_SOLVER_TIMEOUT_MS`, `CHALLENGE_SOLVER_MAX_TIER` (default **5**; admin may raise).
- Optional token CAPTCHA API: `CHALLENGE_TOKEN_API_URL`, `CHALLENGE_TOKEN_API_KEY` when `provider=token_api`.
- Compose: `docker compose --profile challenge up -d` (Ops) — FlareSolverr-compatible TRAWL sidecar on LAN only.
- Admin → Features: enable, solver URL, provider, max tier, **Test solver**; status `GET /api/admin/challenge-solver/status?probe=1`.
- Opt-in only — not bulk-enabled with OIDC/AI apply locks. Solver URL validated via `validate_connector_http_url` + `ALLOW_PRIVATE_LAN_URLS`.
- Acquire (*arr search / debrid HTTP) retries **once** through the solver when a challenge page is detected and the module is on.

## Ambient lighting (Hyperion.ng / Home Assistant)

- Env: `ENABLE_AMBIENT_LIGHTING` (**off** by default), `LIGHTING_PROVIDER` (`off` \| `hyperion` \| `homeassistant`).
- Hyperion: `HYPERION_URL`, optional `HYPERION_TOKEN`, `HYPERION_PRIORITY` (default 50), `AMBIENT_ACCENT_COLOR`.
- Home Assistant: `HA_URL`, `HA_TOKEN`, `HA_LIGHT_ENTITIES`, optional `HA_PLAY_SCENE` / `HA_STOP_SCENE`.
- Play session start/stop hooks fire-and-forget — never block play launch. Child accounts never trigger lighting.
- Admin → Features: enable, provider, connector fields, **Test**; status `GET /api/admin/ambient-lighting/status?probe=1`.
- URLs validated via `validate_connector_http_url` + `ALLOW_PRIVATE_LAN_URLS`.

## Support → GitHub

- Env: `SUPPORT_GITHUB_TOKEN`, `SUPPORT_GITHUB_REPO` — [support-inbox.md](support-inbox.md).
- No Discord webhooks; library events notify admins in-app (`admin_notify_*`).

## Art studio (cover placeholders)

- **Admin → Settings → Art studio** or `/admin/art_studio` (React; admin/ops only).
- Local Pillow templates — aurora tokens (`--gt-*`), no paid cloud AI.
- **Preview** tile → **Generate all sizes** (2:3 tiles, 16:9 wides, 1:1 squares, 1280×720 hero) under `static/library/generated/{pack_id}/`.
- **Download ZIP** · **Set as fallback pack** (writes `default_cover.jpg` + `default_library.jpg`) · **Apply cover to game** (game UUID).
- API: `POST /admin/api/art-studio/preview|generate|apply`, `GET /admin/api/art-studio/download/<pack_id>`.
- Disk failures (read-only `IMAGE_SAVE_PATH` / generated-pack folder, out of space) surface as a JSON `error` and show in the red alert banner instead of a bare 500 — check the message for the exact path/permission problem. If applying a pack to a game fails partway (DB error after the file was written), the orphaned file is cleaned up automatically.
- Guide: [cover-art-studio.md](../strategy/cover-art-studio.md).

## Other env toggles

| Flag | Effect |
|---|---|
| `ENABLE_VR_BROWSE` | Member VR catalogue |
| `ENABLE_FREE_GAMES` | News free-games poller + API (default on) |
| `FREE_GAMES_POLL_HOURS` | Free-games refresh interval (default 3) |
| `ENABLE_EMAIL_DIGEST` | Batched digest scheduler (default on; members still opt in) |
| `EMAIL_DIGEST_INTERVAL_HOURS` | Digest poll interval (default 24; clamp 1–168) |
| `ENABLE_PCDOS_BROWSER` | Allow PC DOS browser play when dosbox WASM is vendored (default on; still needs WASM on disk) |
| `ENABLE_LOGIN_RATE_LIMIT` | In-process login / password-reset rate limit (default on) |
| `LOGIN_RATE_LIMIT_ATTEMPTS` | Max failures per window (default 10) |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | Window seconds (default 300) |
| `OIDC_ENABLED` + Admin Integrations | SSO (also see OIDC runbooks) |
| Custom chat emoji | Admin → Integrations → Community → **Manage custom chat emoji** (max 20) |
| `ALLOW_PRIVATE_LAN_URLS` | Allow admin *arr/Ollama **connector** URLs on RFC1918 (user/indexer fetches stay blocked) |
| `OIDC_LOCK_ROLES` | Don’t overwrite roles on every SSO login |
| `ENABLE_CHALLENGE_SOLVER` | **off** — BYO FlareSolverr/TRAWL sidecar for challenged acquire fetches |
| `CHALLENGE_SOLVER_MAX_TIER` | Default **5** (admin may increase) |

## Mods & household game servers

- **`ENABLE_MOD_TRACKING`** (default on) — per-game mod registry at `/api/games/<uuid>/mods` (librarian/admin CRUD; members read; child read-only). Summary: `GET /api/mods/summary`.
- **Game servers** — admin CRUD at `/api/game-servers`; members/children read join info only. Ops summary `services.game_servers` includes TCP/HTTP health chips; per-server status: `GET /api/game-servers/<uuid>/status`.

Related: [libraries-and-scans.md](libraries-and-scans.md) · [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) · [oidc-sso.md](../runbooks/oidc-sso.md) · [troubleshooting.md](troubleshooting.md)

## Personal API tokens (companion / thin)

- **API:** `GET/POST /api/tokens`, `DELETE /api/tokens/{id}` — any logged-in member.
- **Presets:** `POST` body `"preset": "companion"` (`read:library` + `write:download`) or `"preset": "thin"` (`read:library` + `read:social` + `write:presence`; **no** download). List response includes `scope_presets`.
- **Thin protocol:** heartbeat accepts `device_kind` (`companion` | `thin` | `browser`); `GET /api/client/capabilities` advertises allows/denies. Install/update command queue delivers only to `companion` + download/lifecycle scopes.
- **UI:** member SPA **Account → API tokens** (`/tokens`) — create with companion/thin presets, copy one-time secret, revoke. API / `@gametheca/api-client` / OpenAPI still work. See [desktop-companion.md](../user/desktop-companion.md) · [thin-client.md](../strategy/thin-client.md).
