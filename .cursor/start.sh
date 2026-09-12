#!/usr/bin/env bash
# Per-boot reconciliation: bring PostgreSQL online. Idempotent; returns once ready.
set -euo pipefail

PG_VERSION=17

echo "==> Starting PostgreSQL cluster ${PG_VERSION}"
sudo pg_ctlcluster "${PG_VERSION}" main start || true

for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    echo "==> PostgreSQL is ready"
    exit 0
  fi
  sleep 1
done

echo "!! PostgreSQL did not become ready in time" >&2
exit 1
