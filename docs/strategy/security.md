# Security suite — GameTheca

**Date:** 2026-07-26 · **Status:** active  
**Related:** [social-av.md](social-av.md) · full-app review canvas

## Baseline (already strong)

- Path ACL via `is_safe_path` for ROM/download/images  
- Parental library ACL across member APIs  
- Flask-WTF CSRF (global) · Argon2 passwords · OIDC PKCE  
- API tokens hashed (SHA-256) · `SECRET_KEY` required at boot  
- Desktop companion API token in OS credential store (not plaintext `config.json`) — [desktop-companion.md](../user/desktop-companion.md)  
- No `eval` / `pickle` in application Python  

## Fixed in this pass (P0/P1)

| ID | Issue | Fix |
|---|---|---|
| S2 | Admin folder browser `startswith` escape | `is_safe_path` in `browse_folders_ss` |
| S3 | Newsletter `|safe` XSS | Auto-escape content |
| S4 | Arr admin `innerHTML` XSS | DOM `textContent` builders |
| S5 | Playtime game probe without ACL | `user_can_access_game` on `/api/playtime/games/<uuid>` |
| S6 | `download_image` / acquire HTTP SSRF | `validate_outbound_http_url` blocks private/metadata hosts |
| S7 | `community_chat_url` localhost | Block private hosts; `noopener` + title URL |

## Still open (track in Waves Sec-A / Sec-B)

| Sev | Item | Status |
|---|---|---|
| P1 | Arr/Ollama connector URL private-IP policy (LAN homelab flag) | **Done** — `ALLOW_PRIVATE_LAN_URLS` |
| P1 | OIDC role overwrite policy (lock after provision) | **Done** — `OIDC_LOCK_ROLES` (default true) |
| P1 | CSRF on client lifecycle POST (Bearer-only or CSRF) | **Done** — Bearer required on lifecycle POST |
| P2 | Login rate limit · export path leakage · acquire search for children · username enum | **Partial** — rate limit · O9 enum · O10 portable ES-DE/Pegasus paths shipped |

## Ongoing suite

### Unit tests (CI)

PR gate: [`.github/workflows/ci-tests.yml`](../../.github/workflows/ci-tests.yml) (core subset includes security suite). Locally:

```bash
python -m pytest tests/test_security_suite.py -q
```

Extend with:

| File | Coverage |
|---|---|
| `tests/test_security_suite.py` | Outbound URL and community URL validation |
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
4. Audit community / OIDC changes in system events
5. App-level login rate limit is on by default (`ENABLE_LOGIN_RATE_LIMIT`); still prefer proxy rate-limits in front of `/login` for multi-worker — [login-rate-limit-proxy.md](../runbooks/login-rate-limit-proxy.md)  

## Product stance

GameTheca is a **household library**, not a public SaaS. Threat model = compromised invitee, malicious indexer titles, misconfigured admin, and SSRF into the LAN. Fixes prioritize those paths without locking out legitimate Unraid `http://192.168.x.x` connectors (those need an explicit `ALLOW_PRIVATE_LAN_URLS` flag).

Support tickets may sync to GitHub via a scoped PAT (`issues:write` only). LiveKit API secrets stay server-side; browsers receive short-lived room JWTs only. Discord webhooks are not part of the product.
