# Native challenge / captcha solver (replace TRAWL sidecar)

**Date:** 2026-07-29  
**Status:** Nice-to-have · post-1.0 backlog (**not started**)  
**Priority:** backlog / sprint nice-to-have  
**Audience:** PM · Backend (Acquire) · Ops · QA · Docs  
**Shipped path today:** [challenge-bypass.md](challenge-bypass.md) — CH-1…CH-5 · Compose profile `challenge` · BYO FlareSolverr-compat → **TRAWL** (`ghcr.io/germondai/trawl`) · `ENABLE_CHALLENGE_SOLVER` off by default  
**Related:** [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) · [features.md](features.md) · [external-facing-scrub.md](external-facing-scrub.md) · [pm-miss-backlog.md](pm-miss-backlog.md)

---

## Problem

1.0 ships an optional **TRAWL** sidecar behind the FlareSolverr-compatible client. That path works and stays the **supported 1.0 default** for profile `challenge`. Operators still feel:

| Friction | Why it bites |
|---|---|
| AGPL sidecar dependency | Household wants a GameTheca-owned image under our org, not a forever AGPL peer |
| Redis + image footprint | Unraid RAM/disk pressure for an optional acquire helper |
| Tier / STT coupling | Escalation and audio-captcha STT are tied to upstream TRAWL behavior |
| Ownership | Desire for a LAN-only solver aligned with the acquire HTTP client and Ops honesty |

**Product intent:** eventually offer a **first-party household solver** that can become the Compose `challenge` default image, while **keeping** FlareSolverr-compat BYO so existing TRAWL / FlareSolverr / Byparr URLs keep working.

This epic does **not** gate official 1.0.0. TRAWL remains supported until cutover DoD below.

---

## Product definition

**Native challenge solver (NCS)** = optional GameTheca-owned worker image + protocol adapters that speak the same FlareSolverr `POST /v1` (and optional `/scrape`-like metadata) the acquire client already uses.

| Principle | Stance |
|---|---|
| Default until cutover | **TRAWL** remains Compose `challenge` image |
| Protocol | Keep `CHALLENGE_SOLVER_*` env + FlareSolverr-compat client — no parallel proprietary API for 1.x |
| Hosting | LAN / Compose only — **never** a public “captcha SaaS” |
| Legal frame | Household owned-content automation — same as acquire / `ENABLE_ARR_MODULE` |
| Auth | Does **not** weaken GameTheca login; does **not** remove CH-1…CH-5 |

### In scope

1. Freeze and contract-test the FlareSolverr-compat surface the current client already calls  
2. GameTheca-org Camoufox-or-headless browser worker image (sidecar, not baked into the app image)  
3. Tier ladder: JS challenge → Turnstile → interactive (admin-gated)  
4. Optional local STT / token-API plug (reuse CH-4 style adapters)  
5. Cutover Compose default image + document TRAWL as BYO fallback  

### Out of scope

- Solving challenges on **GameTheca’s own login**  
- Public SaaS “solve any captcha for strangers”  
- Bundled residential proxies or paid proxy keys  
- Removing CH-1…CH-5 or breaking existing `CHALLENGE_SOLVER_URL` BYO  
- Class A / warez brand names · Discord / webhooks · DRM store download queues  

---

## Recommended shape

```text
  ENABLE + CHALLENGE_SOLVER_URL
            │
            ▼
   ChallengeSolverClient  (shipped CH-1…5 — unchanged contract)
            │
            ▼
   FlareSolverr-compat POST /v1  (+ optional /scrape metadata)
            │
     ┌──────┼──────────────────────────┐
     ▼      ▼                          ▼
  TRAWL   Native NCS worker      Legacy FS / Byparr
  (1.0)   (post-1.0 default)     (BYO forever)
```

**Cutover goal:** Compose profile `challenge` points at GameTheca-owned image; operators may still set URL to TRAWL/FS/Byparr.

---

## Capability matrix / phases

| Capability | NCS-1 | NCS-2 | NCS-3 | NCS-4 | NCS-5 |
|---|---|---|---|---|---|
| Protocol freeze + contract tests vs current client | ✓ | ✓ | ✓ | ✓ | ✓ |
| Minimal Camoufox/headless worker image (GameTheca org) | | ✓ | ✓ | ✓ | ✓ |
| JS challenge tier | | ✓ | ✓ | ✓ | ✓ |
| Turnstile / interactive ladder (admin-gated) | | | ✓ | ✓ | ✓ |
| Optional local STT / token-API plug | | | | ✓ | ✓ |
| Compose default image cutover + TRAWL BYO docs | | | | | ✓ |

### Phase detail

| ID | Outcome | Owner seats | Exit criteria |
|---|---|---|---|
| **NCS-1** | Protocol freeze / contract tests against shipped client | Backend · QA | pytest fixtures mock `/v1` (+ scrape metadata if used); no Compose change |
| **NCS-2** | Minimal browser worker image under GameTheca org | Backend · Ops | Image builds; LAN-only bind; FlareSolverr-compat smoke |
| **NCS-3** | Tier ladder JS → Turnstile → interactive | Backend · QA | Admin max-tier still respected; failures fail closed |
| **NCS-4** | Optional local STT / token-API plug | Backend · Ops | Reuse CH-4 adapters; no Google STT required |
| **NCS-5** | Cutover Compose default; TRAWL documented as BYO fallback | Ops · Docs · QA | Runbook + `.env.example` + settings-modules honesty; CH path still green |

**UI:** only if Admin Integrations / Features copy names the new default image — otherwise no SPA work.

---

## Legal / ops frame

| Rule | Stance |
|---|---|
| LAN-only | Never publish solver ports to the public internet |
| No captcha SaaS | Product is household automation, not a multi-tenant solver |
| No bundled residential proxies | Operator-owned if they bring their own |
| AGPL | Prefer not vendoring AGPL into GameTheca source; sidecar swap is the point |
| Child / member | Solver remains admin infrastructure |

---

## Risks

| Risk | Mitigation |
|---|---|
| Break BYO TRAWL/FS during cutover | Keep protocol; dual-document default vs BYO URL |
| Browser footprint still heavy | Smaller than Redis+TRAWL stack where possible; profile stays optional |
| False “we cracked captchas for the world” framing | Capability language only; household owned-content |
| Weakening login | Explicit non-goal; rate-limit auth unchanged |

---

## Definition of done (epic)

- [ ] NCS-1…NCS-5 complete or explicitly deferred with ADR  
- [ ] FlareSolverr-compat BYO still works with TRAWL/FS/Byparr  
- [ ] Compose `challenge` default image is GameTheca-owned **or** documented why TRAWL remains default  
- [ ] CH-1…CH-5 behavior unchanged for existing flags  
- [ ] Docs: runbook + settings-modules + progress scrub; no 1.0 gate claims  

---

## Owner seats

| Seat | Role |
|---|---|
| **Backend** (Acquire lane) | Client contract · worker · tiers · STT/token plugs |
| **Ops** | Compose profile image · Unraid ports · footprint notes |
| **QA** | Contract tests · challenged fixture green · cutover regression |
| **Docs** | Guide living contract · runbook cutover · scrub |
| **UI** | Only if Admin Integrations copy changes |

---

## Related links

- Shipped BYO path: [challenge-bypass.md](challenge-bypass.md)  
- Unraid runbook: [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md)  
- Feature index: [features.md](features.md) (Nice-to-have / post-1.0)  
- Scrub policy: [external-facing-scrub.md](external-facing-scrub.md)  
