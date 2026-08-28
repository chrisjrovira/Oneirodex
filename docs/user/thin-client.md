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

Produces unsigned `gametheca-desktop.exe` via `tauri.thin.conf.json` (capabilities: `thin-main` / `thin-library` / `social` only). Copy to `Oneirodex-thin.exe` **before** rebuilding the full companion — both flavors share the same Cargo output path. Details: [desktop-code-signing.md](../runbooks/desktop-code-signing.md).

## Connect

1. **Account → API tokens** → create with the **Thin client** preset (`read:library` + `read:social` + `write:presence`; **no** `write:download`).
2. Copy the one-time secret with **Copy secret** (or select the secret field). Format is `gt_<prefix>_<urlsafe-secret>` — **hyphens and underscores in the secret are normal**. Paste the **entire** string; truncating after a `-` always fails auth.
3. Enter Oneirodex base URL. Optional API token uses the same paste normalize / shape checks as the full companion. **Save** stores URL + token; **Validate token** runs the collections check (same as companion Connect).
4. Open library / Friends only — lifecycle CTAs are out of scope.

Token lives in the OS credential store (same pattern as the full companion), not plaintext `config.json`. Credential-store failures surface in status (not opaque “Bad data”).

## Honesty

- **Unsigned only** — no Windows code-signing cert.
- Thin ≠ Android APK. Phone/tablet / Quest sideload is a future spike only.
- Headset `/vr` is browse-first (SteamVR / PSVR2 on the PC; Quest = friend PWA) — [controllers-and-vr.md](controllers-and-vr.md).
