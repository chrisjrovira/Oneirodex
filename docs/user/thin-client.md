# Thin client

Connect-only Windows shell for browse / social / Big Picture — **not** Download · Install · Play.

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

Produces unsigned `gametheca-desktop.exe` via `tauri.thin.conf.json` (capabilities: `thin-main` / `thin-library` / `social` only). Copy to `GameTheca-thin.exe` **before** rebuilding the full companion — both flavors share the same Cargo output path. Details: [desktop-code-signing.md](../runbooks/desktop-code-signing.md) · strategy [thin-client.md](../strategy/thin-client.md).

## Connect

1. **Account → API tokens** → create with the **Thin client** preset (`read:library` + `read:social` + `write:presence`; **no** `write:download`).
2. Enter GameTheca base URL + token → Connect.
3. Open library / Friends only — lifecycle CTAs are out of scope.

Token lives in the OS credential store (same pattern as the full companion), not plaintext `config.json`.

## Honesty

- **Unsigned only** — no Windows code-signing cert.
- Thin ≠ Android APK. Phone/tablet / Quest sideload is a future spike only — [android-apk-vr.md](../strategy/android-apk-vr.md).
- Headset `/vr` is browse-first (SteamVR / PSVR2 on the PC; Quest = friend PWA) — [controllers-and-vr.md](controllers-and-vr.md) · [headset-vr.md](../strategy/headset-vr.md).
