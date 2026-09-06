# Thin client

Connect-only shell for browse / social / Big Picture — **not** Download · Install · Play. Windows, macOS and Linux.

## When to use it

| Seat | Use |
|---|---|
| **Thin** | Lounge laptop, social-only PC, kids machine that should never hold install ACLs |
| **Full companion** | The PC that downloads, extracts, and launches DRM-free titles — [desktop-companion.md](desktop-companion.md) |

Thin has **no** local install pipeline. Install/Update stay on the full companion (or browser download + companion extract).

## Build (unsigned)

```bash
cd clients/desktop
npm install
npm run tauri:build:thin
```

Produces an unsigned **OneirodexThin** installer via `tauri.thin.conf.json` (capabilities: `thin-main` / `thin-library` / `social` only) — `.exe` on Windows, `.dmg` on macOS, `.deb` / `.AppImage` on Linux. The full companion bundles as `Oneirodex`, so the two no longer overwrite each other. Details: [desktop-code-signing.md](../runbooks/desktop-code-signing.md) · all platforms at once: [local-installers.md](../runbooks/local-installers.md).

## Connect

1. **Account → API tokens** → create with the **Thin client** preset (`read:library` + `read:social` + `write:presence`; **no** `write:download`).
2. Copy the one-time secret with **Copy secret** (or select the secret field). Format is `gt_<prefix>_<urlsafe-secret>` — **hyphens and underscores in the secret are normal**. Paste the **entire** string; truncating after a `-` always fails auth.
3. Enter Oneirodex base URL. Optional API token uses the same paste normalize / shape checks as the full companion. **Save** stores URL + token; **Validate token** runs the collections check (same as companion Connect).
4. Open library / Friends only — lifecycle CTAs are out of scope.

Token lives in the OS credential store under the thin app's own service (`com.oneirodex.thin`), not plaintext `config.json` — so installing thin next to the full companion no longer overwrites the companion's token. Credential-store failures surface in status (not opaque “Bad data”).

## Presence

With a token saved, the thin shell heartbeats as `device_kind=thin`, so the seat appears in the operator's device list as a thin client rather than passing for a companion. It is never sent install/update commands: the server gates that on a companion seat **and** a download scope, and the thin preset has neither.

No token? Presence stays quiet and the library / Friends windows fall back to site login — everything else still works.

## What the library window looks like

The thin shell opens the member app marked as a thin seat, so Game details shows one honest line — *“Browse & social seat — download, install and update happen on the desktop companion”* — instead of Download / Install / Update / Uninstall buttons that this seat can never complete. Moonlight streaming stays available; it is not a local install.

## Honesty

- **Unsigned only** — no code-signing cert on any platform.
- Thin ≠ Android APK. Phone/tablet / Quest sideload is a future spike only.
- Headset `/vr` is browse-first (SteamVR / PSVR2 on the PC; Quest = friend PWA) — [controllers-and-vr.md](controllers-and-vr.md).
