# Challenge & captcha bypass — feature guide (BYO)

**Date:** 2026-07-27  
**Status:** Requirements + implementation — **in 1.0 scope** (CH-1…CH-5 before official 1.0.0)  
**Audience:** PM · Backend · Ops · Docs · QA  
**Upstream reference:** [germondai/trawl](https://github.com/germondai/trawl) (FlareSolverr-compatible self-hosted solver)  
**Related:** [settings-modules.md](../admin/settings-modules.md) · [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) · [features.md](features.md) · [external-facing-scrub.md](external-facing-scrub.md) · [v1-readiness.md](v1-readiness.md) · **post-1.0 nice-to-have:** [native-challenge-solver.md](native-challenge-solver.md) (NCS-1…5 — GameTheca-owned solver; TRAWL stays 1.0 path)

---

## Locked decisions (Jul 27 PM)

| Decision | Stance |
|---|---|
| Compose profile name | **`challenge`** (`docker compose --profile challenge up -d`) |
| 1.0 gate | **Ship CH-1…CH-5 before official 1.0.0** (MITM runbook CH-6 can trail as docs-only) |
| Max tier default | **`CHALLENGE_SOLVER_MAX_TIER=5`** (hard default). Admin UI/env may **increase** above 5. TRAWL today only escalates through tiers 1–4; tier 5+ is reserved for future providers / no clamp |
| Opt-in | Still **`ENABLE_CHALLENGE_SOLVER=false`** by default |

---
## Problem

BYO acquire (Prowlarr / Jackett / hoster HTTP / debrid resolve) increasingly hits **bot defenses**:

| Barrier | Typical symptom |
|---|---|
| Cloudflare JS / Turnstile | HTML challenge page instead of indexer JSON |
| reCAPTCHA v2/v3 | Token required before download/search |
| hCaptcha / GeeTest | Same — interactive or slider |
| Cookie-bound clearance | Cookie from solver browser not portable to Prowlarr’s own HTTP client |

GameTheca today calls connector URLs with plain `requests`. There is **no** challenge solver sidecar, no FlareSolverr URL field, and no captcha-token provider. Operators who already run TRAWL / FlareSolverr for *arr cannot point GameTheca at them.

**Product intent:** continue building toward **reliable automation of JS challenges & captchas when needed for household download/search**, without shipping a public “captcha cracker as a service” or a torrent marketplace.

---

## Product definition

**Challenge bypass module** = optional, **admin-configured**, **BYO** solvers that GameTheca (and/or the operator’s Prowlarr) call when a fetch is challenged.

| Principle | Stance |
|---|---|
| Default | **Off** — acquire works without it for open endpoints |
| Hosting | Sidecar on LAN / Compose profile — **never** expose solver or MITM proxy to the public internet |
| Indexers | Native Torznab/Newznab registry + optional admin presets + BYO hubs — **no** marketplace |
| Legal frame | Owned-content / household library automation; same as `ENABLE_ARR_MODULE` |
| Monetized cloud solvers | Optional later (API key) — never required |

### In scope

1. **Browser / session solvers** (primary): TRAWL, FlareSolverr, Byparr — FlareSolverr-compatible `POST /v1`  
2. **Native scrape API** (TRAWL `POST /scrape`) for richer tier/timing metadata  
3. **HTTP forward proxy** (TRAWL MITM, advanced): when clearance is connection-bound — Unraid runbook only  
4. **Token CAPTCHA APIs** (secondary): CapSolver / 2Captcha / Anti-Captcha style `createTask` for reCAPTCHA/hCaptcha when a page returns a sitekey and browser solve is overkill or fails  
5. **Local STT** for audio reCAPTCHA (TRAWL’s free STT or operator Whisper) — ops note only  

### Out of scope

- Solving challenges on **GameTheca’s own login** (we rate-limit; we do not weaken our auth)  
- Public SaaS “solve any captcha for strangers”  
- Bundled residential proxies or API keys  
- romhacking.net scrape  
- DRM store download queues  
- Shipping Camoufox inside the GameTheca image (use sidecar)

---

## Recommended shape

```text
                    ┌─────────────────────────┐
  Admin config      │  ChallengeProvider       │
  ENABLE + URL ───► │  (protocol adapters)    │
                    └───────────┬─────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
   FlareSolverr-compat     Native scrape         Token CAPTCHA API
   POST /v1                POST /scrape          (CapSolver-style)
   (TRAWL / FS / Byparr)   (TRAWL)               (optional CH-4)
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
              Acquire / metadata HTTP client
              (retry once through solver on challenge detect)
```

**Default first ship:** FlareSolverr-compatible client → point at **TRAWL** (`ghcr.io/germondai/trawl`) or legacy FlareSolverr. Same URL operators already set in Prowlarr.

**Compose:** optional `--profile challenge` — Redis + TRAWL; GameTheca gets `CHALLENGE_SOLVER_URL=http://trawl:8191`.

---

## Capability matrix

| Capability | CH-1 | CH-2 | CH-3 | CH-4 | CH-5 |
|---|---|---|---|---|---|
| Config URL + enable flag | ✓ | ✓ | ✓ | ✓ | ✓ |
| Compose TRAWL profile | | ✓ | ✓ | ✓ | ✓ |
| Detect CF/challenge HTML | | | ✓ | ✓ | ✓ |
| Retry via `/v1` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Prefer `/scrape` when TRAWL | | | ✓ | ✓ | ✓ |
| Wire Prowlarr/Jackett search path | | | ✓ | ✓ | ✓ |
| Wire debrid/hoster resolve (if challenged) | | | ✓ | ✓ | ✓ |
| CapSolver-style token tasks | | | | ✓ | ✓ |
| Admin test button + Ops health | | | | | ✓ |
| MITM proxy Unraid runbook | | docs | | | docs |

---

## Config & flags

| Env / setting | Default | Notes |
|---|---|---|
| `ENABLE_CHALLENGE_SOLVER` | `false` | Master switch (safety — opt-in) |
| `CHALLENGE_SOLVER_URL` | empty | e.g. `http://trawl:8191` or `http://flaresolverr:8191` |
| `CHALLENGE_SOLVER_PROVIDER` | `flaresolverr_compat` | `flaresolverr_compat` \| `trawl` \| `token_api` |
| `CHALLENGE_SOLVER_TIMEOUT_MS` | `60000` | Passed to solver `maxTimeout` |
| `CHALLENGE_SOLVER_MAX_TIER` | `5` | Default hardcap **5**; admin may raise. TRAWL uses ≤4 today |
| `CHALLENGE_TOKEN_API_URL` | empty | CapSolver-compatible base (CH-4) |
| `CHALLENGE_TOKEN_API_KEY` | empty | Secret — never log |
| `ALLOW_PRIVATE_LAN_URLS` | (existing) | Required for RFC1918 solver URL on Unraid |

Admin → Features / Integrations: enable + URL + max tier + **Test** (health + sample probe).

**OIDC / AI apply locks unchanged** — challenge solver stays **opt-in** (not bulk-enabled with product modules).

---

## Server work units

| ID | Unit | Owner | Notes |
|---|---|---|---|
| CH-CLIENT-1 | `ChallengeSolverClient` — `request_get(url)` via FlareSolverr `cmd=request.get` | Backend | Parse `solution.cookies` / `userAgent` / `response` |
| CH-CLIENT-2 | Challenge detect helper — status 403/503 + body markers / title | Backend | Conservative; false positives → no silent loop |
| CH-CLIENT-3 | TRAWL `/scrape` adapter when provider=`trawl` | Backend | Store tier/timings in debug log only |
| CH-WIRE-1 | Wrap indexer HTTP in arr connectors (search / download URL fetch) | Backend | One retry through solver |
| CH-WIRE-2 | Debrid connector fetches if challenged | Backend | Same client |
| CH-TOKEN-1 | Token provider interface + one CapSolver-compatible impl | Backend | CH-4 |
| CH-ADMIN-1 | Features UI + `GET /api/admin/challenge-solver/status` | Backend + UI | Reachable, last error, provider |
| CH-COMPOSE-1 | `docker-compose` profile **`challenge`** | Ops | Redis + TRAWL; `:baseline` note for old NAS CPUs |
| CH-DOCS-1 | Runbook Unraid + MITM proxy CA warning | Docs | Never public bind |

---

## Wave plan

| Wave | Outcome | Exit criteria |
|---|---|---|
| **CH-0** | Guide + locked decisions | **Done** |
| **CH-1** | Client + unit tests (mock solver) | pytest; no Compose required |
| **CH-2** | Compose profile **`challenge`** + `.env.example` | docs runbook stub |
| **CH-3** | Wire acquire search/download path | Challenged fixture → solver once |
| **CH-4** | Token CAPTCHA API adapter | Key never in logs |
| **CH-5** | Admin Test + Ops + max-tier control | Status + tier ≥5 editable |
| **CH-6** | MITM proxy Unraid runbook | Docs-only OK after 1.0 if needed |

**1.0:** CH-1…CH-5 **required** before official 1.0.0 cut.

---

## Security & ops risks

| Risk | Mitigation |
|---|---|
| MITM proxy + trusted CA = full HTTPS impersonation | Docs: LAN/Docker network only; never publish 8192; CA install opt-in |
| Solver used to attack third parties | Admin-only; URL allowlist via existing connector URL validator; no anonymous API |
| Residential proxy (TRAWL tier 4) cost / ToS | Default max tier **5** (allows 4); admin may raise; document residential as operator-owned |
| AGPL TRAWL | Sidecar image — not vendored into GameTheca source; link upstream |
| Captcha audio STT → Google | Prefer local Whisper (`STT_URL`) in runbook; disclose default |
| SSRF via solver URL | `validate_connector_http_url` + `ALLOW_PRIVATE_LAN_URLS` |
| Child accounts | Solver is admin infrastructure — members never configure it |

---

## Docs inventory (when building)

| Doc | Action |
|---|---|
| This file | Living contract |
| `docs/runbooks/challenge-solver-unraid.md` | **Have** (CH-2) — TRAWL profile, Prowlarr URL parity, MITM CA |
| `docs/admin/settings-modules.md` | Flag table row |
| `docs/user/downloads.md` / troubleshooting | “Search fails with challenge page → ask admin to enable solver” |
| `docs/admin/troubleshooting.md` | Solver unreachable / timeout |
| `.env.example` | Commented opt-in block |
| `docs/strategy/progress.md` | Board row |

---

## Success metrics

- With solver off: acquire behavior unchanged  
- With TRAWL up + flag on: challenged indexer search returns usable results in household lab  
- Zero solver ports on public firewall in recommended Compose  
- Admin Test fails closed with clear error when sidecar down  

---

## Open product decisions

**Closed Jul 27** — see Locked decisions above + [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md).
