# Official v1 readiness — program review

**Date:** 2026-07-27  
**Status:** Planning board (feed from the agent review — [../dev/agent-skills.md](../dev/agent-skills.md))  
**Current ship track:** 0.2.0 → **1.0.0** only after caveats below are closed or explicitly deferred  
**Program board:** [progress.md](progress.md)

## North-star decision (locked)

**Keep and enhance the existing base** — do **not** rewrite Flask, member SPA, or Tauri from scratch.

| Layer | Verdict | Why |
|---|---|---|
| Backend | Enhance | Flask 3 + SA2 + uvicorn ASGI already ship; debt is migrations, workers, probes |
| Member SPA | Enhance | React 19 + Vite 6; library/details/social/BP largely shipped |
| Admin | Progressive hybrid | React chrome + Jinja bodies until Wave 3 parity — no big-bang rewrite |
| Desktop | Enhance | Tauri 2 companion + Friends window + offline gating mature |
| Design system | Consolidate tokens | Stay on `--gt-*` / aurora green; avoid Tailwind/MUI rewrite |
| Ops | New seat + deepen | Extend Ops glance + healthz; optional Prometheus profile |

## Explicit non-rebuilds

- No Next.js / FastAPI / Electron migration for v1  
- No Tailwind / MUI / Chakra replacement of aurora tokens  
- No Discord webhooks / bundled torrent/debrid marketplace / DRM store download/install queues / romhacking.net scrape  

## Additive libraries (allowed)

| Area | Candidate | Purpose |
|---|---|---|
| Member SPA | `@tanstack/react-virtual` | Large library grids — **in use** on `GameGrid` (V1-UI-1 partial) |
| Member SPA | `cmdk` | Command palette (planned Wave 0) |
| Member SPA | `@tanstack/react-query` | Fetch cache / loading consistency |
| Member SPA | Wire `@gametheca/api-client` | Stop ad-hoc fetch drift |
| Backend | Alembic | Versioned migrations (replace ad-hoc `updateschema.py` path) |
| Backend | Pin `requirements.txt` | Reproducible 1.0 builds |
| Backend | `/healthz` + `/readyz` (+ optional `/metrics`) | Unraid + Compose + scrape |
| Ops | Optional Compose `observability` profile | Prometheus (± Grafana) — never required |

## Team seats

| Seat | Skill | v1 focus |
|---|---|---|
| Maintainer | main thread | Sequence P0→P2; gate 1.0.0 |
| UI/UX | `agent-uiux` | Polish, a11y, virtualization, palette, admin chrome consistency |
| Backend | `agent-backend` | Migrations, probes, worker correctness, flag clarity |
| Desktop | `agent-desktop` | Path polish · **V1-DESK-1 secure store shipped** · unsigned distribution (no certs) · E2E-critical paths |
| QA | `agent-qa` | CI pytest gate, social/voice vitest gaps, release suite |
| Docs | `agent-docs` | Scrub + upgrade notes + Capture screenshots |
| Game Master | `agent-gamemaster` | Taxonomy/DAT/emulation honesty — **signed off** ([v1-gamemaster-signoff.md](v1-gamemaster-signoff.md)) |
| **Ops** | **`agent-ops`** | **Near-realtime health, Unraid, profiles, ops summary** |

## Near-realtime Ops architecture (recommended)

```
Unraid / Docker healthcheck ──► GET /healthz (liveness)
                             ──► GET /readyz (DB + init complete)

Admin browser ──poll 10–15s──► GET /admin/api/ops/summary
                                 (+ LiveKit / ClamAV / companion / queue fields)

Optional profile "observability"
  Prometheus ──scrape──► GET /metrics (token or admin network)
  Grafana (optional) ──dashboards──► same series

SSE /api/events/stream ──► Activity + future ops alert chips (no Discord)
SMTP digest (existing) ──► daily / critical operator mail
```

**Do not** require Grafana for the product to be “ops-ready.” In-app Ops + health probes are the v1 bar.

### Locked decisions (Jul 27)

| Decision | Stance |
|---|---|
| Prometheus / Grafana in 1.0 | **Optional only** — never required |
| Alembic before 1.0 | **Defer** — [ADR 0001](../adr/0001-schema-migrations-defer-alembic.md); keep `updateschema.py` |

## Gate criteria for official **1.0.0**

1. Semver aligned (app, Docker image tag, OpenAPI, CHANGELOG) — **partial** (app + compose `0.2.0`; Hub publish operator-owned)  
2. `/healthz` + `/readyz` used by Compose healthcheck — **done (V1-OPS-1)**  
3. Ops summary covers sidecars + companion pulse; runbooks match Unraid — **done (V1-OPS-2)**  
4. CI runs a meaningful pytest (+ member vitest) gate — **done** (`.github/workflows/ci-tests.yml`)  
5. Known P0 bugs from [bug-triage.md](bug-triage.md) closed or explicitly deferred with ADR — **done** (O1–O12 scrubbed; Alembic deferred via ADR)  
6. Admin hybrid called **supported** — **done** ([admin-hybrid.md](admin-hybrid.md))  
7. Game Master sign-off — **done** ([v1-gamemaster-signoff.md](v1-gamemaster-signoff.md); ready with caveats)  
8. Docs-sync pass: user/admin/FAQ/troubleshooting + upgrade notes — **text-complete**; **Capture screenshots + tour video landed** — [CAPTURE.md](../assets/readme/CAPTURE.md) · `docs/media/`

