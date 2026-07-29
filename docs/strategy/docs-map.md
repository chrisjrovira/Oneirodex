# Documentation map (runbooks, SOPs, assets)

**Date:** 2026-07-27 · **Product version:** 0.2.0 (in progress)  
**Purpose:** Inventory of docs, ops, and communications.  
**Sync rule:** `.cursor/skills/docs-sync/` + `.cursor/rules/docs-sync.mdc` — update on every code change.

**Program board:**  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`  
**Owner:** Docs (`@agent-docs`) refreshes this canvas **each wave** (Done · Next · Blocked · Team flow) from the PM content brief. PM owns the brief; Docs owns the file edit.

**Feature roadmap mockups:**  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\feature-roadmap-mockups.canvas.tsx`

## Status legend

- **Have** — exists in repo today (may need refresh)  
- **Update** — exists but stale / incomplete  
- **Create** — net-new  

---

## 1. Strategy & product

| Document | Path | Status |
|---|---|---|
| Competitive gap analysis | `docs/strategy/competitive.md` | **Stub** — full catalog in private vault per [external-facing-scrub.md](external-facing-scrub.md) |
| External-facing scrub policy | `docs/strategy/external-facing-scrub.md` | Have — Class A/B/C/D rules + SCRUB backlog; SCRUB-6 PR + Issues templates |
| Feature build plans | `docs/strategy/features.md` | Have |
| Social lite pointer | `docs/strategy/social.md` | Have |
| Social + A/V waves | `docs/strategy/social-av.md` | Have (W16 shipped) |
| Security suite | `docs/strategy/security.md` | Have |
| Icon / image packs | `docs/strategy/icon-themes.md` | Have |
| Bug scrub triage | `docs/strategy/bug-triage.md` | Have |
| EmulatorJS eval | `docs/strategy/emulatorjs-eval.md` | Have |
| Emulation coverage (Wave 19) | `docs/strategy/emulation-coverage.md` | Have |
| UI rebuild plan | `docs/strategy/ui.md` | Have |
| Product roadmap | `docs/strategy/roadmap.md` | Have |
| Execution progress | `docs/strategy/progress.md` | Have |
| Official v1 readiness (team review) | `docs/strategy/v1-readiness.md` | Have — gate 8 text-complete; Capture open |
| PM miss backlog (pre-1.0) | `docs/strategy/pm-miss-backlog.md` | Have |
| Admin hybrid inventory | `docs/strategy/admin-hybrid.md` | Have |
| Upgrade notes (0.2 → 1.0) | `docs/strategy/upgrade-notes-1.0.md` | Have |
| Game Master 1.0 domain sign-off | `docs/strategy/v1-gamemaster-signoff.md` | Have (gate 7) |
| Folder → IGDB name-resolution rules | `docs/strategy/name-resolution.md` | Have — scan_depth=2 + variant order for Backend |
| Console / emulator library layout | `docs/strategy/console-gaming-libraries.md` | Have — per-leaf libs · skip-dir DoD · no depth-3 walker |
| Console / emulator tree → libraries | `docs/strategy/console-gaming-libraries.md` | Have — per-platform leaf libs; exclude emus/tools |
| Docs map (this file) | `docs/strategy/docs-map.md` | Have |
| Decision log (ADRs) | `docs/adr/NNNN-*.md` | Have — [0001 Alembic defer](../adr/0001-schema-migrations-defer-alembic.md) · [0002 api-client SPA defer](../adr/0002-defer-api-client-spa.md) |
| Competitive re-score template | `docs/strategy/competitor-rescore.md` | Create |

---

## 2. User guides

