# Building installers without GitHub

Produce Windows, macOS and Linux desktop installers on your own machine. The
CI workflow (`.github/workflows/desktop-build.yml`) is a convenience, not a
requirement.

```bash
./scripts/build-installers.sh            # bundle for this host
./scripts/build-installers.sh --linux    # Linux bundles via Docker
./scripts/build-installers.sh --thin     # thin-client config
```

Output lands in `dist-installers/`.

## What each host can build

| Host | Produces | Notes |
|---|---|---|
| Windows | `.exe` (NSIS), `.msi` | Native. Needs Rust + Node 20. |
| Linux | `.deb`, `.rpm`, `.AppImage` | Native, or from any host with `--linux`. |
| macOS | `.dmg`, `.app` | **Mac required** — see below. |

## Why macOS needs a Mac

This is the one real constraint and it is not something CI hides from you.
Tauri's macOS bundler shells out to `hdiutil` for the disk image, `codesign`
for signing and the `.icns` toolchain for icons. All three are Apple-only and
none of them cross-compile. GitHub Actions builds `.dmg` by renting a macOS
runner, not by cross-compiling — so dropping CI does not lose a capability you
otherwise had.

If you have no Mac, the options are a macOS runner, a rented build host, or
shipping Windows and Linux only.

## Prerequisites

- **Rust** — <https://rustup.rs>
- **Node 20+**
- **Windows**: MSVC build tools + WebView2 (present on Windows 11)
- **Linux/Docker**: the script installs `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`
  and friends inside the container. Those headers are exactly why a Linux
  bundle cannot be produced natively on Windows.

## Signing

Bundles are **unsigned** by default, which matches the project's stance that the
companion is unsigned unless an operator supplies certificates.

- Windows: SmartScreen warns on first run.
- macOS: Gatekeeper blocks until signed *and* notarised with an Apple
  Developer ID — signing alone is not enough on current macOS.

## Unraid

The server image is separate from the desktop companion. For the Unraid
template's icon field, point at the running server:

```
http://<unraid-ip>:5006/static/icons/oneirodex-256.png
```

`oneirodex-512.png` sits alongside it. Both ship inside the image under
`/app/oneirodex/static/icons/`.
