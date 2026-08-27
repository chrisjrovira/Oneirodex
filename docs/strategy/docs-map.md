# Documentation map (runbooks, SOPs, assets)

**Date:** 2026-08-27 · **Product version:** 1.0.0-beta  
**Purpose:** Inventory of docs, ops, and communications.  
**Sync rule:** `.cursor/skills/docs-sync/` (mirrored under `.claude/skills/docs-sync/`).

**Program board:** [progress.md](progress.md) — living head only (Ship TLDR · Done · Next · Blocked). Wave diary: [archive/progress-waves-2026-07-08.md](archive/progress-waves-2026-07-08.md).

Status cells are `Have` / `Update` / `Create` / `Archived` plus one short freshness clause. Do not paste QA PASS strings here.

## Status legend

- **Have** — exists in repo today (may need refresh)  
- **Update** — exists but stale / incomplete  
- **Create** — net-new  
- **Archived** — dated point-in-time report, kept for provenance in [archive/](archive/README.md), not maintained  

---

## 1. Strategy & product

| Document | Path | Status |
|---|---|---|
| Competitive gap analysis | `docs/strategy/competitive.md` | **Stub** — full catalog in private vault per [external-facing-scrub.md](external-facing-scrub.md) · vault refreshed **2026-08-26** |
| Capability inspiration (INSP-*) | `docs/strategy/capability-inspiration.md` | **Have** — 2026-08-26 landscape pass; picture/rewind/FF/save-load chrome shipped the same day (not an INSP) |
| External-facing scrub policy | `docs/strategy/external-facing-scrub.md` | Have — Class A/B/C/D rules + SCRUB backlog |
| Feature build plans | `docs/strategy/features.md` | Have |
| Social lite pointer | `docs/strategy/social.md` | Have |
| Social + A/V waves | `docs/strategy/social-av.md` | Have (W16 shipped) · post-1.0 → [native-rtc.md](native-rtc.md) |
| Security suite | `docs/strategy/security.md` | Have · post-1.0 → [native-malware-scan.md](native-malware-scan.md) |
| Security + legal remediation | `docs/strategy/security-legal-playbook.md` | Have — Phases 0–6 shipped; CSP **enforces**; remaining core-clause notes are not counsel |
| Icon / image packs | `docs/strategy/icon-themes.md` | Have — Wave 2d paired packs; decade rooms at `GENERATOR_VERSION` **17** |
| Bug scrub triage | `docs/strategy/bug-triage.md` | Have |
| EmulatorJS eval | `docs/strategy/emulatorjs-eval.md` | Have |
| Emulation coverage (Wave 19) | `docs/strategy/emulation-coverage.md` | Have — play-mode matrix for every `LibraryPlatform`; SG-1000 / NGPC browser-play via shipped WASM |
| Cheats | `docs/strategy/cheats.md` | Have — `.cht` canonical; RetroArch-only surface; no scrapes |
| UI rebuild plan | `docs/strategy/ui.md` | Have |
| Product roadmap | `docs/strategy/roadmap.md` | Have |
| Feedback roadmap W22–W25 | `docs/strategy/roadmap-w22-plus.md` | Have — W22 UI rem closed; BE-DET-1…10 **Done** |
| Execution progress | `docs/strategy/progress.md` | Have — living board; diary in archive |
| Official v1 readiness | `docs/strategy/v1-readiness.md` | Have — **1.0.0-beta** ship track; GOW/LIGHT/TC-1/cmdk **shipped** |
| PM miss backlog (pre-1.0) | `docs/strategy/pm-miss-backlog.md` | Have |
| Admin hybrid inventory | `docs/strategy/admin-hybrid.md` | Have |
| Upgrade notes (0.2 → 1.0) | `docs/strategy/upgrade-notes-1.0.md` | Have |
| Game Master 1.0 domain sign-off | `docs/strategy/v1-gamemaster-signoff.md` | Have (gate 7) |
| Folder → IGDB name-resolution rules | `docs/strategy/name-resolution.md` | Have — A0–A14 · B15–B20 · BE-DET-1…10 **Done**; threshold 0.92 |
| Store metadata identify · ownership | `docs/strategy/store-metadata-identify.md` | Have — DRM register-only; no LibraryPlatform.QUEST |
| Console / emulator library layout | `docs/strategy/console-gaming-libraries.md` | Have — per-leaf libs; skip-dir; no depth-3 walker |
| Docs map (this file) | `docs/strategy/docs-map.md` | Have |
| Decision log (ADRs) | `docs/adr/NNNN-*.md` | Have — [0001 Alembic defer](../adr/0001-schema-migrations-defer-alembic.md) · [0002 api-client SPA defer](../adr/0002-defer-api-client-spa.md) · [0003 Oneirodex name](../adr/0003-product-name-oneirodex.md) (phase 1 public string landed; ops/code identifiers not started) |
| Competitive re-score template | `docs/strategy/competitor-rescore.md` | **Have** — 2026-08-26; named scores stay in `docs/_private/peer-notes/` |
| Cloud vs Unraid TCO ballpark | `docs/strategy/cloud-tco-ballpark.md` | Have — Unraid-first; worksheet in private vault |

