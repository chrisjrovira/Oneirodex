#!/usr/bin/env bash
# Per-boot reconciliation: bring PostgreSQL online. Idempotent; returns once ready.
set -euo pipefail

PG_VERSION=17

# A snapshot/restore can leave a stale postmaster.pid from the build-time
# postmaster. If the cluster is down but a pid file remains, remove it so the
# cluster can start cleanly.
PGDATA="/var/lib/postgresql/${PG_VERSION}/main"
if ! sudo -u postgres pg_isready -q 2>/dev/null; then
  if sudo test -f "${PGDATA}/postmaster.pid"; then
    echo "==> Removing stale postmaster.pid"
    sudo rm -f "${PGDATA}/postmaster.pid" || true
  fi
fi

echo "==> Starting PostgreSQL cluster ${PG_VERSION}"
sudo pg_ctlcluster "${PG_VERSION}" main start || true

for _ in $(seq 1 60); do
  if sudo -u postgres pg_isready -q; then
    echo "==> PostgreSQL is ready"
    exit 0
  fi
  sleep 1
done

echo "!! PostgreSQL did not become ready in time" >&2
exit 1
