#!/bin/bash
# HellfireNAS app-stack update after a ship. App tree only — never touch Unraid OS.
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
cd "$ROOT"

echo "== git pull =="
git -c safe.directory=* pull --ff-only

echo "== docker compose up -d --build =="
docker compose up -d --build

echo "== wait readyz =="
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:5006/readyz >/dev/null; then
    echo "readyz ok after ${i} attempts"
    break
  fi
  sleep 4
  if [ "$i" -eq 90 ]; then
    echo "readyz timed out" >&2
    exit 1
  fi
done

echo "== reset default themes (in-container) =="
docker exec oneirodex-app python -c "
from pathlib import Path
import shutil
from oneirodex.utils.preset_themes import install_preset_themes
app_root = Path('/app/oneirodex')
src = app_root / 'setup' / 'default_theme'
dst = app_root / 'static' / 'library' / 'themes' / 'default'
assert src.is_dir(), src
if dst.exists():
    shutil.rmtree(dst)
dst.parent.mkdir(parents=True, exist_ok=True)
shutil.copytree(src, dst)
n = install_preset_themes(str(dst.parent), str(src), force=True)
print(f'reset default theme + {n} presets')
"

echo "== verify rail tokens =="
docker exec oneirodex-app grep -E "od-rail-mark-expanded:|od-rail-icon-w: 0.7" \
  /app/oneirodex/static/library/themes/default/css/od-density.css | head -6

echo "== done =="
curl -s http://127.0.0.1:5006/readyz | head -c 400
echo
