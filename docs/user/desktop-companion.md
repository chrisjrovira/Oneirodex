# Desktop companion

Optional **Tauri** client under `clients/desktop/` for Install / Update / Uninstall / Play on your PC. The web UI still downloads archives to the browser; the companion extracts and launches locally.

## Connect

1. Open **Account → API tokens** (`/tokens`) — or create via `POST /api/tokens` if you prefer the API.
2. Create a token with the **Desktop companion** preset (`read:library` + `write:download`), or **Thin client** for connect-only seats.
3. Copy the one-time secret (`gt_<hexprefix>_<urlsafe-secret>`) — it is shown only once. The secret uses URL-safe base64 (`A–Z`, `a–z`, `0–9`, `_`, `-`), so **hyphens and underscores in the secret are normal**. Paste the **entire** `gt_…` string into Connect. Truncating at a `-` (or any earlier character) always fails auth. On plain HTTP LAN, browser clipboard may be limited — use **Copy secret** (copies the raw token only) or select the one-time secret field and Ctrl+C / ⌘C.
4. Open the companion, enter your Oneirodex **base URL** and token, Connect. Paste is normalized (whitespace/newlines, BOM/zero-width, wrapping quotes, first `gt_…` match from labeled/HTML junk) — hyphens inside the secret are kept. Status distinguishes invalid shape, 401 (wrong/truncated secret), network/TLS/CORS, and OS credential-store failures. Companion console logs `[Oneirodex:connect]` / `[Oneirodex:keyring]` (prefix only, never the secret) when the server log is empty.
5. Library preview loads via search; local lifecycle syncs with the server when available.
6. Status shows **Online** / **Offline (server unreachable)** / **Not connected**. After two failed heartbeats, Download and Update are disabled; Play, Install, and Uninstall still run locally. Web-queued Install/Update commands stay pending until heartbeat recovers (nack → retry).

**Thin client:** For connect-only seats (no Download/Install/Play), build `npm run tauri:build:thin` — user guide [thin-client.md](thin-client.md) · [desktop-code-signing.md](../runbooks/desktop-code-signing.md). Use the **Thin client** token preset (`read:social` / presence; no `write:download`). Optional thin API token uses the **same** normalize / shape / validate helpers as the full companion (**Validate token**); stored in the same OS credential store (not `config.json`).

**Security note:** The API token is stored in the OS credential store (Windows Credential Manager on Windows; Keychain / Secret Service elsewhere), not in plaintext `config.json`. Older installs that still have a token in JSON are migrated into the secure store on next Connect/load and scrubbed from the file. Caveat: anyone with your Windows user session can still read Credential Manager entries for this app.

## Friends window

**Open friends window** opens (or focuses) a compact always-on-top Tauri popup (~360×560) anchored to the **bottom-right** of the work area (Windows taskbar-aware via `screen.avail*`), pointed at `/social-companion`. It is a Steam/Discord-friends-style overlay — not a fullscreen takeover of the companion. A second click focuses the existing window (keeps wherever you dragged it). Browser fallback uses the same size/`left`/`top` features when not running under Tauri.

### Auth: Friends vs main companion

| Window | How you authenticate |
|---|---|
| **Main companion** | Oneirodex **API token** stored in the **OS keyring** (Credential Manager / Keychain) after Connect — used for library, download, and lifecycle APIs |
| **Friends window** | Ordinary **site session cookies** in that webview — sign in with your household **site account** (same as the browser). The companion API token is **not** injected into Friends |

Signing in on Friends does not replace Connect on the main window, and Connect does not log you into Friends.

| Situation | What you see |
|---|---|
| **No Server URL** | Status error — set Server URL first (no silent no-op) |
| **Server URL only (not Connect)** | Window opens from the **current Server URL field** (not a stale Connect auth base); sign in with your **site account** in that webview (companion API token not required) |
| **Companion Offline** | Window still opens/focuses; status warns the page may not load until the server is reachable again. Heartbeat Offline does **not** disable Open friends |
| **Already open** | Existing always-on-top popup is shown and focused (position preserved) |
| **Server URL changed while open** | Previous Friends webview is closed and recreated at the new `/social-companion` origin |

