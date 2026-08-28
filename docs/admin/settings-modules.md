# Settings & modules

Admin settings use a **card grid** at `/admin/settings` (whole card → destination; `?section=` redirects). Chrome is the React admin top bar (`frontend/admin-app`); many forms remain Jinja until migrated. Live React bodies include Dashboard, Libraries/Scans hubs, Themes, Plugins, Announcements, **Support inbox**, and the **Integrations hub** (grouped cards for IGDB · Artwork & secondary metadata · SMTP · OIDC · LiveKit · Community · Acquire/Arr · Ownership · Remote play · Export packs · Support, with deep links into classic forms).

**Integrations inventory API:** `GET /api/admin/integrations/inventory` (admin) returns `{integrations[{id,name,category,status,configured,enabled,admin_href,settings_href,notes}], count, hub_href}` covering IGDB, SteamGridDB, Giant Bomb, HLTB, Meta/Quest, SMTP, OIDC, Support, community chat, LiveKit, Arr connectors, and ownership register links — so the hub is not IGDB-only. The React Integrations page renders a **Provider inventory** grouped by category (with status + notes) under the hub cards. Classic `/admin/integrations` artwork tab anchors (`#steamgriddb`, `#giantbomb`, `#hltb`, `#meta_quest`, `#ownership`, `#livekit`, `#support`, `#indexers`, `#community`, `#email`, `#igdb`) deep-link the same surfaces.

**Export packs:** Admin → Integrations → **Export packs** (and member Systems secondary section) download ES-DE `gamelist.xml` (`/api/export/esde`) and Pegasus metadata (`/api/export/pegasus`). Paths are portable under library roots — NAS/home mounts are not leaked.

**Server logs alias:** Admin server logs/status is also at **`/admin/server_logs`**.

