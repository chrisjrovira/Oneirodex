# PM living backlog — misses before official 1.0.0

**Date:** 2026-07-27 · **Owner:** `maintainer`  
**Source:** team scratch review + Jul 27 wave close-out  
**Rule:** Keep-and-enhance; no stack rewrite; no Discord / marketplace / DRM queues / romhacking.net scrape

## Status snapshot

- **Shipped hard:** healthz/readyz · Ops services pulse · CI · pinned deps · GameGrid virtualize · cmdk · keyring · GM sign-off · scrub templates · Alembic deferred (ADR) · desktop app-smoke · observability stub · Unraid Services checklist · GM CHANGELOG caveats · **UVICORN_WORKERS=1** default · OpenAPI 0.2.0 hygiene · ops `services` contract · api-client SPA defer (ADR 0002)
- **Still open:** Capture pixels · SCRUB remote bodies (human) · operator secrets
- **Reopened 2026-08-21:** the agent MISS-* sets below are closed, but four new rows are not — **MISS-OPS-3/4** (GPU request in the deployed Unraid stack · retire the dev override), **MISS-QA-4** (chrome shipped unseen since W29-1), **MISS-DOC-4** (README media stale). QA-4 and DOC-4 share one blocker: no running instance
- **Disk hygiene (Jul 27):** safe-deleted regenerable caches (`src-tauri/target` · `node_modules`); webretro + `.git` kept — [workspace-disk-hygiene.md](../runbooks/workspace-disk-hygiene.md)
- **Docs text (MISS-DOC-1/2/3):** done — gate 8 text-complete; Capture checklist landed
- **Desktop/Ops/GM misses (MISS-DESK-1/2 · MISS-OPS-1/2 · MISS-GM-1):** done
- **UI misses (MISS-UI-1/2/3):** done — PageStatus · skip-link/focus · Integrations React cards
- **Backend misses (MISS-BE-1/2/3):** done — workers=1 · OpenAPI/`app_version` 0.2.0 · [ops-summary.md](../admin/ops-summary.md)
- **MISS-UI-4:** deferred — [ADR 0002](../adr/0002-defer-api-client-spa.md)
- **Not 1.0 gates:** thin-client shell · Alembic cutover · live Prometheus profile · full admin Jinja retirement · api-client SPA wiring

---

## Backlog (all remaining)

| id | priority | owner | outcome | DoD |
|---|---|---|---|---|
| **MISS-DOC-1** | ~~P0~~ | docs | Capture checklist + placeholder assets for Ops/health/palette | **Done** — [CAPTURE.md](../assets/readme/CAPTURE.md); pixels still Capture |
| **MISS-DOC-2** | ~~P0~~ | docs | Gate 8 close: FAQ + troubleshooting + Help sync to probes/cmdk/scrub | **Done** — text-complete; Capture open |
| **MISS-DOC-3** | ~~P1~~ | docs | Scrub `progress.md` “77 products” / competitive leftovers | **Done** — private-vault pointer |
| **MISS-BE-1** | ~~P0~~ | backend | Default `UVICORN_WORKERS=1` in Compose/.env.example (override to 2 OK) | **Done** — `startweb-docker.sh` + Compose + env examples + runbook |
| **MISS-BE-2** | ~~P1~~ | backend | OpenAPI + `app_version` / compose / CHANGELOG alignment note for 0.2.0 | **Done** — `info.version` 0.2.0; CHANGELOG Unreleased note |
| **MISS-BE-3** | ~~P1~~ | backend | Ops summary fields in OpenAPI admin stub or docs contract | **Done** — [ops-summary.md](../admin/ops-summary.md) |
| **MISS-UI-1** | ~~P0~~ | uiux | Shared empty/loading (`aria-busy`) on Chat/Activity/Discover weak pages | **Done** — `PageStatus` on Chat/Discover/Activity |
| **MISS-UI-2** | ~~P1~~ | uiux | Skip link + focus ring audit on TopNav/palette | **Done** — `#main-content` skip link + `:focus-visible` |
| **MISS-UI-3** | ~~P1~~ | uiux | Admin Integrations hub: migrate one Jinja-heavy body → React cards (Wave 3 slice) | **Done** — IGDB/SMTP/OIDC/LiveKit/Support cards; Jinja forms kept |
| **MISS-UI-4** | ~~P2~~ | uiux | Wire `@gametheca/api-client` for one member fetch path OR defer with ADR | **Deferred** — [ADR 0002](../adr/0002-defer-api-client-spa.md) |
| **MISS-QA-1** | ~~P0~~ | qa | ActivityPage + VoiceLobby vitest smoke | **Done** — `ActivityPage.test.jsx` + `VoiceLobby.test.jsx` green |
| **MISS-QA-2** | ~~P1~~ | qa | Expand CI: add desktop vitest job (keychain/config-store) | **Done** — `desktop-vitest` job in `ci-tests.yml` |
| **MISS-QA-3** | ~~P1~~ | qa | SCRUB-7: grep built `member-app`/`admin-app` source for Class A; rebuild note | **Done** — [scrub-shipped-bundles.md](../runbooks/scrub-shipped-bundles.md) + SCRUB-7 link |
| **MISS-DESK-1** | ~~P1~~ | desktop | `app.ts` orchestration smoke test (connect strip / offline gate) | **Done** — `clients/desktop/src/app-smoke.test.ts` |
| **MISS-DESK-2** | ~~P2~~ | desktop | Document Friends window session vs token auth caveat clearly | **Done** — desktop-companion.md Friends vs keyring |
| **MISS-OPS-1** | ~~P1~~ | ops | Compose `observability` profile **stub** (commented Prometheus) + runbook | **Done** — compose comment + [observability-profile.md](../runbooks/observability-profile.md) |
| **MISS-OPS-2** | ~~P1~~ | ops | Unraid smoke checklist includes Services tile + `/readyz` | **Done** — unraid-deploy.md step 0 / 0b |
| **MISS-GM-1** | ~~P2~~ | gamemaster | Release-notes caveats blurb for CHANGELOG 1.0 | **Done** — CHANGELOG Unreleased + upgrade-notes |
| **MISS-OPS-3** | P1 | ops + human | **What actually requests a GPU in the deployed Unraid stack.** `docker-compose.yml` never has, and the local `docker-compose.override.yml` that does is gitignored and never left the dev machine — yet the Unraid stack update failed with `nvml error: driver not loaded`, which only a GPU request produces. Something host-side carries one | Grep the on-host stack file for `nvidia` / `deploy:` / `runtime:`; `--profile artwork` updates clean, or the profile is confirmed not in use. [container-wont-start.md](../runbooks/container-wont-start.md) § 7 |
| **MISS-OPS-4** | P2 | ops | Retire the dev box's gitignored `docker-compose.override.yml` — it duplicates the reservation now tracked in `docker-compose.gpu.yml` | Windows dev host switched to `COMPOSE_FILE=docker-compose.yml:docker-compose.gpu.yml`; override deleted; sdnext still gets the GPU there |
| **MISS-QA-4** | P1 | qa | **Four waves of chrome work have shipped without ever being seen render.** W29-1, W29-2, W29-3 and W29-5 each close with *live verification owed* — Docker Desktop was down for all of them. This is one pass, not four | One session against a running instance clearing all four debt-log rows. W29-5 needs only an SPA rebuild (`TileSizeControl.css` is bundled, not a theme asset) — no Reset Themes, unlike the [carryover-w28.md](carryover-w28.md) § 2 batch |
| **MISS-DOC-4** | P2 | docs | README live media is a revision stale: the top bar's slider/count order changed (W29-5) and `screenshot-library.png` predates it | Capture run against a live instance per [CAPTURE.md](../assets/readme/CAPTURE.md); real pixels only, no restored mock JPGs. Blocked on the same running instance as MISS-QA-4 — do them together |
| **SCRUB-5** | P2 | human | History rewrite | **Deferred** unless reopened |
| **SCRUB-6b** | P1 | human | Search GitHub.com Issues/PR bodies | Checklist only |
| **OPS-CERT** | P0 | human | Authentik · Hub publish · Unraid rebuild | Outside agents — desktop unsigned only (no code-signing cert) |

