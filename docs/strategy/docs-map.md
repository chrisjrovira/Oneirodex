# Documentation map (runbooks, SOPs, assets)

**Date:** 2026-07-24 · **Product version:** 0.1.0  
**Purpose:** List everything the project needs across docs, ops, and communications as GameTheca grows toward peer parity.

## Status legend

- **Have** — exists in repo today (may need refresh)  
- **Update** — exists but stale / rebrand incomplete  
- **Create** — net-new  

---

## 1. Strategy & product (Create — seeded this session)

| Document | Path | Status |
|---|---|---|
| Competitive gap analysis | `docs/strategy/competitive.md` | Create ✓ |
| Feature build plans | `docs/strategy/features.md` | Create ✓ |
| UI rebuild plan | `docs/strategy/ui.md` | Create ✓ |
| Product roadmap | `docs/strategy/roadmap.md` | Create ✓ |
| Docs map (this file) | `docs/strategy/docs-map.md` | Have ✓ |
| Decision log (ADRs) | `docs/adr/NNNN-*.md` | Create |
| Competitive re-score template | `docs/strategy/competitor-rescore.md` | Create |

---

## 2. User guides (mix of Update / Create)

| Guide | Audience | Status | Notes |
|---|---|---|---|
| Getting started (web) | End users | Update | From README; split out |
| Library browsing & filters | End users | Create | Screenshots of React grid |
| Game details, favorites, status | End users | Create | Include freshness badges |
| Downloading games & updates/extras | End users | Update | Streaming zip behavior |
| Playing ROMs in browser | End users | Update | Platform matrix + known broken cores |
| Attract mode | End users | Update | Idle timeout, filters |
| Preferences & themes | End users | Update | 10 presets with swatches |
| Wishlist / requests | End users | Create | After P1-10 |
| Desktop client guide | End users | Create | After companion client |
| Big Picture / controller mode | End users | Create | After Wave 4 |
| FAQ / troubleshooting (user) | End users | Create | Downloads, login, themes |

---

## 3. Admin guides (Update / Create)

| Guide | Status | Notes |
|---|---|---|
| First-run setup wizard | Update | SECRET_KEY, IGDB, SMTP |
| Libraries & scan depth | Update | Letter buckets, refresh all, schedule |
| Propose-only scan & proposals | Create | Sidecar JSON lifecycle |
| Library Doctor & rename templates | Create | Dry-run → apply |
| Unmatched & false duplicates | Update | Reclassify flow |
| Identify workbench (IGDB/Steam/GOG/RAWG) | Update | Multi-scanner |
| Freshness bulk & inbox | Update | Rate limits |
| Image queue / turbo downloads | Update | |
| Users, invites, whitelist | Update | |
| RBAC & parental controls | Create | After P0-3 |
| Integrations hub | Update | IGDB/Discord/SMTP/HLTB/OIDC |
| Themes admin & reset | Update | Volume sync behavior |
| Newsletter | Update | |
| Ops glance & server status | Update | |
| Backups & restore | Create | Postgres + library volume |
| Plugin management | Create | After P0-7 |

---

## 4. Runbooks (ops — Create)

| Runbook | Trigger |
|---|---|
| `docs/runbooks/unraid-deploy.md` | New Unraid container |
| `docs/runbooks/docker-compose-deploy.md` | Compose install |
| `docs/runbooks/container-wont-start.md` | Crash loops (SECRET_KEY, bash, DB) |
| `docs/runbooks/database-migrate.md` | Schema / updateschema |
| `docs/runbooks/library-volume-reset-themes.md` | Missing presets / stale JS |
| `docs/runbooks/scan-stuck.md` | Orphan Running jobs |
| `docs/runbooks/download-failures.md` | ASGI zip / path safety |
| `docs/runbooks/igdb-outage.md` | Provider down |
| `docs/runbooks/disk-full.md` | Images/zips growth |
| `docs/runbooks/restore-from-backup.md` | Disaster recovery |
| `docs/runbooks/rotate-secret-key.md` | Credential rotation |
| `docs/runbooks/enable-oidc.md` | After SSO ships |
| `docs/runbooks/enable-arr-module.md` | Optional automation |

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
| Frontend build (`library-grid`, `ops-glance`) | Update |
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
| S13 | Theme picker (10 swatches) |
| S14 | Integrations |
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
| In-app Help (`/admin/help`, `/site/help`) | Replace with links to user/admin guides |
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
```

---

## 10. Immediate next documentation sprint (1–2 weeks)

1. Split README into Getting Started + link strategy pack  
2. Write Unraid + container-wont-start runbooks  
3. Admin guide: scan / propose-only / doctor  
4. User guide: download + freshness badges  
5. Capture S01–S14 screenshots on a demo library  
6. Refresh in-app Help pages to point at docs