## Shipped this wave (Jul 27 team)

| ID | Item |
|---|---|
| V1-OPS-1 | `/healthz` · `/readyz` · Compose healthcheck |
| V1-OPS-2 | Ops `services` pulse (LiveKit · malware · companions · queues) |
| V1-QA-1 | CI pytest core + member vitest |
| V1-BE-1 | Pinned `requirements.txt` · image tag `0.2.0` |
| V1-BE-2 | Alembic deferred (ADR 0001) |
| V1-UI-1 | Library `GameGrid` virtualization |
| V1-DESK-1 | OS keyring token store |
| V1-GM-1 | Domain sign-off |

## Remaining before tag 1.0.0 (thin)

| Item | Owner | Notes |
|---|---|---|
| Command palette (`cmdk`) | uiux | **done** — Ctrl/Cmd+K |
| External-facing scrub | docs | **done** SCRUB-1…4,6–9; SCRUB-5 deferred; templates for Issues/PRs |
| ~~**Challenge bypass CH-1…CH-5**~~ | backend + ops | **Shipped** — profile `challenge`, max tier **5** — [challenge-bypass.md](challenge-bypass.md) |
| ~~**Cover art studio ART-1…ART-3**~~ | uiux + backend | **Shipped** — [cover-art-studio.md](cover-art-studio.md) |
| ~~**Mods MOD-1…2 · servers SRV-1…2**~~ | backend + ops | **Shipped** (APIs) — [game-servers-mods.md](game-servers-mods.md) |
| **GOW-1 / GOW-2 remote play** | backend + desktop | **In flight** — [gow-remote-play.md](gow-remote-play.md) |
| **LIGHT-1 / LIGHT-2 ambient lighting** | backend | **In flight** — [ambient-lighting.md](ambient-lighting.md) |
| **Thin client TC-1** | backend + desktop | **In flight** — scopes + `device_kind` — [thin-client.md](thin-client.md) |
| **Desktop MOD-3 + GOW-2 stub** | desktop | **In flight** — companion mod apply + Moonlight CTA |
| Account settings still Jinja | uiux | Documented hybrid; migrate post-1.0 OK |
| Multi-worker shared state | backend | Default `UVICORN_WORKERS=1` (Compose / Docker entrypoint); override to 2+ OK — documented |
| Capture screenshots | docs / scripts | **Done** — Playwright recipe + `docs/media/` — [CAPTURE.md](../assets/readme/CAPTURE.md) |
| Operator: Authentik, Hub image, Unraid rebuild | human | Outside agents — desktop stays unsigned (no cert purchase) |
| Full miss board | pm | [pm-miss-backlog.md](pm-miss-backlog.md) — agent MISS-* closed; human rows only |

**Agent-closed dispatch:** DOC · BE · UI · QA · DESK · OPS · GM misses · ADR 0002 api-client defer.

## Explicitly non-gating for 1.0.0 (may trail tag)

| Item | Notes |
|---|---|
| SRV-3 docker.sock control | Default off — [game-servers-mods.md](game-servers-mods.md) |
| Alembic cutover | ADR 0001 follow-ups |
| Admin full Jinja→React | [admin-hybrid.md](admin-hybrid.md) |
| Observability Compose profile | Optional Prometheus |
| Thin client TC-2 shell + TC-2b PWA | Follows TC-1 protocol — [thin-client.md](thin-client.md) |
| LIGHT-3 admin UI + member pref | After LIGHT-1/2 hooks |
| GOW-3 party PIN · GOW-4 Compose profile docs | After GOW-1/2 |

**1.0 scope (no separate 1.1 track):** CH-1…CH-5 **shipped** · ART-1…ART-3 **shipped** · MOD-1/2 + SRV-1/2 APIs **shipped** · GOW-1/2 · LIGHT-1/2 · TC-1 · Desktop MOD-3/GOW-2 **in flight**.

## Related

- [progress.md](progress.md) — 0.2.0 execution  
- [roadmap.md](roadmap.md) — 12-month themes  
- [thin-client.md](thin-client.md) — thin client guide (TC-1 in 1.0 scope)  
- [bug-triage.md](bug-triage.md) — scrub status  
- [v1-gamemaster-signoff.md](v1-gamemaster-signoff.md) — Game Master domain gate 7  
- [../dev/agent-skills.md](../dev/agent-skills.md) — team skills including Ops  
- Ops glance design: `docs/superpowers/specs/2026-07-22-ops-glance-design.md`
