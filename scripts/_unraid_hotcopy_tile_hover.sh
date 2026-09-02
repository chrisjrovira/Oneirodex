#!/bin/bash
# Hot-copy tile-hover theme CSS + member-app dist into oneirodex-app (no rebuild).
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
APP=oneirodex-app

docker cp "$ROOT/oneirodex/setup/default_theme/css/components.css" \
  "$APP:/app/oneirodex/setup/default_theme/css/components.css"
docker cp "$ROOT/oneirodex/setup/default_theme/css/od-shell.css" \
  "$APP:/app/oneirodex/setup/default_theme/css/od-shell.css"
docker cp "$ROOT/oneirodex/setup/default_theme/css/od-era.css" \
  "$APP:/app/oneirodex/setup/default_theme/css/od-era.css"
# od-era carries era-specific topbar/hover stack (beats shell alone).
docker cp "$ROOT/oneirodex/static/dist/member-app/." \
  "$APP:/app/oneirodex/static/dist/member-app/"

docker exec -i "$APP" python - <<'PY'
from pathlib import Path
import shutil

from oneirodex.routes import clear_theme_asset_versions
from oneirodex.utils.preset_themes import install_preset_themes

app_root = Path('/app/oneirodex')
src = app_root / 'setup' / 'default_theme'
dst = app_root / 'static' / 'library' / 'themes' / 'default'
if dst.exists():
    shutil.rmtree(dst)
dst.parent.mkdir(parents=True, exist_ok=True)
shutil.copytree(src, dst)
n = install_preset_themes(str(dst.parent), str(src), force=True)
clear_theme_asset_versions()
print(f'reset default theme + {n} presets; cleared asset memo')
PY
