# Desktop distribution — unsigned only (Windows / Tauri)

## Product stance — unsigned only

**Windows code-signing certificates will never be pursued.** Unsigned desktop builds are the supported distribution path for Oneirodex.

Do **not** buy an EV (or any) code-signing cert for this product. Operators should not set signing secrets in GitHub. SmartScreen / AV noise on first run of an unknown `.exe` is an accepted tradeoff for self-hosted household use.

## Supported builds

`clients/desktop/src-tauri/tauri.conf.json` keeps `bundle.active: false` so builds produce bare unsigned EXEs (no MSI/NSIS).

| Flavor | Command | Output (same Cargo binary name) | Copy for distribution |
|---|---|---|---|
| **Full companion** | `npm run tauri:build` | `src-tauri/target/release/oneirodex-desktop.exe` | Keep as `Oneirodex-full.exe` |
| **Thin client** | `npm run tauri:build:thin` | Same path (overwrites) — uses `tauri.thin.conf.json` + `VITE_CLIENT_MODE=thin` via `--mode thin` / `.env.thin` | Copy to `Oneirodex-thin.exe` **before** rebuilding the other flavor |

Thin build uses capabilities `thin-main` / `thin-library` / `social` (no install/FS lifecycle ACL). Full uses `default` + `social`.

Icons live under `clients/desktop/src-tauri/icons/` (generate with `npx tauri icon path/to/app-icon.png` if missing).

No env vars required for unsigned build. Do not enable bundling or certificate thumbprints in the base config.

## GitHub Actions

Workflow [`.github/workflows/desktop-build.yml`](../../.github/workflows/desktop-build.yml) builds and uploads an **unsigned** `oneirodex-desktop.exe`. There is no signing step.

## Historical note

Earlier CI drafts included an optional `signtool` path gated on `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD`. That path is **unsupported and removed** from the workflow. Do not reintroduce cert purchase or signing secrets. Apple notarization, Linux package signing, and cloud HSM flows remain out of scope.

## Installers (later, still unsigned)

If MSI/NSIS packaging is added later:

1. Add Tauri icons under `clients/desktop/src-tauri/icons/`
2. Prefer a CI-only config overlay with `bundle.active: true`; keep day-to-day base unsigned
3. Do **not** wire `bundle.windows.certificateThumbprint` or org certs
