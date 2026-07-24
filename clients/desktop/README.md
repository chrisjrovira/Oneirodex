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
4. Credentials are saved to app data as JSON:

   - Windows: `%APPDATA%\com.gametheca.desktop\config.json`
   - macOS: `~/Library/Application Support/com.gametheca.desktop/config.json`
   - Linux: `~/.local/share/com.gametheca.desktop/config.json`

`KeychainAdapter` in `src/auth.ts` remains a hook for future OS keychain integration (`src/keychain.ts` is a stub).

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

## Project layout

```
clients/desktop/
  index.html              # Vite entry
  src/
    auth.ts               # Base URL + Bearer token store
    api.ts                # GamethecaClient wrapper
    lifecycle.ts          # Install state machine
    lifecycle-store.ts    # Tauri lifecycle.json persistence
    install-store.ts      # Tauri installs.json sidecar
    paths.ts              # URL/path helpers (tested)
    download.ts           # Initiate + stream + save archive
    install.ts            # ZIP extract + lifecycle install
    uninstall.ts          # Remove local files + lifecycle
    heartbeat.ts          # POST /api/client/heartbeat scheduler
    connect.ts            # Connection validation + library preview
    config-store.ts       # Tauri file persistence (app data)
    keychain.ts           # KeychainAdapter stub
    app.ts                # Minimal UI
  src-tauri/
    src/lib.rs            # Config, lifecycle, installs, zip extract commands
    tauri.conf.json
    capabilities/
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
- Hydra-style torrent/debrid acquisition
- OIDC / Authentik setup (see server runbooks separately)

## Code signing (optional)

Unsigned local builds are fine. For distribution, see [desktop-code-signing.md](../../docs/runbooks/desktop-code-signing.md) and `.github/workflows/desktop-build.yml`.

## Server prerequisites

- GameTheca server with user API token (`read:library` + **`write:download`** for download/extract)
- HTTPS recommended
