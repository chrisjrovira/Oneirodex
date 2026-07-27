# Bug scrub triage — Jul 26, 2026

**Branch:** `feature/wave2-admin-fixes`  
**Pass:** polish + security + icon packs

## Fixed this scrub

| ID | Area | Fix |
|---|---|---|
| B1 | `admin_required` | Use `normalize_role()` so `Admin`/`admin` consistent |
| B2 | Discord webhook SSRF | **Obsolete** — Discord integration excised; use Support inbox + GitHub |
| B3 | Folder browser escape | `is_safe_path` (prior) |
| B4 | Newsletter / arr XSS | Escape + DOM builders (prior) |
| B5 | Playtime ACL | Game access check (prior) |
| B6 | `/playromtest` copy | Honest “use Play from details” messaging |
| B7 | Docs drift | docs-sync skill + refreshed guides (Wave 16 / support) |
| B8 | Icon vs color confusion | Icon packs orthogonal to themes |

## Open — P0 / ship blockers

| ID | Item | Owner wave |
|---|---|---|
| O1 | ~~Real WebRetro save polish / edge cores~~ | **Done** — export retries · `.srm`/`.mcr`/`.sav` · auto `_cmd_load_state` |
| O2 | Sec-B: OIDC role lock, CSRF client lifecycle | **Done** |
| O3 | ~~Admin SPA bodies still hybrid Jinja~~ | **Partial** — Users roster + live Scans status; forms still often Jinja |

## Open — P1

| ID | Item |
|---|---|
| O4 | ~~SSE for Activity (polls 30s today)~~ | **Done** — EventBus `queue.Queue` + Activity slows poll to 120s when SSE live |
| O5 | ~~Badge filter chips on library~~ | **Done** — VR / UPDATE / OUT/~ / NEW / RELEASE chips → `/browse_games` params |
| O6 | ~~Companion cheat FS write~~ | **Done** — stages `.cht` under `app_data/cheats/` via `write_file_bytes` before RetroArch launch |
| O7 | ~~Acquire LAN SSRF allow-flag for homelab~~ | **Done** — `ALLOW_PRIVATE_LAN_URLS` + connector save validation; user fetches stay strict |
| O8 | ~~Login rate limit at proxy~~ | **Done (docs)** — app limit on; proxy runbook [login-rate-limit-proxy.md](../runbooks/login-rate-limit-proxy.md) |

## Open — P2 / polish

| ID | Item |
|---|---|
| O9 | ~~Username enumeration on friend request~~ | **Done** — opaque 200 for unknown/blocked |
| O10 | ~~Export path leakage in ES-DE packs~~ | **Done** — `portable_export_path` → `<library>/…` or basename |
| O11 | ~~FA CDN residual (spin loaders only)~~ | **Done** — local `.gt-spinner` / status dots; FA CDN removed from base templates |
| O12 | ~~Theme save stores `None` for default~~ | **Done** — save `default`; UI label **Default (system)** |

## Verification

```bash
python -m pytest tests/test_security_suite.py tests/test_icon_themes.py -q
```

After deploy: Preferences → try **Filled** + any color theme; pack CSS should swap live in the modal, and accents stay on the color theme only.
