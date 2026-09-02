#!/usr/bin/env bash
# Hot-apply od-shell / od-era into the live image SoT, then Reset Themes.
set -eu
REPO=/mnt/user/infernal-data-streams/_projects/Oneirodex
CTR=oneirodex-app
docker cp "$REPO/oneirodex/setup/default_theme/css/od-shell.css" "$CTR:/app/oneirodex/setup/default_theme/css/od-shell.css"
docker cp "$REPO/oneirodex/setup/default_theme/css/od-era.css" "$CTR:/app/oneirodex/setup/default_theme/css/od-era.css"
# Keep generator stamp in sync so Reset Themes rewrites presets.
docker cp "$REPO/oneirodex/utils/preset_themes.py" "$CTR:/app/oneirodex/utils/preset_themes.py"
docker exec -i "$CTR" python - < "$REPO/scripts/_unraid_reset_themes.py"
docker exec "$CTR" python -c "from oneirodex.utils.preset_themes import GENERATOR_VERSION; print('GENERATOR_VERSION', GENERATOR_VERSION)"
echo '=== DONE hotcopy + reset ==='
