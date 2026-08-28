# Observability profile (optional)

**Audience:** Unraid / Compose operators who want Prometheus later  
**Status:** Stub — **not required** for Oneirodex 1.0

## Default ops path (use this first)

Near-realtime operator visibility ships **in-app**:

| Surface | Purpose |
|---|---|
| `GET /healthz` | Liveness (process up) |
| `GET /readyz` | Readiness (DB + startup init) — Compose / Unraid healthcheck |
| Admin → Ops (`/admin/ops`) | Polls `/admin/api/ops/summary` (~15s) including **Services** (LiveKit · malware/ClamAV · companions · queues · game_servers) — [ops-summary.md](../admin/ops-summary.md) |

Do **not** block upgrades or smoke sign-off on Prometheus/Grafana.

## Adding Prometheus later

Repo `docker-compose.yml` keeps a **commented** `# profile: observability` stub (no images pulled by default — avoids broken Compose when you only want `app` + `db`).

Typical operator steps when you opt in:

1. Uncomment (or copy) the stub services under the observability note in `docker-compose.yml`.
2. Point Prometheus at Oneirodex only after a scrape endpoint exists (future `/metrics` — admin or token-gated; never open library paths on an unauthenticated scrape).
3. Start with: `docker compose --profile observability up -d` (same pattern as `livekit` / `clamav`).
4. Keep Admin → Ops as the primary glance; treat Grafana as optional dashboards on top.

Until `/metrics` ships, scrape configs that assume it will fail — prefer health curls + Ops Services.

## Security notes

- Do not expose metrics without auth on a public bind.
- Prefer LAN-only scrape or a reverse-proxy ACL.
- No Discord / webhook alert sinks — use in-app SystemEvents / optional SMTP digest.

## Related

- [ops-summary.md](../admin/ops-summary.md) — `services` key contract  
- [docker-compose-deploy.md](docker-compose-deploy.md)  
- [unraid-deploy.md](unraid-deploy.md)
