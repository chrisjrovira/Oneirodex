#!/usr/bin/env bash
# Historical P3b cutover. The live rename already ran 2026-08-31.
# Use scripts/_p3b_rebuild.sh to rebuild, or scripts/_p3b_finish_db.sh
# if Postgres is still named gametheca.
set -eu
echo 'P3b cutover already applied. Refusing to re-run mechanical rename.'
echo 'Rebuild: bash scripts/_p3b_rebuild.sh'
echo 'DB rename only: bash scripts/_p3b_finish_db.sh'
exit 0