**Worker caps (scan/turbo):** New installs default scan threads **1**, turbo threads **4**, turbo batch **100**; runtime hard-caps via `GT_SCAN_THREAD_CAP` / `GT_IMAGE_DOWNLOAD_THREAD_CAP` / `GT_IMAGE_DOWNLOAD_BATCH_CAP` — not Compose `SCAN_*` env vars. See [libraries-and-scans.md](libraries-and-scans.md) · [unraid-deploy.md](../runbooks/unraid-deploy.md#cpu--scan-load-unraid-safe-defaults).

## Scan / match policy (W20-4)

- **Done (uncommitted):** Admin → Settings → **Scan / match policy** (`/admin/scan_match`) — React `ScanMatchSettingsPage` (Jinja SPA shell) + Settings hub card · admin vitest **7/7** claimed · BE `GET`/`PUT` `/api/admin/scan-match/config` live (scoring / dupe / peel wired · pytest claimed **13+21**).
- **Persist:** `GlobalSettings` (`settings.scan_match` JSON + `propose_only_scan`). Unset keys use defaults below.
- **Defaults:** `match_high_threshold` **0.92** · `match_ambiguous_gap` **0.08** · `dupe_title_threshold` **0.85** · `peel_profile` `conservative` · Stage C safe variant toggles **on** (`enable_year_drop_variant` · `enable_pack_peel_variant` · `enable_edition_peel_variant` · `enable_sequel_numeral_variant`).
- **Honesty:** propose-only never auto-imports (even high-confidence). API refuses mega-library / depth-3 family walk keys. `scanThreadCount` stays on Server Settings / worker caps.
- Propose-only also remains on **Server Settings** (`proposeOnlyScan` / `propose_only_scan`) with a link to this page.
- **Post-ship:** Reset Themes **not** required for this API (UI shell already shipped). Details: [libraries-and-scans.md](libraries-and-scans.md#scan--match-policy-w20-4).

## Hub badges

Settings hub shows On/Off (and Storage “Apply off”) for optional modules so you can see state without opening each page.

## Feature defaults

Product modules default **on**. Disable during **setup → Features**, under **Admin → Features**, or via `.env` / Compose.

**Stays off by default:** `OIDC_ENABLED` (SSO/auth).  
**Safety locks (also off):** `ENABLE_AI_AUTO_APPLY`, `ALLOW_HARDLINK_APPLY`.  
**Patch catalog:** operator YAML/JSON at `PATCH_CATALOG_PATH` — Oneirodex does not scrape romhacking.net or similar sites.

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
| `BIOS_IMPORT_SOURCE` | unset | Folder of dumps you already own. Boot copies missing names (never overwrites). Admin → Emulators **Scan collection** uses the same path. [emulator-bios.md](../runbooks/emulator-bios.md) |

## Arr

- Env: `ENABLE_ARR_MODULE`, `ENABLE_ARR_HARDLINK_PIPELINE`, plus optional Prowlarr/Jackett/qBittorrent URLs in `.env`.
- Admin toggle via Arr settings / `PUT /api/arr/module` (env **or** DB enable).
- On by default; disable under Features if you are not using Acquire.
- **Native indexers:** Admin → Arr registry stores Torznab/Newznab entries in `GlobalSettings.arr_settings.indexers` (add one, JSON/CSV bulk, curated presets with empty API keys). Search merges enabled native endpoints **and** configured Prowlarr **and** Jackett.
- **Admin UI:** Arr page shows indexer table (ready/enabled/source, toggle, delete), add-one form, bulk JSON/CSV import, preset multi-select + Enable selected, hub URL fields, and `indexer_warnings` from status/search.
- APIs: `GET/POST /api/arr/indexers`, `POST /api/arr/indexers/bulk`, `POST /api/arr/indexers/enable-presets`, `PUT|PATCH|DELETE /api/arr/indexers/<id>`.
- Native indexer URLs use outbound SSRF checks (no LAN); hub URLs still respect `ALLOW_PRIVATE_LAN_URLS`.
- Preset pack: `gametheca/data/indexer_presets.json` (no secrets; admin-only display names).
- **Remote path mapping (`ARR_REMOTE_PATH_MAP`)** — set this whenever your download client runs in a **different container** than Oneirodex, which is the normal Unraid/Compose layout. qBittorrent reports paths from *its* mounts (`/downloads/…`), Oneirodex sees the same bytes somewhere else (`/storage/downloads/…`), and without a mapping the hardlink pipeline stats a path that does not exist here. The preview then says *"no source file found"* — true, but baffling when the file is plainly on disk.
  - Format: `remote=>local` pairs joined by `|`. `=>` because Windows paths contain colons; `|` because paths can contain commas.
  - Example: `ARR_REMOTE_PATH_MAP=/downloads=>/storage/downloads|/data/torrents=>/mnt/user/torrents`
  - Longest remote prefix wins, so a specific mapping beats a general one. A prefix only matches at a path separator, so `/downloads` never matches `/downloads-old`.
  - Leave empty when client and app share a filesystem view — unmapped paths pass through untouched.
  - When no mapping is set and a lookup fails, the preview reason now names the path it tried and points at this setting instead of just saying "not found".
- **Quality / release profiles (P1-12):** `GlobalSettings.quality_profiles` (multi-profile JSON). Admin → **Quality profiles** SPA at `/admin/quality_profiles` (`QualityProfilesPage`: list · set active · new · delete · edit · score probe; Jinja is an SPA shell). APIs: `GET/POST /api/quality-profiles`, `PUT /api/quality-profiles/active`, `GET/PUT/DELETE /api/quality-profiles/<id>`. Active profile scores Arr search and extends scan name-clean with blocked/excluded terms.

## AI

- Env: `ENABLE_AI_ASSIST`, `ENABLE_AI_AUTO_APPLY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`.
- Admin AI page: enable + Ollama URL/model (`PUT /api/ai/config`) and Test.
- Ollama-only by default; never required for core library use.

## Storage / hardlinks

- `ENABLE_HARDLINK_HELPERS` and `ALLOW_HARDLINK_APPLY` are **env-only** safety gates (no DB toggle). `ALLOW_HARDLINK_APPLY` stays **off** by product default.
- Admin page: **Settings → Storage** (`/admin/storage`) — React `StoragePage` (Jinja emptied to SPA shell).
- Status API: `GET /api/storage/status` — `helpers_enabled` · `allow_apply` · `games_path` · `games_exists` / `games_readable` / `games_writable` · `degrade_reason` (RO / apply-off honesty).
- Preview / apply: `POST /api/storage/hardlink/preview` · `POST /api/storage/hardlink/apply` (apply gated by helpers **and** `ALLOW_HARDLINK_APPLY`). Preview surfaces readable reasons, including **destination parent not writable (read-only mount?)**.
- Hub / page banners explain why Apply is disabled when helpers/apply are off or the games mount is RO.

## LiveKit voice

- Env: `ENABLE_LIVEKIT`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Compose: `docker compose --profile livekit up -d` — [livekit-unraid.md](../runbooks/livekit-unraid.md).
- Plugin registry: `rtc.livekit` (configured when env is complete).

## Remote play (Moonlight / BYO host)

- Env: `ENABLE_REMOTE_PLAY` (**off** by default), optional `SUNSHINE_BASE_URL` / `WOLF_BASE_URL`, hint vars — see `.env.example`.
- Admin: **Settings → Remote play** (`/admin/remote_play`) or `PUT /api/admin/remote-play/config`.
- Members: `GET /api/remote-play/status`; game details **Play via Moonlight** copies host + hints.
- **No Wolf/GOW in Oneirodex image** — operator runs Sunshine/Wolf on a GPU host; LAN URLs need `ALLOW_PRIVATE_LAN_URLS=true`.
- Plugin registry: `remote_play.moonlight`.
- Guide: [gow-remote-play.md](../strategy/gow-remote-play.md).

## Loading icons (admin lock / rotate)

- DB: `GlobalSettings.loading_icon_mode` (`rotate` \| `lock`, default **rotate**), `loading_icon_id` (catalogue id or null).
- Public bootstrap: `GET /api/loading-icon` (no admin auth — member/admin loading UIs).
- Admin: `GET`/`PUT /api/admin/loading-icon/config` — lock requires a catalogue id; rotate clears id.
- Catalogue ids: `ring`, `orbit`, `pulse`, `blocks`, `scan`, `arcade` — visuals are SPA/theme-owned.
- Details: [icon-themes.md](../strategy/icon-themes.md).

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

- **Admin → Settings → Art studio** or `/admin/art_studio` (React; admin/ops only). Tabs: **Studio** · **Backup & stock** (`#stock`) · **Pick & queue** (`#images`).
- Local Pillow renderer — aurora tokens (`--gt-*`), no paid cloud AI. Preview/generate use **artistic** compositions by default (`artistic: true` on `POST /admin/api/art-studio/preview`; optional `artistic: false` for legacy flat A/B). Idle **title scale is 1.3×** (floor 0.85×); the slider always posts `title_scale`.
- **Title-first studio:** large live preview stage; typing a title debounces preview. System / platform selector + preview size toggles (200×300 · 400×600 · 960×540 wide). Soft-fails preview lag with toast.
- **Actions:** Preview · Generate pack · Download ZIP · Set as fallback · Apply to game UUID.
- **Backup & stock** (`#stock`): thumbnail grid of platform packs + stock motifs from `GET /admin/api/art-studio/stock`; ungenerated packs auto-call `POST …/stock/generate` on apply. Select → preview → **Use as library default** / **Set fallback** via `POST /admin/api/art-studio/apply` (`mode=fallback|library`). Soft empty state if catalog 404. Library create/edit Jinja **Choose image** links here.
- **Library default covers** panel shows current `default_cover.jpg` / `default_library.jpg` with **Regenerate defaults** CTA.
- **Batch placeholders** (collapsed) for no-cover titles via `POST /admin/api/art-studio/batch-generate` (alias: `apply-batch`) first, then `POST /admin/api/covers/batch/apply` (`generate_only`) fallback.
- **Auto-pick (ImagesPage):** `POST /admin/api/covers/batch/apply` with `policy=sgdb_then_igdb_then_generate` (library / platform / service filters). Mass search: `POST /admin/api/covers/batch/search`.
- **Single-title picker:** `POST /admin/api/covers/search` + `POST /admin/api/covers/apply`. Identify chips from `GET /api/search_metadata/sources` (Meta Quest / Epic / itch / Giant Bomb / MobyGames / TheGamesDB) search via `GET /api/search_metadata?source=`. Optional `MOBYGAMES_API_KEY` / `THEGAMESDB_API_KEY` — empty results when unset.
- Queue rows show `failure_reason` (and `last_error` fallback); list responses surface `image_save_path.error` when the images volume is not writable.
- API: `POST /admin/api/art-studio/preview|generate|apply|apply-batch`, `GET /admin/api/art-studio/download/<pack_id>`, `POST /admin/api/art-studio/batch-generate`, `GET /admin/api/art-studio/stock`, `POST /admin/api/art-studio/stock/generate`; covers mass tools under `/admin/api/covers/*`.
- **System templates:** generated covers use per-system palette + glyph (NES/SNES/PS1/Switch/PC/…) so 200×300 tiles stay readable — not a generic subtitle-only placeholder.
- **Meta Quest Store:** identify `GET /api/search_metadata?source=meta_quest|meta|quest` · ownership CSV `POST /api/ownership/meta_quest/csv` · `META_QUEST_API_MODE` / `META_QUEST_UNOFFICIAL_GRAPHQL` (off by default) — [store-metadata-identify.md](../strategy/store-metadata-identify.md).
- **Ownership register:** members link Steam / GOG / Epic / Amazon under **More → Ownership**. Steam Web API, unofficial GOG Galaxy refresh token, unofficial Epic device auth, unofficial Amazon Nile/Heroic token — IDs and names only, never a download. Household env: `STEAM_WEB_API_KEY`, `GOG_REFRESH_TOKEN`, `EPIC_DEVICE_AUTH`, `AMAZON_REFRESH_TOKEN` / `AMAZON_DEVICE_SERIAL` / `AMAZON_NILE_JSON`.
- Disk failures (read-only `IMAGE_SAVE_PATH` / generated-pack folder, out of space) surface as a JSON `error` and show in the red alert banner instead of a bare 500 — check the message for the exact path/permission problem. If applying a pack to a game fails partway (DB error after the file was written), the orphaned file is cleaned up automatically.
- Guide: [cover-art-studio.md](../strategy/cover-art-studio.md).
- Artwork picker: [steamgriddb-artwork.md](../runbooks/steamgriddb-artwork.md) · [libraries-and-scans.md](libraries-and-scans.md#image-queue).

## Generated cover art

Optional, **off by default**, and self-hosted only. This is the one feature that
talks to an endpoint outside the process, so it stays opt-in.

| Flag | Effect |
|---|---|
| `ENABLE_AI_ARTWORK` | Master switch — default **false** |
| `AI_ARTWORK_URL` | Your endpoint, e.g. `http://sdnext:7860`. No default; generation refuses without it |
| `AI_ARTWORK_ENGINE` | `a1111` (default) — the A1111 REST API, which **AUTOMATIC1111**, **SD.Next** and **Forge** all implement |

- Calls `POST /sdapi/v1/txt2img` on your endpoint. Nothing leaves your network;
  there is no hosted provider and no API key to buy.
- `AI_ARTWORK_ENGINE=comfyui` is recognised but **not implemented** — it raises
  a clear error naming the missing workflow rather than silently producing
  nothing. Use `a1111` for now.
- Generated rows are marked `is_generated` with `generated_by`. Regenerating
  replaces only the previous *generated* image, so hand-picked or scraped art is
  never clobbered.
- Routes: `POST /admin/api/artwork/generate` (one game) ·
  `POST /admin/api/artwork/generate/batch` (fill missing covers).
- Compose ships an SD.Next sidecar under the `artwork` profile
  (`docker compose --profile artwork up -d`) — see `docker-compose.yml`. That
  service overrides the image's CMD: `saladtechnologies/sdnext:latest` still
  passes `--skip-tests`, which its pinned SD.Next checkout does not define, so
  the stock command dies at argparse with *unrecognized arguments* before the
  server ever binds. Its volumes mount at `/webui/data/models` and
  `/webui/outputs` — the image has no `/app`. Its healthcheck probes with
  `wget`, because the image ships no `curl`: a `curl` probe fails with
  "executable file not found" and the container sits unhealthy forever while
  serving fine.
- **GPU is opt-in and never assumed.** The sidecar runs on CPU by default —
  extremely slow, but it runs. `docker-compose.yml` requests no GPU at all,
  because an NVIDIA reservation on a host without a loaded driver fails
  container create (`nvml error: driver not loaded`) and takes the whole stack
  update with it. If the *Docker host* has the driver and the NVIDIA Container
  Toolkit, opt in with `COMPOSE_FILE=docker-compose.yml:docker-compose.gpu.yml`.
- **GPU on a different machine?** Do not start the profile. Run SD.Next /
  AUTOMATIC1111 / Forge on that box and set `AI_ARTWORK_URL=http://<host>:7860`
  — the backend only makes an HTTP call, so the generator can live anywhere on
  the LAN. Making that turnkey (pairing, health, queueing) is backlog **GPU-N**,
  [gpu-worker-node.md](../strategy/gpu-worker-node.md).

Prefer to supply your own art instead? See
[theme-fonts-and-images.md](theme-fonts-and-images.md#batch-artwork-upload).

## Scan freshness checks

| Flag | Effect |
|---|---|
| `SCAN_CHECK_FRESHNESS` | Check version / updates / DLC after a library scan — default **false** |
| `SCAN_FRESHNESS_LIMIT` | Titles checked per run; default **50** |

Off by default deliberately: each check is outbound store HTTP traffic, so a
routine scan must not start doing it without being asked. The cap keeps a large
first scan from turning into thousands of requests.

## Theme fonts

| Flag | Effect |
|---|---|
| `FONT_PATH` | Where uploaded/dropped-in fonts live. Empty = `static/library/fonts` |
| `FONT_MAX_BYTES` | Per-file upload cap; default `8388608` (8MB) |

Font *files* are operator-supplied — the registry ships the faces, not the
binaries. Full guide: [theme-fonts-and-images.md](theme-fonts-and-images.md).

## Other env toggles

| Flag | Effect |
|---|---|
| `ENABLE_VR_BROWSE` | Member VR catalogue |
| `DAT_HASH_INNER_ARCHIVE` | Open zip/7z/rar and hash the inner dump when the outer archive hash misses (default on) |
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
