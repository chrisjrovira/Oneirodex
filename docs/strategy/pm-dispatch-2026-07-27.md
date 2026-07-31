# PM dispatch — Jul 27 evening

**From:** Program Manager  
**To:** Backend · Ops · UI/UX · Desktop · Docs · QA · Game Master  
**Read first:** Locked defaults (no Discord; OIDC opt-in; no torrent marketplace — native registry + admin presets OK; scrub Class A/B intel)

---

## Locked decisions (challenge)

| Item | Value |
|---|---|
| Compose profile | **`challenge`** |
| Ship before 1.0 | **CH-1…CH-5 yes** |
| Max tier | Default **5**; admin may **increase** |
| Guide | [challenge-bypass.md](challenge-bypass.md) |

## New guides (this packet)

| Guide | Path |
|---|---|
| Challenge / captcha | [challenge-bypass.md](challenge-bypass.md) |
| Cover art studio | [cover-art-studio.md](cover-art-studio.md) |
| GOW / remote play | [gow-remote-play.md](gow-remote-play.md) |
| Mods + game servers | [game-servers-mods.md](game-servers-mods.md) |
| Ambient lighting | [ambient-lighting.md](ambient-lighting.md) |

## Priority order (1.0 — everything; no 1.1 track)

```text
1. CH-1 → CH-5   (challenge — required)
2. ART-1 → ART-3 (cover studio — required)
3. MOD-1 → MOD-3 · SRV-1 → SRV-2 (mods + servers; MOD-3 desktop apply)
4. GOW-1 → GOW-2 (remote play host + Moonlight CTA)
5. LIGHT-1 → LIGHT-2 (Hyperion + HA ambient)
6. Thin client TC-1+ as capacity allows (still product 1.0 scope)
```

---

## Copy-paste briefs

### @agent-backend — Challenge CH-1…CH-3 (+ CH-4/5)

```text
Role: Backend for GameTheca.
Read docs/strategy/challenge-bypass.md (LOCKED: profile challenge, CH-1…5 before 1.0, MAX_TIER default 5 admin may raise).
Build in order:
CH-1 ChallengeSolverClient FlareSolverr-compat POST /v1 + detect helper + pytest mocks.
CH-2 Support env ENABLE_CHALLENGE_SOLVER / CHALLENGE_SOLVER_URL / CHALLENGE_SOLVER_MAX_TIER=5 (Ops owns compose).
CH-3 Wire arr/debrid HTTP: one retry through solver when challenged; off = unchanged.
Then CH-4 token API adapter; CH-5 status API + max-tier in Features settings.
Out: no public MITM in app; no solving GameTheca login; no Discord; OIDC stays opt-in.
Do NOT commit unless asked. docs-sync settings-modules + .env.example.
```

### @agent-ops — Challenge Compose + servers health

```text
Role: Ops.
1) docker-compose profile name MUST be `challenge`: TRAWL (ghcr.io/germondai/trawl) + Redis; CHALLENGE_SOLVER_URL=http://trawl:8191; note :baseline for old NAS.
2) Runbook docs/runbooks/challenge-solver-unraid.md — LAN only; MITM CA warning (CH-6).
3) Read docs/strategy/game-servers-mods.md SRV-1/2 — Ops summary chips for registered game servers (TCP/HTTP ping). No docker.sock control unless ALLOW_DOCKER_SERVER_CONTROL (default false).
docs-sync. Do not commit unless asked.
```

### @agent-uiux — Cover art studio ART-1…3

```text
Role: UI/UX.
Read docs/strategy/cover-art-studio.md.
ART-1: Replace weak default_cover/default_library with branded GameTheca fallbacks (all tile densities).
ART-2/3: Admin Art studio UI — title/system → preview size matrix → download zip / attach to game. Admin/ops only.
Preserve --gt-* tokens; no generic purple AI aesthetic. Coordinate Backend for render API.
docs-sync user/admin one-liners. Do not commit unless asked.
```

### @agent-backend — Mods MOD-1 + Servers SRV-1

```text
Role: Backend.
Read docs/strategy/game-servers-mods.md.
MOD-1: CRUD API for per-game mods (name, version, URL, enabled, order) behind ENABLE_MOD_TRACKING.
SRV-1: Admin-only game server registry (name, connect string, optional game UUID, health URL); members can list/join info only.
No docker control in this slice. Parental: children read-only. pytest. docs-sync.
```

### @agent-desktop — Mods apply + remote play CTA stub

```text
Role: Desktop.
After MOD-1 API exists: companion command to stage/apply mod pack path-safely (MOD-3).
Read docs/strategy/gow-remote-play.md — do NOT vendor Wolf; optional “copy Moonlight host” when admin set remote host (GOW-2 stub OK).
No Discord. Do not commit unless asked.
```

### @agent-backend — Ambient LIGHT-1 spike

```text
Role: Backend.
Read docs/strategy/ambient-lighting.md.
Spike Hyperion.ng JSON-RPC set color/clear on play session start/stop behind ENABLE_AMBIENT_LIGHTING=false.
HA caller can be LIGHT-2. Never block launch. validate LAN URLs. pytest mock. docs-sync .env.example comment only.
```

### @agent-docs — Index + runbooks

```text
Role: Docs.
Index new guides in docs/strategy/README.md, docs-map.md, progress.md Still thin.
Create challenge-solver-unraid.md when Ops adds compose.
Scrub: capability language only; Class D names OK (TRAWL, Hyperion, Moonlight, Home Assistant, Playnite).
No competitor teardown catalogs.
```

### @agent-qa — Verify gates

```text
Role: QA.
When CH/ART/MOD land: pytest challenge client; cover_url fallback; mod ACL; challenge profile documented.
Confirm ENABLE_CHALLENGE_SOLVER default false; MAX_TIER default 5.
```

### @agent-gamemaster — Mods honesty

```text
Role: Game Master.
Review MOD/SRV guides for emulation honesty (WebRetro cannot load PC mods). Sign off wording before member UI claims “Apply mod” on browser-only systems.
```

---

## Status (evening close-out)

| Stream | Status |
|---|---|
| CH-1…CH-5 | **Shipped** |
| ART-1…ART-3 | **Shipped** |
| MOD-1/2 · SRV-1/2 APIs | **Shipped** |
| GOW-1/2 · LIGHT-1/2 · Desktop MOD-3/GOW-2 · TC-1 | **In flight** (active kick) |

**PM lock:** There is **no 1.1 track** — GOW, LIGHT, thin client, ART, CH, MOD/SRV are all **1.0 scope**.

## Open (human)

1. Authentik · Hub image · Unraid rebuild — operator-owned  
2. SCRUB-5 history rewrite — deferred  
