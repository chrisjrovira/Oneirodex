# Desktop companion

Optional **Tauri** client under `clients/desktop/` for Install / Update / Uninstall / Play on your PC. The web UI still downloads archives to the browser; the companion extracts and launches locally.

## Connect

1. Create an API token in Account settings with at least `read:library` (add `write:download` for downloads).
2. Open the companion, enter your GameTheca **base URL** and token, Connect.
3. Library preview loads via search; local lifecycle syncs with the server when available.
4. Status shows **Online** / **Offline (server unreachable)** / **Not connected**. After two failed heartbeats, Download and Update are disabled; Play, Install, and Uninstall still run locally. Web-queued Install/Update commands stay pending until heartbeat recovers (nack → retry).

**Thin client:** For connect-only seats (no Download/Install/Play), build `npm run tauri:build:thin` — see [thin-client.md](../strategy/thin-client.md) and [desktop-code-signing.md](../runbooks/desktop-code-signing.md). Use thin token scopes (`read:social` / presence) when available. Optional thin API token is stored in the same OS credential store as the full companion (not `config.json`).

**Security note:** The API token is stored in the OS credential store (Windows Credential Manager on Windows; Keychain / Secret Service elsewhere), not in plaintext `config.json`. Older installs that still have a token in JSON are migrated into the secure store on next Connect/load and scrubbed from the file. Caveat: anyone with your Windows user session can still read Credential Manager entries for this app.

## Friends window

**Open friends window** opens (or focuses) an always-on-top Tauri webview at `/social-companion`. A second click focuses the existing window instead of opening another.

### Auth: Friends vs main companion

| Window | How you authenticate |
|---|---|
| **Main companion** | GameTheca **API token** stored in the **OS keyring** (Credential Manager / Keychain) after Connect — used for library, download, and lifecycle APIs |
| **Friends window** | Ordinary **site session cookies** in that webview — sign in with your household **site account** (same as the browser). The companion API token is **not** injected into Friends |

Signing in on Friends does not replace Connect on the main window, and Connect does not log you into Friends.

| Situation | What you see |
|---|---|
| **No Server URL** | Status error — set Server URL first (no silent no-op) |
| **Server URL only (not Connect)** | Window opens from the **current Server URL field** (not a stale Connect auth base); sign in with your **site account** in that webview (companion API token not required) |
| **Companion Offline** | Window still opens/focuses; status warns the page may not load until the server is reachable again. Heartbeat Offline does **not** disable Open friends |
| **Already open** | Existing always-on-top window is shown and focused |
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
| Cheat staging | Before RetroArch companion launch, downloads library `.cht` into `app_data/cheats/{gameUuid}/` (Tauri ACL allows `downloads` + `cheats`) |
| Translation patch apply | When `ENABLE_ROM_PATCH_APPLY=true` and `FLIPS_PATH` is set, stages `.ips`/`.bps` under `app_data/patches/` and runs Flips CLI — [translation-patches.md](translation-patches.md) |
| Mod pack apply (MOD-3) | When `ENABLE_MOD_TRACKING=true` and the companion is **Online**, **Apply mods** fetches enabled mod metadata, downloads BYO `source_url` files into `app_data/mods/{gameUuid}/`, and applies them path-safely into the local install folder. **Offline:** button disabled — reconnect to fetch metadata and URLs. **WebRetro cannot apply PC mods** — companion-only. Queued web command: `apply_mod_pack` via heartbeat. |

When search marks `has_updates` (or `lifecycle_state=update_available`) and the title is locally **installed**, Connect flips it to **Update available**.

Browser WebRetro still applies cheats via the in-page Emscripten FS bridge; use the companion path for heavy/native RetroArch systems when the browser FS cannot write.

## Limits (this polish pass)

- **Unsigned only (product stance).** CI ships unsigned `gametheca-desktop.exe`; Windows code-signing certs will never be pursued ([desktop-code-signing.md](../runbooks/desktop-code-signing.md)).
- Emulator systems that are companion-only still need the mapped core / external app — see [browser-play.md](browser-play.md).

## Troubleshooting

| Symptom | Likely cause | What to try |
|---|---|---|
| Connect 401 / 403 | Bad token or missing scopes | Recreate token; need `read:library` (+ `write:download`) |
| Connect 404 | Wrong base URL | Use origin only (no `/api` suffix) |
| Download / update fails with permission | Missing Tauri ACL for append/rename | Rebuild companion from this repo |
| Download / Update buttons disabled | Companion Offline banner | Re-Connect or wait for heartbeat; Play/Install/Uninstall still work |
| Friends window permission errors on install | Social webview has no FS ACL (by design) | Use lifecycle actions in the **main** companion window |
| Update button missing | Server didn’t flag updates | Refresh Connect; check freshness inbox on web |
| Staging folder left behind | Failed update mid-swap | Uninstall the title (cleans `.staging`) or delete `…/<uuid>.staging` |
| Cheat not applied in native RetroArch | File staged but core needs Quick Menu load | Open Quick Menu → Cheats → Load Cheat File from companion `cheats/{uuid}/` |
| Apply patch fails / button missing | Flag off or Flips missing | Set `ENABLE_ROM_PATCH_APPLY` + `FLIPS_PATH`, or apply manually with Flips |
| Apply mods disabled / fails | Companion offline, no install, or empty mod list | Re-Connect (Online); install locally first; librarian must add enabled mods with BYO URLs. WebRetro cannot load PC mods. |

Related: [downloads.md](downloads.md) · [browser-play.md](browser-play.md) · [translation-patches.md](translation-patches.md) · [social-and-voice.md](social-and-voice.md) — Friends window section mirrors web dock / pop-out / Big Picture **Y**
