# GameTheca Desktop Companion

Windows-first companion client for **Download · Install · Update · Uninstall** against a GameTheca server.

## Stack

| Layer | Choice |
|---|---|
| Shell | [Tauri 2](https://tauri.app/) |
| UI | Vite + vanilla TypeScript |
| API | `@gametheca/api-client` (`frontend/api-client`) |

## Prerequisites

- **Node.js** 20+ and npm
- **Rust** stable (`rustup`) — required for `tauri dev` / `tauri build`
- **Tauri system deps** — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (WebView2 on Windows)

## Quick start

```bash
cd clients/desktop
npm install
npm run tauri:dev
```

This starts the Vite dev server on port **1420** and opens the Tauri window.

### Other commands

| Command | Purpose |
|---|---|
| `npm test` | Run Vitest unit tests (auth, lifecycle, connect, download/install helpers) |
| `npm run dev` | Vite only (browser preview; Tauri invoke calls are no-ops) |
| `npm run build` | Typecheck + production frontend bundle to `dist/` |
| `npm run tauri:build` | Build the desktop binary (requires Rust + icons for bundling) |

## Auth & config persistence

1. Enter your **server base URL** (e.g. `https://gametheca.example.com`).
2. Enter a personal **API token** (`gt_<prefix>_<secret>`) from Admin → API tokens. The token must include the **`write:download`** scope.
3. Click **Connect** — validates via `GET /api/collections`, then loads a library preview via search.
4. Non-secret settings (base URL) are saved to app data as JSON; the API token goes to the OS credential store:

   - Windows: `%APPDATA%\com.gametheca.desktop\config.json` (base URL only) + Windows Credential Manager (`com.gametheca.desktop` / `api_token`)
   - macOS: `~/Library/Application Support/com.gametheca.desktop/config.json` + Keychain
   - Linux: `~/.local/share/com.gametheca.desktop/config.json` + Secret Service

Legacy plaintext `token` fields in `config.json` are migrated into the secure store on next load and scrubbed from the file. `KeychainAdapter` in `src/auth.ts` is wired via `src/keychain.ts` → Tauri `secure_store_*` commands.

## Download & install pipeline

The desktop client downloads **DRM-free library files from your GameTheca server only** (no Steam/GOG acquisition).

### On-disk layout (app data)

| Path | Purpose |
|---|---|
| `downloads/<game-uuid>.zip` | Downloaded archive from the server |
| `installs/<game-uuid>/` | Extracted game files after **Install** |
| `installs.json` | Sidecar map `{ gameUuid: { archivePath, extractPath, exePath? } }` |
| `lifecycle.json` | Local install state machine per game |

Example (Windows):

- `%APPDATA%\com.gametheca.desktop\downloads\…`
- `%APPDATA%\com.gametheca.desktop\installs\…`

### Server flow

1. **Initiate:** `POST /api/downloads/games/<uuid>` (Bearer token) — mirrors web `/download_game/<uuid>` and returns `{ download_id, stream_url }`.
2. **Stream:** `GET /download_zip/<download_id>` with the same Bearer token — same path the web UI uses after adding a game to the download basket.
3. **Install:** extracts the local ZIP into `installs/<uuid>/` via a Rust `zip` command, shallow-searches for a likely `.exe`, and stores paths in `installs.json`.
4. **Uninstall:** deletes the extract folder (and archive by default) and transitions lifecycle state.

Progress text appears on each game card (`Downloading…`, `Extracting…`, errors).

## Lifecycle

Local install state uses `createLifecycleRegistry()` from `src/lifecycle.ts`. Each game card shows the current state and allowed actions (download / install / update / uninstall). The registry panel lists all tracked games.

On startup the desktop app hydrates the registry from app-data JSON via Tauri commands (`load_lifecycle_registry` / `save_lifecycle_registry`). State changes persist automatically.

Supported states: `not_downloaded`, `downloaded`, `installed`, `update_available`.

## Client heartbeat

While connected, the desktop companion POSTs `POST /api/client/heartbeat` every 60 seconds (see `src/heartbeat.ts`). Payload includes optional `device_name`, `client_version`, and a stable `device_id`. The server uses recent heartbeats (5-minute TTL) to set `client_connected: true` on browse/discover/game-details responses so the web UI enables Install/Update/Uninstall actions when the companion is online.

After **two consecutive heartbeat failures**, the UI switches to **Offline**: Download / Update / apply_patch are disabled with an explanation; Play / Install / Uninstall remain available. Queued web commands are nack’d back to `pending` until the companion is reachable again.

## Friends window

**Open friends window** creates or focuses a separate always-on-top Tauri label `social` pointed at `{baseUrl}/social-companion`. Capability file `capabilities/social.json` grants only `core:default` (no FS / launch ACL). Main window keeps create/focus/always-on-top permissions.

## Project layout

```
clients/desktop/
  index.html              # Vite entry
  src/
    auth.ts               # Base URL + Bearer token store
    api.ts                # GamethecaClient wrapper
    lifecycle.ts          # Install state machine
    connection-ux.ts      # Online/offline action gating helpers
    lifecycle-store.ts    # Tauri lifecycle.json persistence
    install-store.ts      # Tauri installs.json sidecar
    paths.ts              # URL/path helpers (tested)
    download.ts           # Initiate + stream + save archive
    install.ts            # ZIP extract + lifecycle install
    uninstall.ts          # Remove local files + lifecycle
    heartbeat.ts          # POST /api/client/heartbeat scheduler
    social-window.ts      # Friends companion webview
    connect.ts            # Connection validation + library preview
    config-store.ts       # Tauri file persistence (base URL; migrates/scrubs plaintext token)
    keychain.ts           # KeychainAdapter → OS credential store
    app.ts                # Minimal UI
  src-tauri/
    src/lib.rs            # Config, secure_store_*, lifecycle, installs, zip extract commands
    tauri.conf.json
    capabilities/         # default (main) + social (least-privilege)
    permissions/
```

## Tests

```bash
cd clients/desktop
npm install
npm test
```

Unit tests mock `fetch`, Tauri `invoke`, and the download initiate API — no live GameTheca server required.

## Out of scope (this track)

- Store publishing / Apple notarization
- Bundled torrent/debrid acquisition (BYO connectors only)
- OIDC / Authentik setup (see server runbooks separately)

## Distribution (unsigned only)

**Product stance:** Windows code-signing certificates will never be pursued. Unsigned `gametheca-desktop.exe` is the supported path. CI (`.github/workflows/desktop-build.yml`) builds and uploads an unsigned artifact — do not set signing secrets. See [desktop-code-signing.md](../../docs/runbooks/desktop-code-signing.md).

## Server prerequisites

- GameTheca server with user API token (`read:library` + **`write:download`** for download/extract)
- HTTPS recommended