| Guide | Audience | Status | Notes |
|---|---|---|---|
| Getting started (web) | End users | Have | [getting-started.md](../user/getting-started.md) |
| Library browsing & Systems | End users | Have | [library-and-systems.md](../user/library-and-systems.md) — Pass A–F tile/LHN/details; store logos theme-adaptive (PSN · Xbox · Amazon · Humble · itch · EA · Ubisoft SVG · Fandom · unknown) |
| Preferences & themes / icons | End users | Have | [preferences-themes.md](../user/preferences-themes.md) |
| Downloading games | End users | Have | [downloads.md](../user/downloads.md) |
| Browser / companion play matrix | End users | Have | [browser-play.md](../user/browser-play.md) · sample free ROMs [samples/free-roms/](../../samples/free-roms/README.md) |
| Free games (News claims) | End users | Have | [free-games.md](../user/free-games.md) |
| Social, chat & voice | End users | Have | [social-and-voice.md](../user/social-and-voice.md) — includes Friends companion |
| FAQ | End users | Have | [faq.md](../user/faq.md) — aligned with HelpPage |
| Troubleshooting | End users | Have | [troubleshooting.md](../user/troubleshooting.md) |
| Game details / freshness badges | End users | Create | Include OUT / ~ |
| Playing ROMs in browser | End users | Update | Platform matrix |
| Attract mode | End users | Update | Idle timeout, filters |
| Wishlist / requests | End users | Create | |
| Desktop client guide | End users | Have | [desktop-companion.md](../user/desktop-companion.md) |
| Thin client | Strategy → user | Strategy have · user Create at TC-2 | [thin-client.md](thin-client.md) — TC-1/TC-2 shell shipped |
| Android APK + headset VR ladder | Strategy | **Have** | [android-apk-vr.md](android-apk-vr.md) · [headset-vr.md](headset-vr.md) (SteamVR/PSVR2 + Quest) · [controller-input.md](controller-input.md) · [controllers-and-vr.md](../user/controllers-and-vr.md) |
| Challenge / captcha bypass | Strategy → runbook | Have | [challenge-bypass.md](challenge-bypass.md) · [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) — profile **`challenge`**; CH-1…5 **shipped** |
| Cover art studio | Strategy | Have | [cover-art-studio.md](cover-art-studio.md) — **ART-1…3 shipped** |
| GOW / remote play | Strategy | Have | [gow-remote-play.md](gow-remote-play.md) — **GOW-1/2 in 1.0 (in flight)** |
| Mods + game servers | Strategy | Have | [game-servers-mods.md](game-servers-mods.md) — **MOD-1/2 · SRV-1/2 APIs shipped** |
| Ambient lighting | Strategy | Have | [ambient-lighting.md](ambient-lighting.md) — **LIGHT-1/2 in 1.0 (in flight)** |
| PM dispatch (agents) | Strategy | Have | [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md) — Jul 27 PM locks |
| Big Picture / controller | End users | Update | Link from getting-started / social |

---

## 3. Admin guides

| Guide | Status | Notes |
|---|---|---|
| Libraries & scans | Have | [libraries-and-scans.md](../admin/libraries-and-scans.md) |
| Themes & reset | Have | [themes-reset.md](../admin/themes-reset.md) |
| Settings & modules | Have | [settings-modules.md](../admin/settings-modules.md) — feature defaults ON · OIDC opt-in · malware block-on-hit · ClamAV profile |
| Support inbox | Have | [support-inbox.md](../admin/support-inbox.md) |
| Ops summary (`services` + `scans` contract) | Have | [ops-summary.md](../admin/ops-summary.md) — Grafana enrich (`load_avg` / process / db_ping / readyz) · issues.items · LiveKit · malware · companions · queues · scan counters |
| Troubleshooting | Have | [troubleshooting.md](../admin/troubleshooting.md) — Features / malware / OIDC notes |
| First-run setup wizard | Update | `gt-setup` chrome · SECRET_KEY, IGDB, SMTP · `GENERATOR_VERSION` 8 |
| Propose-only scan & proposals | Create | |
| Library Doctor & rename templates | Create | |
| Unmatched & false duplicates | Update | |
| Identify workbench | Update | |
| Freshness bulk & inbox | Update | |
| Image queue / turbo downloads | Update | |
| Users, invites, whitelist | Update | Classic Jinja + React hubs |
| RBAC & parental controls | Update | Covered partially in security |
| Integrations hub | Have | SMTP/IGDB/community/OIDC — **no Discord** |
| Newsletter | Update | |
| Ops glance & server status | Update | `/healthz` · `/readyz` · Compose healthcheck |
| Backups & restore | Create | |
| Plugin management | Have | Includes `rtc.livekit` |
| React admin SPA migration | Update | Shell + Support/Announcements/Dashboard bodies; forms still hybrid |

---

## 4. Runbooks (ops)

| Runbook | Status | Trigger |
|---|---|---|
| [unraid-deploy.md](../runbooks/unraid-deploy.md) | Have | New Unraid container · volume sectioning (games RO vs library RW) · monitor-while-testing · `.env.unraid.example` |
| [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) | Have | Compose install · LiveKit + **ClamAV** + **challenge** profiles |
| [observability-profile.md](../runbooks/observability-profile.md) | Have | Optional Prometheus stub (`# profile: observability`) |
| [container-wont-start.md](../runbooks/container-wont-start.md) | Have | Crash loops |
| [livekit-unraid.md](../runbooks/livekit-unraid.md) | Have | Optional voice SFU |
| [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) | Have | TRAWL profile `challenge` · LAN-only · MITM CA (CH-6) |
| [oidc-sso.md](../runbooks/oidc-sso.md) | Have | SSO |
| [oidc-authentik-unraid.md](../runbooks/oidc-authentik-unraid.md) | Have | Authentik on Unraid |
| [local-postgres-pytest.md](../runbooks/local-postgres-pytest.md) | Have | Docker Desktop Postgres for pytest |
| [steamgriddb-artwork.md](../runbooks/steamgriddb-artwork.md) | Have | Artwork key |
| [desktop-code-signing.md](../runbooks/desktop-code-signing.md) | Have | Unsigned-only product stance |
| [webretro-cores.md](../runbooks/webretro-cores.md) | Have | Operator-vendor PCE/VICE/DOS WASM |
| [reference-sets.md](../runbooks/reference-sets.md) | Have | No-Intro/Redump DAT set completeness |
| [login-rate-limit-proxy.md](../runbooks/login-rate-limit-proxy.md) | Have | Proxy + app login rate limits (O8) |
| [release-checklist.md](../runbooks/release-checklist.md) | Have | Release SOP · CI core pytest / vitest note |
| [scrub-shipped-bundles.md](../runbooks/scrub-shipped-bundles.md) | Have | SCRUB-7 — rebuild `static/dist` + private banned-list grep before image publish |
| [workspace-disk-hygiene.md](../runbooks/workspace-disk-hygiene.md) | Have | Safe cache deletes (target/node_modules) vs KEEP webretro / `.git` |
| [`.github/workflows/ci-tests.yml`](../../.github/workflows/ci-tests.yml) | Have | PR gate: pytest core + member-app vitest |
| `docs/runbooks/database-migrate.md` | Create | Schema / updateschema |
| `docs/runbooks/scan-stuck.md` | Create | Orphan Running jobs |
| `docs/runbooks/download-failures.md` | Create | ASGI zip / path safety |
| `docs/runbooks/enable-arr-module.md` | Create | Optional automation |

