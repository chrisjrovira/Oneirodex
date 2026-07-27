# Troubleshooting (admins)

## Container / boot

See [container-wont-start.md](../runbooks/container-wont-start.md) for SECRET_KEY, bash, DB.

| Symptom | Check |
|---|---|
| App unhealthy | `curl -f http://localhost:5006/readyz` · `docker compose logs app` · DB healthy? Compose probes **`/readyz`** (not `/`) |
| Liveness only | `curl -f http://localhost:5006/healthz` — process up; does not prove DB |
| Sidecars / queues look wrong | **Admin → Ops** (or Dashboard) **Services** tile — LiveKit · malware · companions · queues; then `/readyz` — field map: [ops-summary.md](ops-summary.md) |
| Schema errors | Startup `updateschema` · [local-postgres-pytest.md](../runbooks/local-postgres-pytest.md) for local tests |

## Frontend dist missing

Rebuild so `gametheca/static/dist/member-app` and `admin-app` exist:

```bash
docker compose build --no-cache && docker compose up -d
```

## Features / modules

Product toggles live under **Admin → Features** (and setup → Features). Env flags in `.env` / Compose still win for safety locks. See [settings-modules.md](settings-modules.md).

| Symptom | Check |
|---|---|
| Malware scan never runs | `ENABLE_MALWARE_SCAN` off — check Admin → Features |
| Library scan skips suspicious names | Expected when `MALWARE_SCAN_BLOCK_ON_HIT=true` (heuristic or ClamAV match) |
| ClamAV unreachable | Start `docker compose --profile clamav up -d` or set `CLAMAV_SOCKET` for host clamd — heuristics still apply when scan module is on |
| LiveKit “on” but no voice | Flag alone is not enough — need `LIVEKIT_*` + compose `--profile livekit` |
| OIDC button missing | `OIDC_ENABLED` stays **off** until env + Integrations toggle |

## Integrations

| Integration | Notes |
|---|---|
| SMTP / IGDB / OIDC / SteamGridDB | Admin → Integrations hub |
| Community chat | BYO Stoat/Matrix URL only |
| Discord | **Removed** — use Support inbox + in-app admin alerts |
| LiveKit | [livekit-unraid.md](../runbooks/livekit-unraid.md) · Plugins → `rtc.livekit` |

## Support tickets not on GitHub

Expected if `SUPPORT_GITHUB_TOKEN` unset (`github_sync=skipped`). Ticket + admin notification still work — [support-inbox.md](support-inbox.md).

## Voice

| Symptom | Fix |
|---|---|
| Status disabled | `ENABLE_LIVEKIT=true` + URL/key/secret on **app** |
| Browser can’t connect | `LIVEKIT_URL` must be reachable from the **browser** (not only Docker DNS) |
| Child screenshare 403 | By design |

## Scans / identify

Stuck jobs, unmatched, freshness: [libraries-and-scans.md](libraries-and-scans.md). Deep ops still use Jinja admin pages behind the React top bar.