---

## 2. User guides

| Guide | Audience | Status | Notes |
|---|---|---|---|
| Getting started (web) | End users | Have | [getting-started.md](../user/getting-started.md) |
| Library browsing & Systems | End users | Have | [library-and-systems.md](../user/library-and-systems.md) — set completeness identity lives in bar two |
| Preferences & themes / icons / fonts | End users | Have | [preferences-themes.md](../user/preferences-themes.md) — decade rooms + colour cabinets, grouped room-card picker (Jinja `group['items']`) |
| Downloading games | End users | Have | [downloads.md](../user/downloads.md) |
| Browser / companion play matrix | End users | Have | [browser-play.md](../user/browser-play.md) — full `LibraryPlatform` matrix |
| Free games (News claims) | End users | Have | [free-games.md](../user/free-games.md) |
| Social, chat & voice | End users | Have | [social-and-voice.md](../user/social-and-voice.md) |
| FAQ | End users | Have | [faq.md](../user/faq.md) — Oneirodex public string · Preferences picker · which systems play |
| Troubleshooting | End users | Have | [troubleshooting.md](../user/troubleshooting.md) — Preferences picker render crash fixed |
| Game details / freshness badges | End users | Create | Tile contract already in library-and-systems.md |
| Playing ROMs in browser | End users | Have | Covered in [browser-play.md](../user/browser-play.md) |
| Attract mode | End users | Update | Idle timeout, filters |
| Wishlist / requests | End users | Create | |
| Desktop client guide | End users | Have | [desktop-companion.md](../user/desktop-companion.md) |
| Thin client | Strategy → user | Have | [thin-client.md](thin-client.md) · user [thin-client.md](../user/thin-client.md) |
| Android APK + headset VR ladder | Strategy | Have | [android-apk-vr.md](android-apk-vr.md) · [headset-vr.md](headset-vr.md) · [controllers-and-vr.md](../user/controllers-and-vr.md) |
| Challenge / captcha bypass | Strategy → runbook | Have | profile `challenge`; CH-1…5 shipped |
| Native challenge solver (post-1.0) | Strategy | Have — backlog | [native-challenge-solver.md](native-challenge-solver.md) |
| Native household RTC (post-1.0) | Strategy | Have — backlog | [native-rtc.md](native-rtc.md) |
| Native malware scan (post-1.0) | Strategy | Have — backlog | [native-malware-scan.md](native-malware-scan.md) |
| GPU worker node (post-1.0) | Strategy | Have — backlog | [gpu-worker-node.md](gpu-worker-node.md) |
| Cover art studio | Strategy | Have | ART-1…3 shipped; ART-4 deferred |
| GOW / remote play | Strategy | Have | GOW-1/2 **shipped** |
| Mods + game servers | Strategy | Have | MOD-1/2 · SRV-1/2 APIs shipped |
| Ambient lighting | Strategy | Have | LIGHT-1/2 **shipped** |
| PM dispatch (agents) | Strategy | Archived | [archive/pm-dispatch-2026-07-27.md](archive/pm-dispatch-2026-07-27.md) |
| GitHub surface scrub (SCRUB-6b) | Strategy | Archived | [archive/github-scrub-2026-07-27.md](archive/github-scrub-2026-07-27.md) |
| Full-program review | Strategy | Archived | [archive/review-2026-08-03-findings.md](archive/review-2026-08-03-findings.md) |
| Gap review | Strategy | Archived | [archive/gap-review-2026-08-05.md](archive/gap-review-2026-08-05.md) |
| Code review | Strategy | Archived | [archive/code-review-2026-08-06.md](archive/code-review-2026-08-06.md) |
| Wave diary | Strategy | Archived | [archive/progress-waves-2026-07-08.md](archive/progress-waves-2026-07-08.md) |
| Strategy archive index | Strategy | Have | [archive/README.md](archive/README.md) |
| W28 carryover ledger | Strategy | Have | [carryover-w28.md](carryover-w28.md) |
| Request reconciliation | Strategy | Have | [request-reconciliation-2026-08-15.md](request-reconciliation-2026-08-15.md) |
| Big Picture / controller | End users | Update | Link from getting-started / social |

