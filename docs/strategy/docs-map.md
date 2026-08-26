# Documentation map (runbooks, SOPs, assets)

**Date:** 2026-08-25 · **Product version:** 1.0.0-beta  
**Purpose:** Inventory of docs, ops, and communications.  
**Sync rule:** `.claude/skills/docs-sync/` — update on every code change; required by `CLAUDE.md`.

**Program board:** [progress.md](progress.md) — Ship TLDR · Done · Next · Blocked. Refreshed by `agent-docs` each wave.

> The board used to be a Cursor canvas outside the repo (`…/.cursor/projects/…/gametheca-program.canvas.tsx`), alongside canvases for the feature-roadmap mockups and the W21–W25 wave presentation. Those retired with the Cursor migration on 2026-08-20; `progress.md` is the tracked board now.

## Status legend

- **Have** — exists in repo today (may need refresh)  
- **Update** — exists but stale / incomplete  
- **Create** — net-new  
- **Archived** — dated point-in-time report, kept for provenance in [archive/](archive/README.md), not maintained  

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
| Security + legal remediation | `docs/strategy/security-legal-playbook.md` | Have (2026-08-26) — audit findings with evidence; Phases 0–6 shipped; inline `<script>` extracted; DNS pin on `safe_request`; WebRetro MIT confirmed; L7 operator notes in [privacy-data-handling.md](../admin/privacy-data-handling.md); remaining on purpose: CSP report-only (`onclick=` / WebRetro eval), non-commercial core clauses |
| Icon / image packs | `docs/strategy/icon-themes.md` | Have — Wave 2d paired packs + loading motifs (`GENERATOR_VERSION` 10) |
| Bug scrub triage | `docs/strategy/bug-triage.md` | Have |
| EmulatorJS eval | `docs/strategy/emulatorjs-eval.md` | Have |
| Emulation coverage (Wave 19) | `docs/strategy/emulation-coverage.md` | Have |
| Cheats (Wave 3 stance · Wave 19 surface) | `docs/strategy/cheats.md` | Have — GM taxonomy: `.cht` canonical · `cheat_surface` RetroArch-only · easy-create · no Class A trainer brands · no scrapes |
| UI rebuild plan | `docs/strategy/ui.md` | Have |
| Product roadmap | `docs/strategy/roadmap.md` | Have |
| Feedback roadmap W22–W25 | `docs/strategy/roadmap-w22-plus.md` | Have — Aug-01 human feedback; **W21** = first-scan (Done uncommitted, not renumbered); **W22 UI rem closed** (**W22-1 Done** UI+BE QA **13/13** · **W22-match Done** · **QA PASS 138+10** · **UID-001 QA PASS 31/31** · **UID-002 QA PASS 20/20** · **UID-005** Done · **UID-009 Done** · **QA PASS 11/11** · **UID-016 Done** · UI **32/32** · BE size/mtime **13/13** · **UID-004 Done** · **QA PASS 33/33** · next UI **W23**) · **BE-DET** In progress (**BE-DET-1…9** Done · **DET-8 QA PASS 141/141** · **DET-9 QA PASS 65/65** · **Next** **BE-DET-10**) |
| Execution progress | `docs/strategy/progress.md` | Have — **W22-1 Done** (BE batch APIs + UI) · UI/BE QA **13/13** · **W22-match Done** · **QA PASS 138+10** · **UID-001 Done** · **QA PASS 31/31** · **UID-002 Done** · **QA PASS 20/20** · **UID-005 Done** · **UID-009 Done** · **QA PASS 11/11** · **UID-016 Done** · UI **32/32** · BE size/mtime **13/13** · **UID-004 Done** · **QA PASS 33/33** · **W22 UI rem closed** · **GM detection coverage brief Done** · **BE-DET-1…9 Done** · **DET-8 QA PASS 141/141** · **DET-9 QA PASS 65/65** · **Next** **BE-DET-10** · links W22+ + ui-debt-log |
| Official v1 readiness (team review) | `docs/strategy/v1-readiness.md` | Have — gate 8 text-complete; Capture recipe exists; **1.0.0-beta** ship track; GOW/LIGHT/TC-1/cmdk **shipped** |
| PM miss backlog (pre-1.0) | `docs/strategy/pm-miss-backlog.md` | Have |
| Admin hybrid inventory | `docs/strategy/admin-hybrid.md` | Have |
| Upgrade notes (0.2 → 1.0) | `docs/strategy/upgrade-notes-1.0.md` | Have |
| Game Master 1.0 domain sign-off | `docs/strategy/v1-gamemaster-signoff.md` | Have (gate 7) |
| Folder → IGDB name-resolution rules | `docs/strategy/name-resolution.md` | Have — Stage A0–A14 **Done**; **W20-2 transform trail Done**; **B15–B20** console ROM peel · gate **GB…SWITCH + SEGA_SATURN/DC + NEOGEO_CD + ARCADE** files always + dump-shaped folders (**BE-DET-1…8 Done** uncommitted · **QA PASS 141/141** peel+Stage E · be_det8 **14/14** · peel+multi-disc **QA PASS 140/140** · `ROM_EXT_RE` P1+`.gdi`/`.cdi` · SWITCH A1∪B16 · Arcade/AES set peel · propose-first · AES≠CD · threshold **0.92**) · **BE-DET-9 Done** (fandom soft alias / series / remaster / EN↔JP / soft-title · propose-first · hard auto ≥**0.92** · **QA PASS 65/65** · fixture pack 50 soft · capability-only public docs) · **BE-DET-4 Done** (`rom_region` / `rom_languages` persist + Unmatched trail · **QA PASS 118/118**) · **BE-DET-5 Done** (multi-disc grouping · disc extras · cue+bin · `is_multi_disc`/`discs[]` · **QA PASS 119/119**) · **BE-DET-6 Done** (DAT unique-hash inner archive · **QA PASS 14/14**) · **C12** article-reorder · **C14** punctuation-light · UPDATE-package why note · Kind Soft title/Utility · **W22-match Done** (uncommitted · **QA PASS 138+10** · live rescan skipped) · **Next:** **BE-DET-10** image kinds |
| Store metadata identify · ownership (Meta/Quest+) | `docs/strategy/store-metadata-identify.md` | Have — META-1 + **gaming software/emulator/tool** full `item_kind` loop (browse filter · mark_kind · badges · SPA Kind chips); unmatched `suggested_kind` denormalized (Wave 4) + legacy **backfill** + `why_unmatched` (Wave 5 Done); Steam software identify; **W20-3 enrich parity Done** (manual IGDB taxonomy upsert · Steam genres/modes); **W20-5a Stage D Done** (IGDB miss → Steam App ID / exact Steam / exact GOG custom before Unmatched · pytest 12/12); DRM register-only; no LibraryPlatform.QUEST |
| Console / emulator library layout | `docs/strategy/console-gaming-libraries.md` | Have — per-leaf libs · skip-dir Done (W20-7 #4 · extended globs + repack regex + Admin `re:`/`dir:` · **QA PASS 56/56**) · no depth-3 walker |
| Console / emulator tree → libraries | `docs/strategy/console-gaming-libraries.md` | Have — per-platform leaf libs; exclude emus/tools |
| Docs map (this file) | `docs/strategy/docs-map.md` | Have |
| Decision log (ADRs) | `docs/adr/NNNN-*.md` | Have — [0001 Alembic defer](../adr/0001-schema-migrations-defer-alembic.md) · [0002 api-client SPA defer](../adr/0002-defer-api-client-spa.md) |
| Competitive re-score template | `docs/strategy/competitor-rescore.md` | Create |
| Cloud vs Unraid TCO ballpark | `docs/strategy/cloud-tco-ballpark.md` | Have — Finance first-pass **Done** 2026-08-01 · Unraid-first; detailed worksheet in private vault (gitignored) |

---

## 2. User guides

| Guide | Audience | Status | Notes |
|---|---|---|---|
| Getting started (web) | End users | Have | [getting-started.md](../user/getting-started.md) |
| Library browsing & Systems | End users | Have | [library-and-systems.md](../user/library-and-systems.md) — Signals chips · Ctrl+K title search · details trailers/extras/`on_server` · OpenPathModal · page sizes →1000 · Friends dock |
| Preferences & themes / icons / fonts | End users | Have | [preferences-themes.md](../user/preferences-themes.md) — Wave 2d 9 distinct presets + paired icon packs · loading icons admin tip · **font picker** (files operator-supplied — admin [theme-fonts-and-images.md](../admin/theme-fonts-and-images.md)) |
| Downloading games | End users | Have | [downloads.md](../user/downloads.md) — native Torznab/Newznab + optional Prowlarr/Jackett merge |
| Browser / companion play matrix | End users | Have | [browser-play.md](../user/browser-play.md) · sample free ROMs [samples/free-roms/](../../samples/free-roms/README.md) |
| Free games (News claims) | End users | Have | [free-games.md](../user/free-games.md) |
| Social, chat & voice | End users | Have | [social-and-voice.md](../user/social-and-voice.md) — includes Friends companion · **W23 Spaces** (household vs invite-only servers, text + voice channels, invite codes) · per-room LiveKit authorization |
| FAQ | End users | Have | [faq.md](../user/faq.md) — aligned with HelpPage |
| Troubleshooting | End users | Have | [troubleshooting.md](../user/troubleshooting.md) |
| Game details / freshness badges | End users | Create | Tile contract in [library-and-systems.md](../user/library-and-systems.md) (no OUT/~ /RELEASE; four-corner; UPDATE alone) — optional dedicated guide |
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
| GPU worker node (post-1.0) | Strategy | Have — **nice-to-have backlog (not started)** | [gpu-worker-node.md](gpu-worker-node.md) — GPU-N1…N5; plain `AI_ARTWORK_URL` stays the shipped path |
| Cover art studio | Strategy | Have | [cover-art-studio.md](cover-art-studio.md) — **ART-1…3 + ART-5 shipping** (system templates); ART-4 deferred |
| GOW / remote play | Strategy | Have | [gow-remote-play.md](gow-remote-play.md) — **GOW-1/2 in 1.0 (in flight)** |
| Mods + game servers | Strategy | Have | [game-servers-mods.md](game-servers-mods.md) — **MOD-1/2 · SRV-1/2 APIs shipped** |
| Ambient lighting | Strategy | Have | [ambient-lighting.md](ambient-lighting.md) — **LIGHT-1/2 in 1.0 (in flight)** |
| PM dispatch (agents) | Strategy | **Archived** | [archive/pm-dispatch-2026-07-27.md](archive/pm-dispatch-2026-07-27.md) — Jul 27 PM locks |
| GitHub surface scrub (SCRUB-6b) | Strategy | **Archived** | [archive/github-scrub-2026-07-27.md](archive/github-scrub-2026-07-27.md) — 0 Class A hits; policy stays in [external-facing-scrub.md](external-facing-scrub.md) |
| Full-program review | Strategy | **Archived** | [archive/review-2026-08-03-findings.md](archive/review-2026-08-03-findings.md) — 9 defects, all fixed |
| Gap review | Strategy | **Archived** | [archive/gap-review-2026-08-05.md](archive/gap-review-2026-08-05.md) — missing / half-done after W23–W26 |
| Code review | Strategy | **Archived** | [archive/code-review-2026-08-06.md](archive/code-review-2026-08-06.md) — static passes + full pytest |
| Strategy archive index | Strategy | Have | [archive/README.md](archive/README.md) — what "archived" means and when a file moves there |
| W28 carryover ledger | Strategy | Have | [carryover-w28.md](carryover-w28.md) — index over W26/W27/ui-debt-log and the open set |
| Request reconciliation | Strategy | Have — living | [request-reconciliation-2026-08-15.md](request-reconciliation-2026-08-15.md) — every ask checked against the registers |
| Big Picture / controller | End users | Update | Link from getting-started / social |

---

## 3. Admin guides

| Guide | Status | Notes |
|---|---|---|
| Libraries & scans | Have | [libraries-and-scans.md](../admin/libraries-and-scans.md) — **W22-1 Done** unified chrome (`/libraries` · `/scan_management`) · multi-select sticky **Scan**/**Edit**/**Delete** → `POST …/batch/{scan,edit,delete}` · **BE batch APIs Done** (`force` skips typed names; UI prefers batch / 404 soft-degrade) · Layout chips · `gt-toast-host` · **UX-B7** library-add digest at scan end · scan queue/force · unmatched · **UID-005** top actions / Resolve pills / client sort · Wave 18 timing/filters · **Scanning filters** · **W20-1/1b** propose/import · **W20-2** trail · **W20-4** scan-match · **W20-5a** Stage D · post-deploy Reset Themes (`admin_manage_libs` for sticky Scan/Edit · `admin_manage_scanjobs`) |
| [members-and-invites.md](../admin/members-and-invites.md) | Have | Invites as links (email optional) · admin-created accounts with no email · `.invalid` placeholder rationale |
| Themes & reset | Have | [themes-reset.md](../admin/themes-reset.md) — `GENERATOR_VERSION` 10 · Reset after Wave 2d · **W22-1** `admin_manage_libs` + `admin_manage_scanjobs` (+ **UID-005** · Soft title/Utility) · loading motifs on volume |
| Settings & modules | Have | [settings-modules.md](../admin/settings-modules.md) — feature defaults ON · OIDC opt-in · malware block-on-hit · ClamAV · native Arr indexers (add/bulk/presets) + Prowlarr/Jackett · **W20-4** Scan/match Settings **Done** (`/admin/scan_match` + `GET|PUT /api/admin/scan-match/config` · defaults 0.92/0.08/0.85/conservative) |
| Discover sections (storefront · zones · events) | Have | [discover-sections.md](../admin/discover-sections.md) — manual pick / library / platform / genre zones, reorder + hide built-ins · **W25** storefront shelves (`curated_for_you` · `upcoming`) · `shelf`/`hero`/`carousel` layouts · scheduled **events** (`starts_at`/`ends_at`, UTC) |
| Theme fonts & batch artwork | Have | [theme-fonts-and-images.md](../admin/theme-fonts-and-images.md) — OFL/era faces (no manufacturer typefaces; **files operator-supplied**, `installed` reported honestly) · magic-byte validated upload · `<uuid>[_<kind>]` batch image upload |
| Support inbox | Have | [support-inbox.md](../admin/support-inbox.md) |
| Ops summary (`services` + `scans` contract) | Have | [ops-summary.md](../admin/ops-summary.md) — Grafana enrich (`load_avg` / process / db_ping / readyz) · two-fold `issues.items` (`category` action\|warning\|info; **disk = info**) · LiveKit · malware · companions · queues · scan counters |
| Library root watch | Have | [library-root-watch-spike.md](../admin/library-root-watch-spike.md) — Wave 3 optional `GT_LIBRARY_WATCH` (default off); Ops `services.library_watch` |
| Troubleshooting | Have | [troubleshooting.md](../admin/troubleshooting.md) — Features / malware / OIDC notes |
| Privacy & data handling | Have | [privacy-data-handling.md](../admin/privacy-data-handling.md) — operator-adaptable notes (L7); not a public ToS |
| First-run setup wizard | Update | `gt-setup` chrome · SECRET_KEY, IGDB, SMTP · `GENERATOR_VERSION` 10 |
| Propose-only scan & proposals | Create | |
| Library Doctor & rename templates | Create | |
| Unmatched & false duplicates | Have | [libraries-and-scans.md#unmatched-folders](../admin/libraries-and-scans.md#unmatched-folders) — Wave 17: filters · batch · soft **Amend naming** · nested `matched_game` / **Dupe of** · **UID-005** per-row top actions · Resolve equal pills · client sort Folder/Status/Library/Platform · Dupe glance parity · **W20-2** `transforms[]` + **Name transform trail** expander (Dupe glance + scanjobs; soft-degrade) · Dupe glance · merge/keep/ignore · OpenPathModal · export · PC extras |
| Identify workbench | Have | W20-3 enrich parity — Manual Identify upserts IGDB taxonomy · Steam genres/modes — [store-metadata-identify.md](store-metadata-identify.md) · [libraries-and-scans.md](../admin/libraries-and-scans.md) |
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
| [install-native.md](../runbooks/install-native.md) | Have | Native install Linux · macOS · Windows · installer flags · systemd/launchd/NSSM · upgrade |
| [remote-scan-locations.md](../runbooks/remote-scan-locations.md) | Have | `GT_LIBRARY_ROOTS` — NAS shares / extra disks; SMB · NFS · UNC · autofs · Docker binds |
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
| Agent skills + agents index | Have — [dev/agent-skills.md](../dev/agent-skills.md) — 7 skills · 13 domain agents · intent router · wrong-seat refuse · lanes |
| UI debt log (recurring defects) | Have — [dev/ui-debt-log.md](../dev/ui-debt-log.md) — badge inventory · UID-001…015 · **UID-001**/**UID-002**/**UID-005**/**UID-009** done · UI Tasks must update |
| Docs-sync skill | Have — `.claude/skills/docs-sync/` |
| Agent locks (product + engineering defaults) | Have — [dev/agent-locks.md](../dev/agent-locks.md) |
| W31 commit attribution (security vs UI) | Have — [dev/w31-commit-attribution.md](../dev/w31-commit-attribution.md) — 130 UI · 100 security · 6 overlapping; split assessed and deliberately not performed |
| UI tokens (Wave 0 / B+C) | Have — [dev/ui-wave0-tokens.md](../dev/ui-wave0-tokens.md) |
| Architecture overview | Create |
| Local dev setup | Update |
| Frontend build | Update |
| Testing guide | Update |
| OpenAPI contribution | Create |

---

## 6. Screenshots & media needed

Capture at **1920×1080** and **1280×800**; dark default + one alternate preset. Store under `docs/media/screenshots/`; sync README slots under `docs/assets/readme/` (live PNG only — **retired** illustrative `hero-banner.jpg` / `screenshot-*.jpg`).

Checklist: [../assets/readme/CAPTURE.md](../assets/readme/CAPTURE.md) — README **live** for hero, Library, Systems; **Capture needed** (Waves **4–14 shipped on main @ c35a927b** · Waves **15–19** uncommitted) — `screenshot-chat.png` (**Wave 16 full-room**) + **Wave 17 Unmatched** (filters · batch bar · Amend naming · Dupe of) + **Wave 18** Scan jobs timing/filters + details cover **⋮** + **Wave 19** Edit Images aurora · Cheats gate (retroarch-only) · full path wrap · chip underline/scale + Calendar/News · Library MISSING/multi-select · Admin Manual Queue/Force · prior W9–14 · theme refresh; run when `/login`+`/library` return 200. Docs media **done** for Ops Services, Library free ROMs, Systems, Ctrl/Cmd+K, Features, health JSON, and tour video (`docs/media/`).

**Refresh rule:** Re-run `scripts/capture_docs_media.py` (or copy freshest shots into readme slots) on every commit/ship pass that touches member/admin UI.

Also: Friends companion dock + `/social-companion` pop-out, Support report form, Support inbox, Activity voice lobby, Chat, Notifications, Icon pack chips, Big Picture party voice, Admin → Features.

---

## 7. Project-wide updates

| Area | Action |
|---|---|
| README | Synced for **1.0.0-beta** — live PNG screenshots (hero · Library · Systems) · Chat Capture **needed** (populated instance) · feature defaults ON · OIDC opt-in · ClamAV profile · Friends companion · no Discord · no OUT/~ badge copy |
| [progress.md](progress.md) | Aug 01 — **BE-DET-9 Done** fandom alias · **QA PASS 65/65** · fixture pack 50 soft · DoD met · live skipped · **BE-DET-8** Arcade/AES · **QA PASS 141/141** · **UID-016** BE disk-meta **QA PASS 13/13** (UI soft-read **32/32**) · **UID-004 Done** (**QA PASS 33/33**) · **W22 UI rem closed** · **BE-DET-1…8** preserved · **UID-009/001/002/005** QA PASS · **UI-W22-M7** · **W22-1** · **W22-match** · **QA PASS 138+10** · **Next** **BE-DET-10** image kinds · **W23** · [roadmap-w22-plus.md](roadmap-w22-plus.md) · [ui-debt-log.md](../dev/ui-debt-log.md) · **Reset Themes** `admin_manage_scanjobs` + `gt-chrome.css` + libs/badge · **Finance TCO Done** · **W21** preserved · W23–W25 Queued · seats 1–14 · `:5006` BLOCKED · smoking gun: `(digits)` ≠ Steam App IDs · no Class A |
| CHANGELOG | Unreleased — child ACL · CSRF ratchet · Flask-Mail collapse · CKEditor off-box · provider `fetch_image` SSRF · vendor JS scoped · WebRetro MIT · L7 privacy notes · docs hygiene; bump when cutting the next tag |
| `.env.example` | Includes LiveKit + SUPPORT_GITHUB_* + malware scan |
| In-app Help (`/help`) | Accordion Help · Kind Soft titles / Utilities · EXP/TOOL tooltips · Library Filters chevron-rail collapse · Tile badges four-corner / no OUT/~ /RELEASE · Jump top/bottom on scrollable pages · Chat slide-out · Preferences sectioned · Report Context/Logs collapsed · News tabs · Notifications dense · API token urlsafe/`-`/`_` + HTTP Copy · Ctrl/Cmd+K · Signals UPDATE · MISSING · NEW · LANG · Friends · no Discord · browser-play Pause/Reset/Mute/volume/Power |
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

1. Capture when `:5006` healthy (**Waves 4–14 on main · Waves 15–21 Done uncommitted · W22-1 Done · UI-W22-M7 Done · UID-001/002/004/005/009/016 Done · QA PASS · W22 UI rem closed · W22-match Done · QA PASS 138+10 · BE-DET-1…9 Done · DET-8 QA PASS 141/141 · DET-9 QA PASS 65/65**) — [CAPTURE.md](../assets/readme/CAPTURE.md) (README live PNGs + Wave 16 full-room Chat · **Wave 17 Unmatched** · **Wave 18** Scan jobs · **Wave 19** Edit Images / Cheats · W20 Identify chips + unmatched filters · **W21 Stage E chips** · **W22 Library+Scans** merged tabs · Soft title/Utility kind · **Search name** · UID-005 top actions / Resolve pills / sort · **UID-016 Dupe side-by-side** · **Library Filters collapsed chevron rail** · **UID-001 Library badge four-corner chrome** · **UID-009 ScrollJump** · theme refresh)  
2. ~~Human store logo assets~~ **Done** — theme-adaptive store marks (Ubisoft SVG; others PNG masks) — [library-and-systems.md](../user/library-and-systems.md)  
3. Browser play platform matrix guide refresh (Wave 15c artistic rooms + firmware upload/`EMULATOR_BIOS_PATH`)  
4. Remaining Create runbooks as incidents hit production  
5. CHANGELOG bump when cutting 0.2.0 (include Waves 4–14 + Waves 15–21 polish)  
6. Game details / freshness badges user guide (**Create**)  
7. Human: **Reset Default Themes** (`admin_manage_libs` + `admin_manage_scanjobs` + **UID-016** Dupe side-by-side Compare + **UID-004 Search name** + **UID-001** badge chrome in theme `components.css` / filter chips · Soft title/Utility + **UID-005** top actions / Resolve pills / sort + identify JS + `stageECandidates.js` + **UID-009** `gt-chrome.css`) · member SPA rebuild (ScrollJump + Library tiles) · schema restart (+ `mobygames_api_key` + `thegamesdb_api_key` + Stage E JSON columns) · set Moby/TGDB keys · upload DATs · **ship** Waves 15–20 + **W21** + **W22-match** + **UI-W22-M7** + **UID-001** + **UID-002** + **UID-004** + **UID-005** + **UID-009** + **UID-016** + **BE-DET-1…9** **before** any Stage D App-ID / `(digits)` rescan · GB…SWITCH + Saturn/DC/Neo Geo CD + Arcade/AES files-mode + dump-shaped folders-mode leaf rescans after ship · **Board:** **Next BE-DET-10** · **BE-DET-9 QA PASS 65/65** · **BE-DET-8 QA PASS 141/141** · **UID-004 QA PASS 33/33** · **W22 UI rem closed** · **W23** next UI — see [progress.md](progress.md) · [roadmap-w22-plus.md](roadmap-w22-plus.md)  
8. ~~Favicon Class A scrub~~ **Done** (uncommitted; hard-refresh after ship) — see [progress.md](progress.md)  
9. UI debt register + W22+ presentation kept current — [ui-debt-log.md](../dev/ui-debt-log.md) (UID-001/002/003/004/005/009/016 done · Capture W22 Library+Scans + Search name + Dupe sxs + collapsed Filters + ScrollJump when `:5006` up)  
10. Capture slot **W22 Library+Scans** (merged tabs · multi-select · force-delete · Soft title/Utility kind · Search name · UID-005 actions/sort · UID-016 Dupe sxs · Library Filters collapsed rail · ScrollJump) when healthy — [CAPTURE.md](../assets/readme/CAPTURE.md)
