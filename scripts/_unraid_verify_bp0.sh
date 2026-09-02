#!/bin/bash
set -euo pipefail
ROOT=/mnt/user/infernal-data-streams/_projects/Oneirodex
docker exec -i oneirodex-app python - <<'PY'
from oneirodex import create_app
from oneirodex.utils.browser_player import get_browser_player_settings, play_engine_fields

app = create_app()
rules = [str(r) for r in app.url_map.iter_rules() if 'browser-player' in str(r)]
print('routes', rules)
with app.app_context():
    print('settings', get_browser_player_settings())
    print('play_fields', play_engine_fields())
with app.test_client() as client:
    # unauthenticated should 401/302/403 — just prove the route exists
    resp = client.get('/api/browser-player-settings')
    print('GET /api/browser-player-settings', resp.status_code)
PY
echo "== wait 50s for scan progress =="
sleep 50
bash "$ROOT/scripts/_unraid_scan_status.sh"
