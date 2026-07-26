# Security suite — GameTheca

**Date:** 2026-07-26 · **Status:** active  
**Related:** [social-av.md](social-av.md) · full-app review canvas

## Baseline (already strong)

- Path ACL via `is_safe_path` for ROM/download/images  
- Parental library ACL across member APIs  
- Flask-WTF CSRF (global) · Argon2 passwords · OIDC PKCE  
- API tokens hashed (SHA-256) · `SECRET_KEY` required at boot  
- No `eval` / `pickle` in application Python  

## Fixed in this pass (P0/P1)

| ID | Issue | Fix |
|---|---|---|
| S1 | Discord webhook substring bypass → SSRF | `is_discord_webhook_url` hostname + path; validate on save **and** send |
| S2 | Admin folder browser `startswith` escape | `is_safe_path` in `browse_folders_ss` |
| S3 | Newsletter `|safe` XSS | Auto-escape content |
| S4 | Arr admin `innerHTML` XSS | DOM `textContent` builders |
| S5 | Playtime game probe without ACL | `user_can_access_game` on `/api/playtime/games/<uuid>` |
| S6 | `download_image` / acquire HTTP SSRF | `validate_outbound_http_url` blocks private/metadata hosts |
| S7 | `community_chat_url` localhost | Block private hosts; `noopener` + title URL |

## Still open (track in Waves Sec-A / Sec-B)

| Sev | Item |
|---|---|
| P1 | Arr/Ollama connector URL private-IP policy (LAN homelab flag) |
| P1 | OIDC role overwrite policy (lock after provision) |
| P1 | CSRF on client lifecycle POST (Bearer-only or CSRF) |
| P2 | Login rate limit · export path leakage · acquire search for children · username enum |

## Ongoing suite

### Unit tests (CI)

```bash
python -m pytest tests/test_security_suite.py -q
```

Extend with:

| File | Coverage |
|---|---|
| `tests/test_security_suite.py` | Webhooks, outbound URL, community URL |
| `tests/test_security_path_browse.py` | Folder browser escape (needs app + temp dirs) |
| `tests/test_security_acl_playtime.py` | Child denied blocked game playtime |
| `tests/test_security_social.py` | Friend accept authZ |

### Static analysis (run locally / CI when added)

```bash
pip install bandit pip-audit
bandit -r gametheca -ll -x gametheca/static/vendor
pip-audit -r requirements.txt
```

### Ops checklist before public ship

1. TLS reverse proxy · `SESSION_COOKIE_SECURE=true` · strong `SECRET_KEY`  
2. Non-default Postgres password · games volume `:ro`  
3. Isolate Prowlarr/qBit/NZBGet from cloud metadata endpoints  
4. Audit Discord / community / OIDC changes in system events  
5. Rate-limit `/login` at the proxy  

## Product stance

GameTheca is a **household library**, not a public SaaS. Threat model = compromised invitee, malicious indexer titles, misconfigured admin, and SSRF into the LAN. Fixes prioritize those paths without locking out legitimate Unraid `http://192.168.x.x` connectors (those need an explicit “allow private LAN” flag in Sec-B).
