#!/bin/bash
# Hot-copy WebRetro play shell into oneirodex-app (no image rebuild).
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
APP=oneirodex-app
SRC="$ROOT/oneirodex/static/vendor/webretro"
DST="$APP:/app/oneirodex/static/vendor/webretro"

docker cp "$SRC/webretro.html" "$DST/webretro.html"
docker cp "$SRC/standalone.html" "$DST/standalone.html"
docker cp "$SRC/play-skins.css" "$DST/play-skins.css"
docker cp "$SRC/play-skins.assert.mjs" "$DST/play-skins.assert.mjs"
docker cp "$SRC/od-bridge.js" "$DST/od-bridge.js"
docker cp "$SRC/assets/base.js" "$DST/assets/base.js"
echo "webretro play shell hot-copied"
