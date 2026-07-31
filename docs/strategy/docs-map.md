# Documentation map (runbooks, SOPs, assets)

**Date:** 2026-07-29 · **Product version:** 0.2.0 (in progress)  
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
| Social + A/V waves | `docs/strategy/social-av.md` | Have (W16 shipped) · post-1.0 native RTC plan → [native-rtc.md](native-rtc.md) |
| Security suite | `docs/strategy/security.md` | Have · post-1.0 native malware plan → [native-malware-scan.md](native-malware-scan.md) |
| Icon / image packs | `docs/strategy/icon-themes.md` | Have — Wave 2d paired packs + loading motifs (`GENERATOR_VERSION` 10) |
| Bug scrub triage | `docs/strategy/bug-triage.md` | Have |
| EmulatorJS eval | `docs/strategy/emulatorjs-eval.md` | Have |
| Emulation coverage (Wave 19) | `docs/strategy/emulation-coverage.md` | Have |
| Cheats (Wave 3 stance) | `docs/strategy/cheats.md` | Have — GM taxonomy: `.cht` canonical · easy-create · no scrapes |
| UI rebuild plan | `docs/strategy/ui.md` | Have |
| Product roadmap | `docs/strategy/roadmap.md` | Have |
| Execution progress | `docs/strategy/progress.md` | Have |
| Official v1 readiness (team review) | `docs/strategy/v1-readiness.md` | Have — gate 8 text-complete; Capture open |
| PM miss backlog (pre-1.0) | `docs/strategy/pm-miss-backlog.md` | Have |
| Admin hybrid inventory | `docs/strategy/admin-hybrid.md` | Have |
| Upgrade notes (0.2 → 1.0) | `docs/strategy/upgrade-notes-1.0.md` | Have |
| Game Master 1.0 domain sign-off | `docs/strategy/v1-gamemaster-signoff.md` | Have (gate 7) |
| Folder → IGDB name-resolution rules | `docs/strategy/name-resolution.md` | Have — Stage A0–A8 **Done**; A9–A14 classified; glued VR peel for software titles; Backend DoD checked; code uncommitted until human ships |
| Store metadata identify · ownership (Meta/Quest+) | `docs/strategy/store-metadata-identify.md` | Have — META-1 + **gaming software/emulator/tool** full `item_kind` loop (browse filter · mark_kind · badges · SPA Kind chips); unmatched `suggested_kind` denormalized (Wave 4) + legacy **backfill** + `why_unmatched` (Wave 5 Done); Steam software identify; DRM register-only; no LibraryPlatform.QUEST |
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
| Library browsing & Systems | End users | Have | [library-and-systems.md](../user/library-and-systems.md) — Signals chips · Ctrl+K title search · details trailers/extras/`on_server` · OpenPathModal · page sizes →1000 · Friends dock |
| Preferences & themes / icons | End users | Have | [preferences-themes.md](../user/preferences-themes.md) — Wave 2d 9 distinct presets + paired icon packs · loading icons admin tip |
| Downloading games | End users | Have | [downloads.md](../user/downloads.md) — native Torznab/Newznab + optional Prowlarr/Jackett merge |
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
| Thin client | Strategy → user | **Have** | [thin-client.md](thin-client.md) · user [thin-client.md](../user/thin-client.md) — TC-1/TC-2 shell shipped (`tauri:build:thin`) |
| Android APK + headset VR ladder | Strategy | **Have** | [android-apk-vr.md](android-apk-vr.md) · [headset-vr.md](headset-vr.md) (SteamVR/PSVR2 + Quest) · [controller-input.md](controller-input.md) · [controllers-and-vr.md](../user/controllers-and-vr.md) |
| Challenge / captcha bypass | Strategy → runbook | Have | [challenge-bypass.md](challenge-bypass.md) · [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) — profile **`challenge`**; CH-1…5 **shipped** |
| Native challenge solver (post-1.0) | Strategy | Have — **nice-to-have backlog (not started)** | [native-challenge-solver.md](native-challenge-solver.md) — NCS-1…5; TRAWL stays 1.0 path |
| Native household RTC (post-1.0) | Strategy | Have — **nice-to-have backlog (not started)** | [native-rtc.md](native-rtc.md) — RTC-N1…N5; LiveKit stays shipped optional default |
| Native malware scan (post-1.0) | Strategy | Have — **nice-to-have backlog (not started)** | [native-malware-scan.md](native-malware-scan.md) — MAL-N1…N5; ClamAV stays optional until cutover |
| Cover art studio | Strategy | Have | [cover-art-studio.md](cover-art-studio.md) — **ART-1…3 + ART-5 shipping** (system templates); ART-4 deferred |
| GOW / remote play | Strategy | Have | [gow-remote-play.md](gow-remote-play.md) — **GOW-1/2 in 1.0 (in flight)** |
| Mods + game servers | Strategy | Have | [game-servers-mods.md](game-servers-mods.md) — **MOD-1/2 · SRV-1/2 APIs shipped** |
| Ambient lighting | Strategy | Have | [ambient-lighting.md](ambient-lighting.md) — **LIGHT-1/2 in 1.0 (in flight)** |
| PM dispatch (agents) | Strategy | Have | [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md) — Jul 27 PM locks |
| Big Picture / controller | End users | Update | Link from getting-started / social |

