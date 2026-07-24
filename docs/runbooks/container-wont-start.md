# Runbook: Container will not start

## Symptoms

- Unraid / Docker shows exited / restart loop
- Logs stop immediately after start
- Healthcheck fails forever

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

### 4. Database URL points at production during tests

Only relevant for pytest: `TEST_DATABASE_URL` must contain `test` in the database name.

### 5. Port conflict

Default host port `5006`. Change the published port mapping if occupied.

### 6. Read-only rootfs / missing library volume

If `/app/gametheca/static/library` is not writable, theme install and image downloads fail (may still boot). Mount a writable appdata path.

## Collect for support

```text
docker logs <container> --tail 200
env | grep -E 'SECRET_KEY|DATABASE|DATA_FOLDER|POSTGRES'   # redact secrets
docker inspect <container> | grep -A20 Mounts
```
