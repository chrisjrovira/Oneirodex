#!/usr/bin/env bash
# Build Oneirodex desktop installers locally — no GitHub Actions required.
#
# Tauri bundles for the host it runs on. That is a hard platform constraint, not
# a configuration gap:
#
#   Windows  -> .exe (NSIS) + .msi          buildable on Windows only
#   macOS    -> .dmg + .app                 buildable on macOS only (codesign,
#                                           hdiutil and the .icns toolchain are
#                                           Apple-only)
#   Linux    -> .deb + .rpm + .AppImage     buildable on Linux, or from any host
#                                           via the Docker path below
#
# So a Windows box can produce Windows installers directly and Linux ones
# through Docker, but a .dmg genuinely requires a Mac. There is no cross-compile
# for it, with or without CI.
#
#   ./scripts/build-installers.sh            # bundle for this host
#   ./scripts/build-installers.sh --linux    # Linux bundles via Docker
#   ./scripts/build-installers.sh --thin     # thin client config
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$REPO/clients/desktop"
OUT="$REPO/dist-installers"

THIN=0
LINUX_DOCKER=0
for arg in "$@"; do
  case "$arg" in
    --thin)  THIN=1 ;;
    --linux) LINUX_DOCKER=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

host_os() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) echo windows ;;
    Darwin) echo macos ;;
    Linux)  echo linux ;;
    *) echo unknown ;;
  esac
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required tool: $1" >&2
    echo "  $2" >&2
    exit 1
  }
}

mkdir -p "$OUT"

if [ "$LINUX_DOCKER" = "1" ]; then
  require docker "install Docker Desktop, or run this script on a Linux host"
  echo "==> Linux bundles via Docker (deb / rpm / AppImage)"
  # The image needs the GTK/webkit headers Tauri links against; those are the
  # actual reason a Linux bundle cannot be produced natively on Windows.
  docker run --rm \
    -v "$REPO":/src \
    -w /src/clients/desktop \
    -e CI=true \
    rust:1-bookworm \
    bash -lc '
      set -e
      apt-get update -qq
      apt-get install -y -qq --no-install-recommends \
        libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
        librsvg2-dev patchelf file nodejs npm >/dev/null
      npm ci --no-audit --no-fund
      npm run tauri:build
    '
  find "$REPO/clients/desktop/src-tauri/target" -type f \
    \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \) \
    -exec cp -v {} "$OUT/" \;
  echo "==> Linux installers in $OUT"
  exit 0
fi

OS="$(host_os)"
echo "==> host: $OS"

require cargo "install Rust: https://rustup.rs"
require npm   "install Node 20+"

cd "$DESKTOP"
npm ci --no-audit --no-fund

if [ "$THIN" = "1" ]; then
  npm run tauri:build:thin
else
  npm run tauri:build
fi

case "$OS" in
  windows)
    find src-tauri/target -type f \( -name '*.exe' -o -name '*.msi' \) \
      -path '*bundle*' -exec cp -v {} "$OUT/" \;
    echo "==> Windows installers in $OUT"
    ;;
  macos)
    find src-tauri/target -type f -name '*.dmg' -exec cp -v {} "$OUT/" \;
    echo "==> macOS disk image in $OUT"
    echo "    Unsigned by default — Gatekeeper will warn until it is signed and"
    echo "    notarised with an Apple Developer ID."
    ;;
  linux)
    find src-tauri/target -type f \
      \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \) \
      -exec cp -v {} "$OUT/" \;
    echo "==> Linux installers in $OUT"
    ;;
  *)
    echo "unrecognised host; bundles left under src-tauri/target/*/bundle" >&2
    ;;
esac