---

## 3. Admin guides

| Guide | Status | Notes |
|---|---|---|
| Libraries & scans | Have | [libraries-and-scans.md](../admin/libraries-and-scans.md) — merged chrome; tools tab; batch APIs; W34 catalog disagreement → Review |
| [members-and-invites.md](../admin/members-and-invites.md) | Have | Invites as links; admin-created accounts with no email |
| Themes & reset | Have | [themes-reset.md](../admin/themes-reset.md) — `GENERATOR_VERSION` **17**; UID-017 token pass (ratchet **0**) needs Reset Themes for classic CSS |
| Settings & modules | Have | [settings-modules.md](../admin/settings-modules.md) — OIDC opt-in; native Arr + Prowlarr/Jackett |
| Discover sections | Have | [discover-sections.md](../admin/discover-sections.md) |
| Theme fonts & batch artwork | Have | [theme-fonts-and-images.md](../admin/theme-fonts-and-images.md) |
| Support inbox | Have | [support-inbox.md](../admin/support-inbox.md) |
| Ops summary | Have | [ops-summary.md](../admin/ops-summary.md) — disk issues = **info** |
| Library root watch | Have | [library-root-watch-spike.md](../admin/library-root-watch-spike.md) |
| Troubleshooting | Have | [troubleshooting.md](../admin/troubleshooting.md) |
| Privacy & data handling | Have | [privacy-data-handling.md](../admin/privacy-data-handling.md) — not a public ToS |
| WebRetro core clauses | Have | [webretro-core-clauses.md](../admin/webretro-core-clauses.md) — **not counsel** |
| First-run setup wizard | Update | `gt-setup` chrome · SECRET_KEY, IGDB, SMTP · `GENERATOR_VERSION` 17 |
| Propose-only scan & proposals | Create | |
| Library Doctor & rename templates | Create | |
| Unmatched & false duplicates | Have | Covered in libraries-and-scans.md |
| Identify workbench | Have | Covered in libraries-and-scans.md + store-metadata-identify.md |
| Freshness bulk & inbox | Update | |
| Image queue / turbo downloads | Have | libraries-and-scans.md#image-queue — wash/1×1 covers replaced on download |
| Users, invites, whitelist | Update | Classic Jinja + React hubs |
| RBAC & parental controls | Update | Covered partially in security |
| Integrations hub | Have | SMTP/IGDB/community/OIDC — **no Discord** |
| Newsletter | Update | |
| Ops glance & server status | Have | `/healthz` · `/readyz`; server-status URL redirects to Ops |
| Backups & restore | Create | |
| Plugin management | Have | Includes `rtc.livekit` |
| React admin SPA migration | Update | Shell + some bodies; forms still hybrid |

---

## 4. Runbooks (ops)

