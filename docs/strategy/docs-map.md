# Documentation map (runbooks, SOPs, assets)

**Date:** 2026-07-26 · **Product version:** 0.1.0  
**Purpose:** List everything the project needs across docs, ops, and communications as GameTheca grows toward peer parity.

**Program board (Jul 26):** Cursor canvas  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`  
Tracks Art / Docs / Admin SPA. Jul 25 handoff is superseded for planning.

## Status legend

- **Have** — exists in repo today (may need refresh)  
- **Update** — exists but stale / rebrand incomplete  
- **Create** — net-new  

---

## 1. Strategy & product

| Document | Path | Status |
|---|---|---|
| Competitive gap analysis | `docs/strategy/competitive.md` | Have |
| Feature build plans | `docs/strategy/features.md` | Have |
| Social / Discord alternatives | `docs/strategy/social.md` | Have |
| EmulatorJS eval | `docs/strategy/emulatorjs-eval.md` | Have |
| UI rebuild plan | `docs/strategy/ui.md` | Have |
| Product roadmap | `docs/strategy/roadmap.md` | Have |
| Execution progress | `docs/strategy/progress.md` | Have |
| Docs map (this file) | `docs/strategy/docs-map.md` | Have |
| Decision log (ADRs) | `docs/adr/NNNN-*.md` | Create |
| Competitive re-score template | `docs/strategy/competitor-rescore.md` | Create |

---

## 2. User guides

| Guide | Audience | Status | Notes |
|---|---|---|---|
| Getting started (web) | End users | Have | [getting-started.md](../user/getting-started.md) |
| Library browsing & Systems | End users | Have | [library-and-systems.md](../user/library-and-systems.md) |
| Preferences & themes | End users | Have | [preferences-themes.md](../user/preferences-themes.md) |
| Downloading games | End users | Have | [downloads.md](../user/downloads.md) |
| Game details, favorites, status | End users | Create | Include freshness badges |
| Playing ROMs in browser | End users | Update | Platform matrix + known broken cores |
| Attract mode | End users | Update | Idle timeout, filters |
| Wishlist / requests | End users | Create | After P1-10 polish |
| Desktop client guide | End users | Create | After companion client |
| Big Picture / controller mode | End users | Create | After Wave 4 |
| FAQ / troubleshooting (user) | End users | Create | Downloads, login, themes |

---

## 3. Admin guides

| Guide | Status | Notes |
|---|---|---|
| Libraries & scans | Have | [libraries-and-scans.md](../admin/libraries-and-scans.md) |
| Themes & reset | Have | [themes-reset.md](../admin/themes-reset.md) |
| Settings & modules | Have | [settings-modules.md](../admin/settings-modules.md) |
| First-run setup wizard | Update | SECRET_KEY, IGDB, SMTP |
| Propose-only scan & proposals | Create | Sidecar JSON lifecycle |
| Library Doctor & rename templates | Create | Dry-run → apply |
| Unmatched & false duplicates | Update | Reclassify flow |
| Identify workbench (IGDB/Steam/GOG/RAWG) | Update | Multi-scanner |
| Freshness bulk & inbox | Update | Rate limits |
| Image queue / turbo downloads | Update | |
| Users, invites, whitelist | Update | |
| RBAC & parental controls | Create | After P0-3 |
| Integrations hub | Update | IGDB/Discord/SMTP/HLTB/OIDC |
| Newsletter | Update | |
| Ops glance & server status | Update | |
| Backups & restore | Create | Postgres + library volume |
| Plugin management | Create | After P0-7 |
| React admin SPA migration | Create | Program Wave 3 |

---

## 4. Runbooks (ops)

| Runbook | Status | Trigger |
|---|---|---|
| [unraid-deploy.md](../runbooks/unraid-deploy.md) | Have | New Unraid container |
| [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) | Have | Compose install |
| [container-wont-start.md](../runbooks/container-wont-start.md) | Have | Crash loops (SECRET_KEY, bash, DB) |
| `docs/runbooks/database-migrate.md` | Create | Schema / updateschema |
| `docs/runbooks/library-volume-reset-themes.md` | Create | Missing presets / stale JS — see also admin themes guide |
| `docs/runbooks/scan-stuck.md` | Create | Orphan Running jobs |
| `docs/runbooks/download-failures.md` | Create | ASGI zip / path safety |
| `docs/runbooks/igdb-outage.md` | Create | Provider down |
| `docs/runbooks/disk-full.md` | Create | Images/zips growth |
| `docs/runbooks/restore-from-backup.md` | Create | Disaster recovery |
| `docs/runbooks/rotate-secret-key.md` | Create | Credential rotation |
| [oidc-sso.md](../runbooks/oidc-sso.md) | Have | SSO |
| [oidc-authentik-unraid.md](../runbooks/oidc-authentik-unraid.md) | Have | Authentik on Unraid |
| `docs/runbooks/enable-arr-module.md` | Create | Optional automation |

---

## 5. SOPs (process — Create)

| SOP | Owner |
|---|---|
| Release checklist (version bump, changelog, Docker tag, Unraid note) | Maintainers — [runbooks/release-checklist.md](../runbooks/release-checklist.md) |
| Security review before public release | Maintainers |
| Adding a metadata provider plugin | Contributors |
| Triaging unmatched false positives | Admins |
| Accepting user game requests | Admins |
| Content policy (DRM-free ownership stance) | Project |
| Incident response (data leak / webhook abuse) | Maintainers |
| Screenshot refresh before each minor release | Docs |

---

## 6. Developer docs (Update / Create)

| Doc | Status |
|---|---|
| Architecture overview (Flask + ASGI + React islands) | Create |
| Local dev setup (Windows/Linux) | Update |
| Frontend build (`member-app`, `ops-glance`) | Update |
| UI tokens (Wave 0 / B+C) | Have — [dev/ui-wave0-tokens.md](../dev/ui-wave0-tokens.md) |
| Testing guide (pytest + Vitest) | Update |
| OpenAPI contribution rules | Create |
| Theme authoring guide | Update (exists as admin readme) |
| Coding conventions / no-inline-imports | Create |
| Migration guide gametheca → GameTheca | Update |

---

## 7. Screenshots & media needed

Capture at **1920×1080** and **1280×800**; dark default theme + one alternate preset.

| Shot ID | Scene |
|---|---|
| S01 | Login |
| S02 | Library grid with filters |
| S02b | Systems hub |
| S03 | Discover shelves |
| S04 | Game details (path + freshness + download) |
| S05 | Random trailers |
| S06 | Attract mode |
| S07 | Downloads history |
| S08 | Admin ops glance |
| S09 | Scan management running |
| S10 | Unmatched / proposals |
| S11 | Identify multi-scanner |
| S12 | Library tools freshness |
| S13 | Theme picker (swatches) |
| S14 | Integrations / settings modules |
| S15 | Desktop client (when ready) |
| S16 | Big Picture mode (when ready) |

Store under `docs/media/screenshots/` with `manifest.json` mapping shot → guide sections.

---

## 8. Project-wide updates still needed

| Area | Action |
|---|---|
| README | Align feature list with roadmap; Unraid SECRET_KEY + bash notes; link strategy docs |
| CHANGELOG | Keep user-facing; link milestone IDs |
| `.env.example` / `.env.docker.example` | Keep SECRET_KEY empty/required |
| Unraid Community App template (if published) | Env vars, volume paths, support URL |
| Docker Hub / GHCR description | Rebrand GameTheca |
| Discord/support templates | Point to runbooks |
| In-app Help (`/help`) | Replace stale sidebar copy with links to user/admin guides |
| API docs site | After OpenAPI |
| Privacy / ToS stubs | If public demo hosted |
| License clarity | Especially if plugins or client ship separately |
| Localization files | After i18n work |
| Demo instance script | Seed library for screenshots |

---

## 9. Suggested docs tree

```
docs/
  strategy/           # product direction (this pack)
  adr/                # architecture decisions
  user/               # end-user guides
  admin/              # admin guides
  runbooks/           # incident & deploy
  sop/                # process
  dev/                # contributor
  media/screenshots/
  openapi/            # when generated
  superpowers/        # specs, plans, handoffs
```

---

## 10. Immediate next documentation sprint

1. Fix in-app HelpPage (stale LHN copy)  
2. Capture S01–S14 screenshots on a demo library  
3. Admin SPA migration notes when Wave 3a lands  
4. Remaining Create runbooks as incidents hit production
