#!/bin/bash
# Hot-copy operator-vendored WebRetro WASM cores into oneirodex-app.
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
APP=oneirodex-app
SRC="$ROOT/oneirodex/static/vendor/webretro/cores"
DST="$APP:/app/oneirodex/static/vendor/webretro/cores"

docker cp "$SRC/." "$DST/"
echo "webretro cores hot-copied: $(ls "$SRC"/*_libretro.wasm 2>/dev/null | wc -l) wasm"
