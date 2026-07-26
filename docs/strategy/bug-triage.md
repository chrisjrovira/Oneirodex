# Bug scrub triage — Jul 26, 2026

**Branch:** `feature/wave2-admin-fixes`  
**Pass:** polish + security + icon packs

## Fixed this scrub

| ID | Area | Fix |
|---|---|---|
| B1 | `admin_required` | Use `normalize_role()` so `Admin`/`admin` consistent |
| B2 | Discord webhook SSRF | Hostname allowlist (prior commit) |
| B3 | Folder browser escape | `is_safe_path` (prior) |
| B4 | Newsletter / arr XSS | Escape + DOM builders (prior) |
| B5 | Playtime ACL | Game access check (prior) |
| B6 | `/playromtest` copy | Honest “use Play from details” messaging |
| B7 | Docs drift | competitive / progress / social claims refreshed |
| B8 | Icon vs color confusion | Icon packs orthogonal to themes |

## Open — P0 / ship blockers

| ID | Item | Owner wave |
|---|---|---|
| O1 | Real WebRetro save polish / edge cores | W12 follow-up |
| O2 | Sec-B: OIDC role lock, CSRF client lifecycle | Sec-B |
| O3 | Admin SPA bodies still hybrid Jinja | Polish |

## Open — P1

| ID | Item |
|---|---|
| O4 | SSE for Activity (polls 30s today) |
| O5 | Badge filter chips on library |
| O6 | Companion cheat FS write |
| O7 | Acquire LAN SSRF allow-flag for homelab |
| O8 | Login rate limit at proxy |

## Open — P2 / polish

| ID | Item |
|---|---|
| O9 | Username enumeration on friend request |
| O10 | Export path leakage in ES-DE packs |
| O11 | FA CDN residual (spin loaders only) |
| O12 | Theme save stores `None` for default (works; clarify) |

## Verification

```bash
python -m pytest tests/test_security_suite.py tests/test_icon_themes.py -q
```

After deploy: Preferences → try **Filled** + any color theme; pack CSS should swap live in the modal, and accents stay on the color theme only.
