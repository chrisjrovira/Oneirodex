# Security suite — GameTheca

**Date:** 2026-07-26 · **Updated:** 2026-08-25 · **Status:** active  
**Second pass (2026-08-25):** full audit + remediation Phases 0–4 shipped —
[security-legal-playbook.md](security-legal-playbook.md) carries the findings, the evidence and the
remaining phases. Summary of what changed is in [What Phases 0–4 shipped](#what-phases-04-shipped) below.  
**Related:** [social-av.md](social-av.md) · full-app review canvas · **malware (shipped):** `ENABLE_MALWARE_SCAN` + heuristics + optional ClamAV — [settings-modules.md](../admin/settings-modules.md) · **post-1.0 nice-to-have:** [native-malware-scan.md](native-malware-scan.md) (MAL-N1…N5 — native engine; ClamAV stays optional until cutover)

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

## What Phases 0–4 shipped

Full findings, evidence and the remaining phases: [security-legal-playbook.md](security-legal-playbook.md).

| ID | Was | Now |
|---|---|---|
| S1 | No security response headers at all — no `after_request` in the app | `utils/security_headers.py` — `nosniff` · `Referrer-Policy` · `X-Frame-Options` · `Permissions-Policy` on every response, plus the same baseline re-stamped in `asgi.py` for native `/static/*`, which never reaches Flask. CSP ships **report-only** (`CSP_ENFORCE=false`); HSTS only when `SESSION_COOKIE_SECURE` |
| S2 | SSRF validators were DNS-blind *and* redirect-blind | `is_blocked_outbound_host` resolves names and checks every address; alternate literals (`2130706433`, `0x7f.0.0.1`, `::ffff:127.0.0.1`) parsed; new `utils/http_safe.py` revalidates every redirect hop. Cloud metadata now blocked by resolution too, not just by literal. `ALLOW_PRIVATE_LAN_URLS` still reopens RFC1918 — pinned by test |
| S3 | `MAX_CONTENT_LENGTH` unset; the 413 handler promised a 10MB cap that could never fire | `MAX_UPLOAD_MB` (default 128, headroom over the 64MB firmware cap) · 413 handler quotes the real number and answers API callers with the envelope (`payload_too_large`) |
| S4 | Cover resize was dead code — `thumbnail()` ran, original bytes were saved | Resized image is what gets written; real byte-size check *before* decode; 60-megapixel ceiling |
| S5 | `assists.ts` interpolated server strings into `innerHTML` unescaped | Shared `clients/desktop/src/html.ts`; source-scan ratchet in `html.test.ts` covers the next one |
| S6 | API tokens never expired | `api_tokens.expires_at` — **NULL = never**, so no live companion is logged out by the upgrade; `generate_api_token(..., expires_in_days=)` opt-in |
| S7 | 3 high + 1 moderate npm advisories | `npm audit fix` — both SPAs at zero. No `package.json` change; lockfiles only |
| S8 | `next=/\evil.com` passed the `netloc != ''` check | `utils/auth.safe_next_url` — positive rule: one leading `/`, no scheme, no authority |
| S10 | Session-cookie `child` got every non-admin scope | `_SESSION_SCOPE_DENY` removes `admin` · `write:library` · `write:download` from `child` |
| S11 | `require_api_scope` returned bare `jsonify({'error': …})` | Routed through `api_error`; envelope baseline tightened 151 → 149 |

### Phases 5–6 — licensing and legal surface

| ID | Was | Now |
|---|---|---|
| L1 | 24 libretro cores committed as 71MB of binaries with no licence text and no Corresponding Source offer — while `cores/README.md` called the directory "operator-owned" and `test_webretro_cores.py` opened with "no multi-MB WASM in repo" | Untracked and gitignored; fetched at first boot by `utils/webretro_core_install.py` (`FETCH_WEBRETRO_CORES_ON_BOOT`), which stages to a temp name so an interrupted fetch cannot leave a half-core. Boot warns by name when the fetch is off and cores are absent — [webretro-cores.md](../runbooks/webretro-cores.md) |
| L2 | Eight vendored JS libraries, zero licence files — while `font_install.py` already stated the rule ("redistributing them without the licence text is not permitted") and shipped `OFL.txt` beside the faces | `static/vendor/THIRD-PARTY-NOTICES.md` with copyright lines **read out of each shipped file's own banner**, plus `scripts/fetch-vendor-licenses.sh` for canonical upstream texts. WebRetro's own licence is recorded as unconfirmed rather than guessed |
| L3 | `webretro/info/{tos,privacy,cookiepolicy,index,changelog}.html` served from every deployment — the upstream author's terms, naming a different site as "this Website operator", linking a broken `http://privacy.html`, carrying Discord links against our own non-goals | Deleted, along with the `Info` link in `standalone.html` that was the only thing pointing at them. `standalone.html` itself stays — it is the iframe `webretro.html` embeds. Stray `ddd.txt` gone; duplicate `sortablejs` 1.14.0 consolidated onto 1.15.2 |
| L4 | AGPL §13 obligation stated in README, discharged nowhere in the running app | `GT_SOURCE_URL` → member Help ("About & licence" + page footer) and the admin footer. **Configurable on purpose:** §13 obliges *this* deployment to offer *its* source, so a fork must point at its own. Rendered only when set — a dead link is worse than none |
| L5 | IGDB, Giant Bomb and SteamGridDB data surfaced with no attribution | Credited in the member Help "About & licence" section |
| S9 | `sanitize_path_for_logging`'s Windows rule matched *doubled* backslashes, which real paths do not have — so on a Windows host nothing was scrubbed | One rule covering both separators, preserving separator and casing |

**Post-deploy:** app restart for the `updateschema` `api_tokens.expires_at` column. First boot after
the upgrade fetches the WebRetro cores; browser play warms up a minute or two behind the UI.

**New env:** `CSP_ENABLED` · `CSP_ENFORCE` · `HSTS_SECONDS` · `MAX_UPLOAD_MB` · `EMULATOR_BIOS_MAX_BYTES`
(the last was read from config but never populated, so its documented override silently did nothing).

**New guards:** `tests/test_security_headers.py` (27) · `tests/test_ssrf_hardening.py` (22) ·
`tests/test_image_upload_hardening.py` (10) · `tests/test_auth_hardening.py` (36) ·
`clients/desktop/src/html.test.ts` (9) — all five in the CI core subset.

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