The Friends webview is least-privilege (browse only); install/launch ACLs stay on the main window.

## Lifecycle

| Action | Local effect |
|---|---|
| Download | Streams archive into the companion downloads folder (chunked append) |
| Install | Extracts zip into installs folder |
| Update | Downloads into a `.staging` folder, swaps into place, then marks installed |
| Uninstall | Removes extract dir, leftover `.staging`, and archive (by default) |
| Play | Launches detected / stored exe |
| Cheat staging | Before RetroArch companion launch, downloads library `.cht` into `app_data/cheats/{gameUuid}/` **only when** launch/payload `cheat_surface=retroarch` (Wave 19 GM lock). Never stages for PCWIN/PCDOS/MAC/OTHER (`pc_wand` / soft-hide). Tauri ACL allows `downloads` + `cheats`. |
| Translation patch apply | When `ENABLE_ROM_PATCH_APPLY=true` and `FLIPS_PATH` is set, stages `.ips`/`.bps` under `app_data/patches/` and runs Flips CLI — [translation-patches.md](translation-patches.md) |
| Mod pack apply (MOD-3) | When `ENABLE_MOD_TRACKING=true` and the companion is **Online**, **Apply mods** fetches enabled mod metadata, downloads BYO `source_url` files into `app_data/mods/{gameUuid}/`, and applies them path-safely into the local install folder. **Offline:** button disabled — reconnect to fetch metadata and URLs. **WebRetro cannot apply PC mods** — companion-only. Queued web command: `apply_mod_pack` via heartbeat. |
| Show in Explorer / open path | Companion opens an absolute path in the OS file manager (Windows Explorer first; Finder / `xdg-open` elsewhere). Local installs: **Show in Explorer** on installed titles (path must sit under the companion installs root). Library / unmatched: web queues `open_path` via `POST /api/client/commands`; companion reveals when Online and the path exists on **this** PC. |

When search marks `has_updates` (or `lifecycle_state=update_available`) and the title is locally **installed**, Connect flips it to **Update available**.

Browser WebRetro still applies cheats via the in-page Emscripten FS bridge when `cheat_surface=retroarch`; use the companion path for heavy/native RetroArch systems when the browser FS cannot write. Author or upload `.cht` files on game details → **Cheats** (same library the play bar lists). PC / native (`PCWIN`/`PCDOS`/`MAC`/`OTHER`): notes or BYO trainer only — companion never stages `.cht`.

## Open path (Explorer / Finder)

The browser cannot open Unraid/host paths. When the companion is Online:

1. **Local install** — use **Show in Explorer** in the companion (no server command).
2. **Member library / admin unmatched** — queue `action: "open_path"` with an absolute `path` the companion machine can see (mapped drive / UNC / local mount). Heartbeat delivers it; companion validates (absolute, no `..`, no control chars, path exists) then opens Explorer / Finder.

### How UI should invoke

| Caller | Call | Notes |
|---|---|---|
| Member SPA (game folder) | **OpenPathModal** → `POST /api/client/commands` `{ action: "open_path", path, game_uuid?, select? }` | Prefer admin `full_disk_path` / `server_path` or game disk path the household PC can resolve; clipboard fallback only — **no** Auto Scan jump |
| Admin unmatched / Dupe glance | Same queue with unmatched `folder_path` (`game_uuid` may be `""`) | OpenPathModal + clipboard when companion offline — **no** Auto Scan redirect |
| Companion itself | Tauri `reveal_path_in_os` via **Show in Explorer** (also heartbeat `open_path`) | Installs root allowlisted |