---

## 3. Admin guides

| Guide | Status | Notes |
|---|---|---|
| Libraries & scans | Have | [libraries-and-scans.md](../admin/libraries-and-scans.md) — scan queue/force · unmatched · **Scanning filters** (name tag vs `dir:` skip · prefix globs · Reset Themes for scanjobs CSS/JS) |
| Themes & reset | Have | [themes-reset.md](../admin/themes-reset.md) — `GENERATOR_VERSION` 10 · Reset after Wave 2d · loading motifs on volume |
| Settings & modules | Have | [settings-modules.md](../admin/settings-modules.md) — feature defaults ON · OIDC opt-in · malware block-on-hit · ClamAV · native Arr indexers (add/bulk/presets) + Prowlarr/Jackett |
| Discover sections (custom zones) | Have | [discover-sections.md](../admin/discover-sections.md) — manual pick / library / platform / genre zones, reorder + hide built-ins |
| Support inbox | Have | [support-inbox.md](../admin/support-inbox.md) |
| Ops summary (`services` + `scans` contract) | Have | [ops-summary.md](../admin/ops-summary.md) — Grafana enrich (`load_avg` / process / db_ping / readyz) · two-fold `issues.items` (`category` action\|warning\|info; **disk = info**) · LiveKit · malware · companions · queues · scan counters |
| Library root watch | Have | [library-root-watch-spike.md](../admin/library-root-watch-spike.md) — Wave 3 optional `GT_LIBRARY_WATCH` (default off); Ops `services.library_watch` |
| Troubleshooting | Have | [troubleshooting.md](../admin/troubleshooting.md) — Features / malware / OIDC notes |
| First-run setup wizard | Update | `gt-setup` chrome · SECRET_KEY, IGDB, SMTP · `GENERATOR_VERSION` 10 |
| Propose-only scan & proposals | Create | |
| Library Doctor & rename templates | Create | |
| Unmatched & false duplicates | Have | [libraries-and-scans.md#unmatched-folders](../admin/libraries-and-scans.md#unmatched-folders) — Dupe glance · merge/keep/ignore · OpenPathModal (no Auto Scan) · fix search · CSV/JSON export · PC extras sidecar |
| Identify workbench | Update | |
| Freshness bulk & inbox | Update | |
| Image queue / turbo downloads | Have | [libraries-and-scans.md#image-queue](../admin/libraries-and-scans.md#image-queue) — thumbnails, group by game, retry failed |
| Users, invites, whitelist | Update | Classic Jinja + React hubs |
| RBAC & parental controls | Update | Covered partially in security |
| Integrations hub | Have | SMTP/IGDB/community/OIDC + **Provider inventory** (`GET /api/admin/integrations/inventory`) — **no Discord** |
| Newsletter | Update | |
| Ops glance & server status | Have | `/healthz` · `/readyz` · Compose healthcheck · **`/admin/server_logs`** alias · Ops silent poll + Refresh · disk issues = **info** |
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
| Agent skills index | Have — [dev/agent-skills.md](../dev/agent-skills.md) — Jul 29 process refresh: sphere · seat router · wrong-seat refuse · ship helpers · lanes |
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

Checklist: [../assets/readme/CAPTURE.md](../assets/readme/CAPTURE.md) — README **live** for hero, Library, Systems; **Capture needed on ship (Waves 4–14 ready)** — `screenshot-chat.png` (Wave 2b–3 slide-out · Archive/Leave · muted badge) + Calendar/Updates densify shots + optional Library multi-select sticky (Select page · partial toasts · Waves 9–11 Add to wishlist / Play status / More freshness) + Wave 12 theme swatches / More densify / fair factors · Library Refresh covers · Admin `/admin/quality_profiles` SPA · Admin `/admin/storage` SPA · **details versions Missing-on-disk / Remove missing** + optional Ops library health MetricTile grade tone / poor factors danger edge + refresh Library/Systems/hero if Wave **2d** presets drifted; run when `/login`+`/library` return 200. Docs media **done** for Ops Services, Library free ROMs, Systems, Ctrl/Cmd+K, Features, health JSON, and tour video (`docs/media/`).

**Refresh rule:** Re-run `scripts/capture_docs_media.py` (or copy freshest shots into readme slots) on every commit/ship pass that touches member/admin UI.

Also: Friends companion dock + `/social-companion` pop-out, Support report form, Support inbox, Activity voice lobby, Chat, Notifications, Icon pack chips, Big Picture party voice, Admin → Features.

---

## 7. Project-wide updates

| Area | Action |
|---|---|
| README | Synced for 0.2.0 — **live PNG screenshots** (hero · Library · Systems) · Chat Capture **needed** · feature defaults ON · OIDC opt-in · ClamAV profile · Friends companion · no Discord |
| [progress.md](progress.md) | Jul 30 — **Wave 14b closed** (uncommitted · QA DoD met: versions artwork **7/7** · GameDetails+detailsMedia **15/15** · `path_missing`/`downloadable`/`size` · cleanup_orphans · Default chip · Missing on disk · Remove missing) · Waves **4–14b** closed uncommitted · **ready-for-ship** · live `:5006` **BLOCKED (env)** OK · **Next:** Human ship Waves **4–14** (commit+push) · Capture **needed on ship** · do **not** invent Wave 15 · Reset Themes + local vendor rebuild/restart post-deploy · Unraid free disk waits human · deploy: app restart for updateschema `path_status` |
| CHANGELOG | Unreleased catch-up for waves 14–17 + malware / Features; bump when cutting 0.2.0 |
| `.env.example` | Includes LiveKit + SUPPORT_GITHUB_* + malware scan |
| In-app Help (`/help`) | Accordion Help · Chat slide-out · Preferences sectioned · Report Context/Logs collapsed · News tabs · Notifications dense · API token urlsafe/`-`/`_` + HTTP Copy · Ctrl/Cmd+K · Signals · Friends · no Discord |
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

1. Re-run Capture on human ship (**Waves 4–14 ready**) — [CAPTURE.md](../assets/readme/CAPTURE.md) (README live PNGs + `docs/media/` base set; **Chat + Calendar/Updates + optional Wave 9–13 multi-select sticky / Select page / W11 wishlist+play-status / W12 theme swatches / More densify / Refresh covers / Admin `/admin/quality_profiles` · `/admin/storage` · details versions Missing-on-disk / Remove missing + Wave 2d theme refresh needed** until login healthy)  
2. ~~Human store logo assets~~ **Done** — theme-adaptive store marks (Ubisoft SVG; others PNG masks) — [library-and-systems.md](../user/library-and-systems.md)  
3. Browser play platform matrix guide refresh  
4. Remaining Create runbooks as incidents hit production  
5. CHANGELOG bump when cutting 0.2.0 (include Member UI + Ops Pass A–F + Wave 1+2 feedback fixes after human ship)  
6. Game details / freshness badges user guide (**Create**)  
7. Human: Unraid `git pull` + rebuild, **Reset Default Themes**, and **free disk space** (host reported ~99% full) before the pull/rebuild — see [progress.md](progress.md) Operator-owned