## Nice-to-have backlog (post-1.0 — not 1.0 misses)

Priority **nice-to-have** — plans only; do not treat as P0/P1 1.0 gates. Shipped sidecars stay until cutover.

| id | priority | owner | outcome | DoD |
|---|---|---|---|---|
| **NCS** | nice-to-have | backend + ops + qa | Native challenge solver replaces TRAWL as Compose `challenge` default; FlareSolverr-compat BYO kept | [native-challenge-solver.md](native-challenge-solver.md) NCS-1…5 |
| **RTC-N** | nice-to-have | backend + ui + desk + ops | Native mesh/thin SFU; LiveKit demoted to BYO | [native-rtc.md](native-rtc.md) RTC-N1…N5 |
| **MAL-N** | nice-to-have | backend + ops + qa + docs | Native malware engine; ClamAV demoted to BYO; heuristics tier-0 stays | [native-malware-scan.md](native-malware-scan.md) MAL-N1…N5 |
| **GPU-N** | nice-to-have | backend + ops + desktop + qa | GPU worker node: server stays GPU-less, artwork renders on whatever box has the accelerator; plain `AI_ARTWORK_URL` kept | [gpu-worker-node.md](gpu-worker-node.md) GPU-N1…N5 |

## Sequencing (this dispatch)

```text
P0 parallel:  MISS-DOC-1/2 · MISS-BE-1 · MISS-UI-1 · MISS-QA-1
P1 parallel:  MISS-UI-2/3 · MISS-BE-2/3 · MISS-QA-2/3 · MISS-DESK-1 · MISS-OPS-1/2 · MISS-DOC-3
P2 / defer:   MISS-UI-4 (ADR defer) · MISS-GM-1 · SCRUB-5/6b · OPS-CERT
```

## Ready prompts (executed in this session)

### `agent-docs` — MISS-DOC-1/2/3
Close gate 8 as far as text allows; Capture checklist; scrub progress competitive leftover.

### `agent-backend` — MISS-BE-1/2/3
Workers default 1; OpenAPI/version hygiene; document ops `services`.

### `agent-uiux` — MISS-UI-1/2/3
Empty/loading pattern; skip link; one Integrations React slice.

### `agent-qa` — MISS-QA-1/2/3
Activity + VoiceLobby tests; CI desktop vitest; scrub-7 note.

### `agent-desktop` — MISS-DESK-1/2
app.ts smoke + auth caveat docs.

### `agent-ops` — MISS-OPS-1/2
Observability stub profile + Unraid checklist verify.

### `agent-gamemaster` — MISS-GM-1
CHANGELOG caveats blurb.

## Open decisions (locked for this wave)

1. **Prometheus** — stub profile only (not required).  
2. **api-client wire** — defer with one-line ADR if it risks SPA churn.  
3. **SCRUB-5 / Authentik·Hub·Unraid** — human only; agents stop at checklists. Desktop code signing is permanently out of scope.

## Related

- [v1-readiness.md](v1-readiness.md)  
- [admin-hybrid.md](admin-hybrid.md)  
- [external-facing-scrub.md](external-facing-scrub.md)  
- [upgrade-notes-1.0.md](upgrade-notes-1.0.md)