**Server allowlist:** enqueue rejects paths outside configured library roots (`DATA_FOLDER_GAMES` / `BASE_FOLDER_*`) and library `last_scan_folder` values — clear `400` with the validation message. `open_path` is allowlisted in `client_commands`. `GET /api/path/open` remains path-info only (admin).

**Safe path checks (companion):** absolute only · reject `..` segments · reject null/CR/LF · max 4096 chars · must exist on the companion host · local-install reveal also under `app_data/installs`.

**Mount caveat:** Docker/Unraid paths like `/mnt/user/games/…` will fail unless that exact path exists on the companion PC. Send the Windows/macOS-visible path (e.g. `Z:\games\…` or UNC).

## Limits (this polish pass)

- **Unsigned only (product stance).** CI ships unsigned `oneirodex-desktop.exe`; Windows code-signing certs will never be pursued ([desktop-code-signing.md](../runbooks/desktop-code-signing.md)).
- Emulator systems that are companion-only still need the mapped core / external app — see [browser-play.md](browser-play.md).

## Troubleshooting

| Symptom | Likely cause | What to try |
|---|---|---|
| Connect 401 / 403 | Bad token, missing scopes, or truncated paste | Recreate token; need `read:library` (+ `write:download`). Paste the **full** `gt_<prefix>_<secret>` — hyphens/`_` inside the secret are normal; truncating after `-` always fails. Server logs `api_token_auth_failed reason=… prefix=…` (never the secret) when Bearer verify fails |
| Connect “invalid token” / bad shape | Extra chars copied with the secret, or cut at `-` | Use **Copy secret** on Account → API tokens (raw string only), or select the one-time secret field. Do not copy the name/prefix label line |
| Connect network / “failed to load” | Wrong URL, TLS/CORS, or server down | Check base URL (origin only); open companion DevTools for `[Oneirodex:connect]` — server may log nothing |
| Connect “Bad data” / credential store | OS keyring persist failed after validate | Check Windows Credential Manager; retry Connect; see `[Oneirodex:keyring]` in console |
| Connect 404 | Wrong base URL | Use origin only (no `/api` suffix) |
| Download / update fails with permission | Missing Tauri ACL for append/rename | Rebuild companion from this repo |
| Download / Update buttons disabled | Companion Offline banner | Re-Connect or wait for heartbeat; Play/Install/Uninstall still work |
| Friends window permission errors on install | Social webview has no FS ACL (by design) | Use lifecycle actions in the **main** companion window |
| Update button missing | Server didn’t flag updates | Refresh Connect; check freshness inbox on web |
| Staging folder left behind | Failed update mid-swap | Uninstall the title (cleans `.staging`) or delete `…/<uuid>.staging` |
| Cheat not applied in native RetroArch | Missing `cheat_surface=retroarch`, PC platform, or core needs Quick Menu load | Confirm browse/launch payload has `cheat_surface=retroarch` (not PCWIN/PCDOS/MAC/OTHER). Then Quick Menu → Cheats → Load Cheat File from companion `cheats/{uuid}/` |
| Apply patch fails / button missing | Flag off or Flips missing | Set `ENABLE_ROM_PATCH_APPLY` + `FLIPS_PATH`, or apply manually with Flips |
| Apply mods disabled / fails | Companion offline, no install, or empty mod list | Re-Connect (Online); install locally first; librarian must add enabled mods with BYO URLs. WebRetro cannot load PC mods. |
| Open path / Show in Explorer fails | Path missing on this PC, relative path, or companion offline for queued open | Use a mapped/UNC path the companion can see; for local installs use **Show in Explorer**; keep clipboard / Auto Scan fallback on admin unmatched when companion is offline |

Related: [downloads.md](downloads.md) · [browser-play.md](browser-play.md) · [translation-patches.md](translation-patches.md) · [social-and-voice.md](social-and-voice.md) — Friends window section mirrors web dock / pop-out / Big Picture **Y**