---

## 5. Developer docs

| Doc | Status |
|---|---|
| Issue assess / fix workflow | Have — [dev/issue-assess-agent.md](../dev/issue-assess-agent.md) |
| Agent skills index | Have — [dev/agent-skills.md](../dev/agent-skills.md) |
| Docs-sync skill | Have — `.cursor/skills/docs-sync/` |
| Prompt-brief middleman | Have — `.cursor/skills/prompt-brief/` + rule |
| UI tokens (Wave 0 / B+C) | Have — [dev/ui-wave0-tokens.md](../dev/ui-wave0-tokens.md) |
| Architecture overview | Create |
| Local dev setup | Update |
| Frontend build | Update |
| Testing guide | Update |
| OpenAPI contribution | Create |

---

## 6. Screenshots & media needed

Capture at **1920×1080** and **1280×800**; dark default + one alternate preset. Store under `docs/media/screenshots/`; sync README slots under `docs/assets/readme/` (live PNG only — **retired** illustrative `hero-banner.jpg` / `screenshot-*.jpg`).

Checklist: [../assets/readme/CAPTURE.md](../assets/readme/CAPTURE.md) — README **live** for hero, Library, Systems; **Chat blocked** (`screenshot-chat.png`) — local `/login` + `/library` 500 this pass; script writes canonical slot when app healthy. Docs media **done** for Ops Services, Library free ROMs, Systems, Ctrl/Cmd+K, Features, health JSON, and tour video (`docs/media/`).

**Refresh rule:** Re-run `scripts/capture_docs_media.py` (or copy freshest shots into readme slots) on every commit/ship pass that touches member/admin UI.

Also: Friends companion dock + `/social-companion` pop-out, Support report form, Support inbox, Activity voice lobby, Chat, Notifications, Icon pack chips, Big Picture party voice, Admin → Features.

---

## 7. Project-wide updates

| Area | Action |
|---|---|
| README | Synced for 0.2.0 — **live PNG screenshots** (hero · Library · Systems) · Chat capture queued · feature defaults ON · OIDC opt-in · ClamAV profile · Friends companion · no Discord |
| [progress.md](progress.md) | Jul 28 — Member UI + Ops Pass A–F **uncommitted** · store logos theme-adaptive (gap closed) · Chat capture blocked · Unraid waits human ship |
| CHANGELOG | Unreleased catch-up for waves 14–17 + malware / Features; bump when cutting 0.2.0 |
| `.env.example` | Includes LiveKit + SUPPORT_GITHUB_* + malware scan |
| In-app Help (`/help`) | Ctrl/Cmd+K · `/healthz`/`/readyz` · Friends · Report · no Discord |
| Discord | Excised from product — do not reintroduce |

---

## 8. Suggested docs tree

```
docs/
  strategy/           # product direction
  adr/                # architecture decisions (Create)
  user/               # end-user guides + FAQ
  admin/              # admin guides
  runbooks/           # incident & deploy
  sop/                # process
  dev/                # contributor + agent workflow
  media/screenshots/
  openapi/
  superpowers/        # specs, plans, handoffs
```

---

## 9. Immediate next documentation sprint

1. Re-run Capture when UI changes — [CAPTURE.md](../assets/readme/CAPTURE.md) (README live PNGs + `docs/media/` base set; **Chat blocked** on login 500 until app healthy)  
2. ~~Human store logo assets~~ **Done** — theme-adaptive store marks (Ubisoft SVG; others PNG masks) — [library-and-systems.md](../user/library-and-systems.md)  
3. Browser play platform matrix guide refresh  
4. Remaining Create runbooks as incidents hit production  
5. CHANGELOG bump when cutting 0.2.0 (include Member UI + Ops Pass A–F after human ship)  
6. Game details / freshness badges user guide (**Create**)
