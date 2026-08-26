#!/usr/bin/env bash
# Launch GameTheca for agent verification.
#
# Does what startweb_windows.cmd / startweb.sh do — load .env, run the startup
# initialisation, then uvicorn — with three differences that matter when an
# agent (not an operator) is driving:
#
#   * points at the TEST database, so exercising delete/refuse paths cannot
#     touch a real library;
#   * forces UTF-8 stdio, because ASGI startup prints an emoji and a Windows
#     cp1252 console kills uvicorn before it serves a single request;
#   * runs one worker on a spare port, so it does not fight a real instance.
#
# Usage:  bash .cursor/skills/run-gametheca/serve.sh              # test DB, port 5099
#         GT_PORT=5150 bash .cursor/skills/run-gametheca/serve.sh
#         GT_DB_URL=postgresql://... bash .cursor/skills/run-gametheca/serve.sh
#
# Stop it with `bash .cursor/skills/run-gametheca/serve.sh --stop` — killing the
# shell that launched this leaves uvicorn orphaned and still holding the port.
set -euo pipefail

GT_PORT="${GT_PORT:-5099}"

if [ "${1:-}" = "--stop" ]; then
  pid=$(netstat -ano 2>/dev/null | awk -v p=":$GT_PORT" '$2 ~ p"$" && $4=="LISTENING" {print $5; exit}')
  if [ -n "${pid:-}" ]; then
    taskkill //PID "$pid" //F >/dev/null 2>&1 || kill -9 "$pid" 2>/dev/null || true
    echo "[serve] killed pid $pid on port $GT_PORT"
  else
    echo "[serve] nothing listening on port $GT_PORT"
  fi
  exit 0
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO"

[ -f .env ] || { echo "no .env at $REPO — copy .env.example first" >&2; exit 1; }

# .env is KEY=VALUE. The batch script loads it; running uvicorn by hand does
# not, and config.py raises on a missing SECRET_KEY at import time.
set -a
while IFS= read -r line; do
  case "$line" in ''|\#*) continue;; esac
  case "${line%%=*}" in [A-Za-z_]*) export "$line";; esac
done < .env
set +a

export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1
export DATABASE_URL="${GT_DB_URL:-postgresql://postgres:postgres@localhost:5432/gamethecatest}"
# Set *after* the .env load and unconditionally: .env carries PORT=5006, which
# would otherwise win and collide with a real local instance.
export PORT="$GT_PORT"
export SESSION_COOKIE_SECURE=False
export REMEMBER_COOKIE_SECURE=False

echo "[serve] database : ${DATABASE_URL##*/}"
echo "[serve] port     : $PORT"

# Same guard conftest.py uses: refuse to bootstrap credentials against a
# database whose name does not say "test".
case "${DATABASE_URL##*/}" in
  *test*)
    python - <<'PY'
from uuid import uuid4
from gametheca import create_app, db
from gametheca.models import User
app = create_app(); app.app_context().push()
# Own a dedicated account rather than resetting some existing admin's password
# — the test database is shared with the pytest suite, and those users belong
# to fixtures that may assert on their state.
u = db.session.query(User).filter_by(name='RunSkillAdmin').first()
if u is None:
    u = User(name='RunSkillAdmin', email='runskill@example.test', role='admin',
             user_id=str(uuid4()))
    db.session.add(u)
u.role = 'admin'
u.state = True
u.is_email_verified = True
u.set_password('VerifyRun!2026')
db.session.commit()
print(f'[serve] admin    : {u.name}')
PY
    ;;
  *) echo "[serve] admin    : skipped (non-test database)";;
esac

python -c "
from gametheca.init_manager import run_complete_startup_initialization
import sys
sys.exit(0 if run_complete_startup_initialization() else 1)
" >/dev/null || { echo '[serve] startup initialisation FAILED' >&2; exit 1; }

export GAMETHECA_MIGRATIONS_COMPLETE=true
export GAMETHECA_INITIALIZATION_COMPLETE=true
echo "[serve] starting uvicorn on http://127.0.0.1:$PORT"
exec uvicorn asgi:asgi_app --host 127.0.0.1 --port "$PORT" --workers 1
