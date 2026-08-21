# Runbook: Container will not start

## Symptoms

- Unraid / Docker shows exited / restart loop
- Logs stop immediately after start
- Healthcheck fails forever
- App unhealthy / restarting while **db is healthy**, logs show `no pg_hba.conf entry … no encryption` (see §3b)

## Checklist (in order)

### 1. SECRET_KEY missing or placeholder

**Log signature:** `RuntimeError: SECRET_KEY environment variable is not set`

**Fix:** Set a strong random `SECRET_KEY` in the container env. Do not use `put_your_own_secret_string_here_32617432`.

### 2. Bash / entrypoint failure

**Log signature:** `exec /bin/bash: no such file` or `entrypoint.sh: not found`

**Fix:** Rebuild from current Dockerfile (installs `bash`). Ensure `entrypoint.sh` has LF line endings (`sed -i 's/\r$//'` is in the Dockerfile).

### 3. Postgres not ready / wrong host

**Log signature:** connection refused to `db` / timeout waiting for PostgreSQL

**Fix:** Confirm `DATABASE_URL` host is reachable from the app container. On Compose, hostname is `db`. On Unraid with external Postgres, use the LAN IP/hostname. Check `POSTGRES_USER` / password / db name match.

### 3b. Postgres up but `pg_hba` rejects app (`no encryption`)

**Log signature:**
```text
FATAL: no pg_hba.conf entry for host "172.x.x.x", user "postgres", database "gametheca", no encryption
```

Postgres is reachable; it is **refusing non-SSL TCP** from the app container IP (common after a hardened / stale volume `pg_hba.conf`).

**Fix (preferred):** Pull current Compose (ships `docker/postgres/pg_hba.conf` + `hba_file=` override) and recreate **db** (keeps data volume):

```bash
docker compose up -d --force-recreate db
docker compose up -d app
```

Confirm active HBA: `docker compose exec db psql -U postgres -d gametheca -c "SHOW hba_file;"` → `/etc/gametheca/pg_hba.conf`.

**Fix (legacy stacks without `hba_file=`):** only when `SHOW hba_file` still points at `$PGDATA/pg_hba.conf`:

```bash
docker compose exec db bash -c 'printf "\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 scram-sha-256\n" >> "$PGDATA/pg_hba.conf"'
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_reload_conf();"
```

With current Compose, **do not** append to `$PGDATA/pg_hba.conf` — Postgres ignores it when `hba_file=/etc/gametheca/pg_hba.conf` is set. Edit the host file `docker/postgres/pg_hba.conf` and `force-recreate db` instead.

Then restart the app container. Do **not** wipe `db_data` unless you intend to lose the library DB. Intentional clean slate (still logging in after a partial wipe): [unraid-deploy.md — Factory wipe](unraid-deploy.md#factory-wipe-still-logging-in-after-wiped-volumes).

### 4. Database URL points at production during tests

Only relevant for pytest: `TEST_DATABASE_URL` must contain `test` in the database name.

### 5. Port conflict

Default host port `5006`. Change the published port mapping if occupied.

### 6. Read-only rootfs / missing library volume

If `/app/gametheca/static/library` is not writable, theme install and image downloads fail (may still boot). Mount a writable appdata path.

### 7. `nvml error: driver not loaded` (GPU reservation on a host with no GPU)

Whole-stack symptom, single-service cause. The create fails with:

```text
error running prestart hook #0: exit status 1, stderr: Auto-detected mode as 'legacy'
nvidia-container-cli: initialization error: nvml error: driver not loaded
```

Only the optional `sdnext` artwork sidecar ever asks for a GPU, but the failed
create aborts the whole `compose up` / stack update, so it reads as "GameTheca
is broken" when the app container is fine.

| Check | Fix |
|---|---|
| Does the host have a working NVIDIA driver? `nvidia-smi` on the host, then `docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi` | If either fails, the host cannot serve a GPU — do not request one |
| Is `COMPOSE_FILE` pulling in `docker-compose.gpu.yml`? | Remove it from `.env`. That overlay is opt-in and only for hosts that pass the check above |
| Does your deployed stack file carry its own `deploy: … driver: nvidia` or `runtime: nvidia`? | Delete it. `docker-compose.yml` never requests a GPU; a copy edited on the host may |
| Unraid after an OS upgrade | The Nvidia Driver plugin must be reinstalled for the new kernel and the box rebooted — until then `nvidia-smi` fails and so will every GPU container |

The sidecar runs on **CPU** with no reservation at all — slow, not broken. If the
GPU is on a different machine, do not start the profile here: run SD.Next /
AUTOMATIC1111 / Forge there and set `AI_ARTWORK_URL=http://<gpu-host>:7860`.

## Collect for support

```text
docker logs <container> --tail 200
env | grep -E 'SECRET_KEY|DATABASE|DATA_FOLDER|POSTGRES'   # redact secrets
docker inspect <container> | grep -A20 Mounts
```