| Runbook | Status | Trigger |
|---|---|---|
| [unraid-deploy.md](../runbooks/unraid-deploy.md) | Have | New Unraid container · volume sectioning |
| [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) | Have | Compose · LiveKit + ClamAV + challenge profiles |
| [install-native.md](../runbooks/install-native.md) | Have | Linux · macOS · Windows |
| [remote-scan-locations.md](../runbooks/remote-scan-locations.md) | Have | `GT_LIBRARY_ROOTS` |
| [observability-profile.md](../runbooks/observability-profile.md) | Have | Optional Prometheus stub |
| [container-wont-start.md](../runbooks/container-wont-start.md) | Have | Crash loops |
| [livekit-unraid.md](../runbooks/livekit-unraid.md) | Have | Optional voice SFU |
| [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) | Have | TRAWL profile `challenge` |
| [oidc-sso.md](../runbooks/oidc-sso.md) | Have | SSO |
| [oidc-authentik-unraid.md](../runbooks/oidc-authentik-unraid.md) | Have | Authentik on Unraid |
| [local-postgres-pytest.md](../runbooks/local-postgres-pytest.md) | Have | Docker Desktop Postgres for pytest |
| [steamgriddb-artwork.md](../runbooks/steamgriddb-artwork.md) | Have | Artwork key |
| [desktop-code-signing.md](../runbooks/desktop-code-signing.md) | Have | Unsigned-only product stance |
| [webretro-cores.md](../runbooks/webretro-cores.md) | Have | Operator-vendor WASM fetch |
| [emulator-bios.md](../runbooks/emulator-bios.md) | Have | Operator-supplied firmware; Admin scan/install + copyable missing markdown |
| [reference-sets.md](../runbooks/reference-sets.md) | Have | DAT set completeness |
| [login-rate-limit-proxy.md](../runbooks/login-rate-limit-proxy.md) | Have | Proxy + app login rate limits |
| [release-checklist.md](../runbooks/release-checklist.md) | Have | Release SOP |
| [scrub-shipped-bundles.md](../runbooks/scrub-shipped-bundles.md) | Have | SCRUB-7 before image publish |
| [workspace-disk-hygiene.md](../runbooks/workspace-disk-hygiene.md) | Have | Safe cache deletes vs KEEP webretro / `.git` |
| [`.github/workflows/ci-tests.yml`](../../.github/workflows/ci-tests.yml) | Have | PR gate: pytest core + vitest + prompt-tree check |
| `docs/runbooks/database-migrate.md` | Create | Schema / updateschema |
| `docs/runbooks/scan-stuck.md` | Create | Orphan Running jobs |
| `docs/runbooks/download-failures.md` | Create | ASGI zip / path safety |
| `docs/runbooks/enable-arr-module.md` | Create | Optional automation |

---

## 5. Developer docs

| Doc | Status |
|---|---|
| Issue assess / fix workflow | Have — [dev/issue-assess-agent.md](../dev/issue-assess-agent.md) |
| Agent skills + agents index | Have — [dev/agent-skills.md](../dev/agent-skills.md) |
| UI debt log | Have — [dev/ui-debt-log.md](../dev/ui-debt-log.md) — UID-017 token ratchet **0**; UID-018 envelope remainder **11** annotated keeps; older changelog in [dev/archive/ui-debt-changelog-2026-08.md](../dev/archive/ui-debt-changelog-2026-08.md) |
| Docs-sync skill | Have — `.cursor/skills/docs-sync/` |
| Agent locks | Have — [dev/agent-locks.md](../dev/agent-locks.md) |
| W31 commit attribution | Have — [dev/w31-commit-attribution.md](../dev/w31-commit-attribution.md) |
| UI tokens (Wave 0 / B+C) | Have — [dev/ui-wave0-tokens.md](../dev/ui-wave0-tokens.md) |
| Architecture overview | Create |
| Local dev setup | Update |
| Frontend build | Update |
| Testing guide | Update |
| OpenAPI contribution | Create |

---

## 6. Screenshots & media needed

Capture at **1920×1080** and **1280×800**; dark default + one alternate preset. Store under `docs/media/screenshots/`; sync README slots under `docs/assets/readme/` (live PNG only).

Checklist: [../assets/readme/CAPTURE.md](../assets/readme/CAPTURE.md). README **live** for hero, Library, Systems. **Capture needed:** Chat on a populated instance.

**Refresh rule:** Re-run `scripts/capture_docs_media.py` on every commit/ship pass that touches member/admin UI. Empty test-DB frames are worse than stale art.

---

## 7. Project-wide updates

| Area | Action |
|---|---|
| README | Synced for **1.0.0-beta** — Chat Capture still needed (populated instance) |
| [progress.md](progress.md) | Living board — diary archived |
| CHANGELOG | Unreleased — bump when cutting the next tag |
| `.env.example` | Includes LiveKit + SUPPORT_GITHUB_* + malware scan |
| Discord | Excised from product — do not reintroduce |

---

## 8. Suggested docs tree

```
docs/
  strategy/           # product direction
    archive/          # point-in-time reports, not current guidance
  adr/                # architecture decisions
  user/               # end-user guides + FAQ
  admin/              # admin guides
  runbooks/           # incident & deploy
  sop/                # process
  dev/                # contributor + agent workflow
  media/screenshots/
  openapi/
```

---

## 9. Open docs work

1. README Chat recapture on a **populated** instance — [CAPTURE.md](../assets/readme/CAPTURE.md)
2. Browser play platform matrix refresh
3. Remaining Create runbooks as incidents hit production
4. CHANGELOG bump when cutting the next **1.0.0-beta** (or later) tag
5. Optional dedicated game-details / freshness guide (tile contract already in library-and-systems.md)
6. Keep UI debt **open table** current — [ui-debt-log.md](../dev/ui-debt-log.md)
