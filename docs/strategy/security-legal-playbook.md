# Security & legal remediation playbook

**Date:** 2026-08-24 · **Updated:** 2026-08-26 — CSP now **enforces** by default; GOG/Epic live register sync; operator notes for snes9x / genesis_plus_gx (not counsel).
**Scope:** backend (`gametheca/`, `asgi.py`, `config.py`), four SPAs, Tauri desktop client, vendored third-party code
**Related:** [security.md](security.md) (the 2026-07-26 pass — still accurate, this extends it) ·
[external-facing-scrub.md](external-facing-scrub.md) · [../dev/agent-locks.md](../dev/agent-locks.md)

> **Method.** Static review plus `git grep` sweeps over the tracked tree for: command execution,
> deserialization, string-built SQL, path traversal, archive extraction, SSRF, CSRF, XSS sinks,
> upload handling, redirect handling, secrets, response headers, and license/attribution files.
> `npm audit` on member-app and admin-app. Every finding below cites the file and line it was
> read at. Nothing here is inferred from a doc — where a doc and the tree disagreed, the tree won,
> and that disagreement is itself recorded (L1).

---

## What is already right

Worth stating plainly, because it shapes the priorities: the expensive classes of bug are **absent**.

- **No `eval` / `exec` / `pickle` / `yaml.load`** anywhere in application Python.
- **One** `subprocess` call — [`utils/rom_archive.py:167`](../../gametheca/utils/rom_archive.py) —
  list-form, no `shell=True`.
- **No string-built SQL.** Every query goes through SQLAlchemy `select()`. The only `SELECT` literals
  are two seed rows in `updateschema.py`.
- **Theme ZIP extraction is correctly guarded.** [`utils/themes.py:64-80`](../../gametheca/utils/themes.py)
  validates every member for absolute paths, drive letters, traversal *and* non-regular entry types
  before calling `extractall`. This is the textbook fix, already applied.
- Argon2 passwords · `secrets.compare_digest` on token hashes · `SECRET_KEY` fails closed at boot ·
  session and remember-me cookies Secure/HttpOnly/SameSite by default · path ACL via `is_safe_path`
  on every ROM/download route · library ACL enforced in `asgi.py` before streaming.

The findings below are, with two exceptions, **missing outer layers** rather than broken inner ones.

---

## Security findings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **S1** | High | No HTTP security response headers at all | `gametheca/__init__.py` — no `after_request`; grep for CSP / `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / HSTS across all `*.py` returns **zero hits** |
| **S2** | High | SSRF allowlist bypassable two ways | `utils/security.py:100`, `:140` |
| **S3** | High | Request bodies are unbounded; the 413 handler promises a cap that cannot fire | `__init__.py:76-81`, `routes.py:730` |
| **S4** | Med | Cover-image resize is dead code — originals are stored | `routes.py:718-731` |
| **S5** | Med | DOM XSS in the desktop client | `clients/desktop/src/assists.ts:59` |
| **S6** | Med | API tokens never expire | `utils/api_tokens.py:122-156` |
| **S7** | Med | npm advisories in both SPAs, fixes available | `npm audit` |
| **S8** | Low | Backslash open-redirect bypass | `utils/auth.py:23-25`, `routes_login.py:236-238` |
| **S9** | Low | Windows usernames are never scrubbed from logs | `utils/security.py:93-95` |
| **S10** | Low | Session-cookie callers get near-blanket API scopes | `utils/api_tokens.py:187-196` |
| **S11** | Low | `require_api_scope` returns a bare `jsonify` envelope | `utils/api_tokens.py:206,208` |

### S1 — No security response headers

There is no `@app.after_request` in the application. The consequences compound with the rest of the
tree rather than standing alone:

- Chat attachments allow `.txt`, `.csv` and `.pdf` (`utils/chat_attachments.py:26-38`), served from
  `/static/library/chat-attachments/` with no `X-Content-Type-Options: nosniff`.
- `asgi.py:257` serves `.svg` as `image/svg+xml`, which would be same-origin scripting — but
  **no upload path accepts SVG**: covers are `jpg/jpeg/png/gif`, avatars add `webp`, emoji are
  `png/webp/jpg/jpeg`, and chat attachments are the list above. So the served SVGs are all shipped or
  generated, and this is defence-in-depth rather than a live vector. Worth stating plainly, because
  it is the difference between "fix today" and "fix in the normal pass".
- Admin is framable — no `X-Frame-Options` / `frame-ancestors`.
- `frontend/member-app/src/api/preferences.js:73` assigns a server-rendered Jinja partial straight to
  `container.innerHTML`. That is a deliberate, same-origin design choice and is *not* a finding on its
  own — but a CSP is the layer that keeps it from becoming one.

### S2 — SSRF: the validator is real, its host check is not

`validate_user_outbound_http_url` is documented "never LAN even if the homelab flag is on"
(`security.py:181`) and is used on user- and indexer-supplied URLs. Two gaps defeat it:

1. **DNS-blind.** `is_blocked_outbound_host` (`security.py:100-123`) only inspects IP *literals*.
   `http://attacker.example/` that resolves to `127.0.0.1` or `169.254.169.254` passes every check.
2. **Redirect-blind.** There is **no `allow_redirects=False` anywhere in application code** — the only
   hit in the tree is a local skill script. `requests` follows redirects by default, so a validated
   host can 302 straight to an unvalidated one. Reaches `utils/functions.py:333`,
   `utils/http_retry.py:37`, `utils/indexer_registry.py:85`, `utils/arr_connectors.py:242`,
   `routes_apis/acquire.py:120`, `routes_arr.py:282`.
3. Minor: decimal/octal literals (`http://2130706433/`) are not caught by the dotted-quad regex.

The cloud-metadata carve-out at `security.py:164-168` is correct in intent, and both bypasses go
straight around it.

### S3 — Unbounded uploads

`MAX_CONTENT_LENGTH` is never set. The 413 handler at `__init__.py:76-81` tells the user
"Maximum file size is 10MB" — Flask can never raise that 413. The one guard,
`routes.py:730` `if file.content_length > 3 * 1024 * 1024`, has two independent problems: it runs
*after* Pillow has already opened and decoded the upload, and `FileStorage.content_length` is `0`
for ordinary multipart uploads, so the branch is dead. Roughly twenty `request.files` endpoints sit
behind this.

### S4 — The resize never happens

`routes.py:718-731` calls `img.thumbnail(...)`, which mutates the local `img` object — then does
`file.seek(0)` and `file.save(save_path)`, writing the **original** bytes to disk. The thumbnail is
discarded. There is also no `Image.MAX_IMAGE_PIXELS` guard, so a decompression-bomb PNG is decoded
twice (`verify()`, then `open()`) before the size check that does not work.

### S5 — Desktop DOM XSS

`clients/desktop/src/assists.ts:59`:

```ts
root.innerHTML = `<h3>${pack.title}</h3><p class="muted">${pack.policy}</p>`
```

No `escapeHtml`, while **every** sibling call site in `app.ts` (lines 122, 200-234, 685) escapes
correctly — so this is a single missed spot, not a pattern. `pack` is server-supplied, and in Tauri
this renders in a webview with IPC reach.

### S6–S11

- **S6** — `verify_bearer_token_detailed` checks `revoked_at` only. No `expires_at`. Companion and
  thin-client tokens are permanent bearer credentials until manually revoked.
- **S7** — member-app: `react-router` ≤7.18.1 (CSRF bypass, high), `nanoid` <3.3.18 (high),
  `postcss` ≤8.5.22 (moderate, arbitrary `.map` read). admin-app: react-router + nanoid. All have
  fixes available.
- **S8** — both redirect sites reject only `urlparse(next).netloc != ''`. `next=/\evil.com` has an
  empty netloc, and browsers normalise `/\` to `//`.
- **S9** — the Windows rule `r'\\\\[Uu]sers\\\\[^\\\\]+'` matches only *doubled* backslashes, which
  real Windows paths do not contain; the other two rules are `/`-only. On this host,
  `sanitize_path_for_logging` scrubs nothing.
- **S10** — with a session cookie and no `g.api_token`, every non-admin role — **including `child`** —
  is granted every non-`admin` scope. Routes do enforce role separately, so this is defence-in-depth,
  but `require_api_scope` alone is not a gate.
- **S11** — `require_api_scope` returns bare `jsonify({'error': …})` with no `error_code`, against the
  contract in CLAUDE.md that the frontend branches on a known set.

---

## Legal findings

> Not legal advice. These are factual compliance gaps found in the tree; **L1 in particular warrants
> review by counsel** before a public release, because it turns on license interpretation rather than
> on a fact about the code.

| ID | Sev | Finding |
|---|---|---|
| **L1** | High | 24 libretro cores ship as tracked binaries with no license texts |
| **L2** | Med | Eight vendored JS libraries, no license files |
| **L3** | Med | The app serves a third party's ToS/privacy/cookie policy as if it were the operator's |
| **L4** | Med | AGPL §13 source offer is documented but not implemented in the UI |
| **L5** | Low-Med | Metadata provider attribution missing from the member SPA |
| **L6** | Watch | Challenge-solver posture needs an explicit written stance |
| **L7** | Watch | No application privacy/data-handling doc |

### L1 — Vendored emulator cores

`git ls-files gametheca/static/vendor/webretro/cores/` returns **49 tracked files** — 24 cores as
paired `_libretro.js` + `_libretro.wasm`. `find` for `LICENSE` / `COPYING` / `NOTICE` across all
**99 tracked files** under `gametheca/static/vendor/` returns **nothing**.

The cores carry mixed terms — GPL-2.0, GPL-3.0, MPL-2.0, and for at least `snes9x` and
`genesis_plus_gx`, custom clauses restricting commercial distribution. Distributing GPL binaries
requires the license text and a Corresponding Source offer to travel with them.

The sharpest part of this finding is that **the project already decided the right answer and the tree
does not match it**: `cores/README.md` describes the directory as "operator-owned", and
`scripts/fetch-webretro-cores.sh` exists precisely to populate it on the operator's machine — the same
pattern `samples/free-roms/` uses with its binaries gitignored. The cores were committed anyway.

### L2 — Vendored JS without notices

`bootstrap 5.3.2` · `chart.js 4.4.1` · `cropperjs 1.6.1` · `datatables 1.13.7` · `jquery 3.7.1` ·
`notify 0.4.2` · `sortablejs` (**1.14.0 and 1.15.2 both present**) · `webretro`. MIT and BSD both
require the copyright notice travel with the code.

### L3 — Someone else's legal agreements, served from the operator's domain

`gametheca/static/vendor/webretro/info/{tos,privacy,cookiepolicy}.html` are reachable at
`/static/vendor/webretro/info/…` on every deployment. They read *"This Policy is a legally binding
agreement between you and this Website operator"*, name `binbashbanana.github.io/webretro` as the
service, and link to a broken `http://privacy.html`. Every GameTheca operator is unknowingly
publishing a third party's terms on their own domain.

They also carry **Discord links** (`discord.gg/…`, `discord.com/users/…`), which breaks the locked
"no Discord" non-goal in [external-facing-scrub.md](external-facing-scrub.md) — so this is a stance
violation as well as a legal one. `changelog.html` additionally fetches from `cdn.jsdelivr.net` at
runtime. None of these five files are referenced by GameTheca; only `webretro.html` is
(`GameDetailsPage.jsx:219`).

### L4 — AGPL §13

README.md:407-425 states the obligation accurately. But grep for `AGPL` / `Affero` across `*.jsx` and
served templates returns **nothing** — the running application offers no source link. §13 requires
network users be offered Corresponding Source "through some standard or customary means"; a footer or
Help link is the customary form and is a small change.

### L5–L7

- **L5** — IGDB (Twitch), Giant Bomb and SteamGridDB each carry attribution requirements. "IGDB"
  appears only in admin-app strings and tests; the member SPA surfaces the data with no attribution.
- **L6** — `ENABLE_CHALLENGE_SOLVER` defaults **off** and is BYO-sidecar, which is the right default.
  It deserves an explicit written stance rather than only a default, since anti-circumvention framing
  is jurisdiction-sensitive.
- **L7** — the product handles email digests, presence, playtime telemetry and **child accounts**, and
  ships no privacy or data-handling document for operators to adapt. **Closed in W32:**
  [privacy-data-handling.md](../admin/privacy-data-handling.md) — operator-adaptable notes, not a
  public ToS.

---

## The plan

Ordered by ratio, not by severity: Phase 0 and 1 are the cheapest work with the widest blast radius,
and Phase 1 partially mitigates findings in later phases while they wait.

Each phase ends with the repo's own gates — `verify-slice`, both ratchets
(`scripts/api_envelope_lint.py`, `scripts/css-token-lint.mjs`), and a **Docs touched:** line.

| Phase | Covers | Shape of the work | Status |
|---|---|---|---|
| **0 — Dependencies** | S7 | `npm audit fix` in member-app and admin-app | **Done** — both SPAs at zero. Lockfiles only, no `package.json` change, so no breaking bumps |
| **1 — Perimeter** | S1, S3 | `after_request` in `create_app`; `MAX_CONTENT_LENGTH` set and the 413 copy made true | **Done** — `utils/security_headers.py`. Native `/static/*` never reaches Flask, so the baseline is stamped in **both** places. CSP **enforces** as of 2026-08-26 (`CSP_ENFORCE=true`); WebRetro `/static/*` has no CSP |
| **2 — SSRF** | S2 | Resolve-then-check; per-hop redirect revalidation; alternate literal forms | **Done** — `utils/http_safe.py` + `security.py`. Homelab `ALLOW_PRIVATE_LAN_URLS` pinned by test |
| **3 — Uploads & XSS** | S4, S5 | Save the resized image; pixel ceiling; real byte check; escape in `assists.ts` | **Done** — plus a source-scan ratchet so the next unescaped `innerHTML` fails the suite |
| **4 — Auth hardening** | S6, S8, S10, S11 | `expires_at`; positive `next` rule; narrow session scopes; envelope | **Done** — NULL expiry means never, so the upgrade cannot log out a live companion |
| **5 — Licensing** | L1, L2, L3 | Vendor licence notices; delete `webretro/info/**` and the stray `ddd.txt`; drop the duplicate `sortablejs`; move the cores out of the tree | **Done** — removal and first-boot fetch shipped together. `standalone.html` kept: tracing it showed `webretro.html` embeds it as the emulator iframe, so deleting it would have taken browser play with it |
| **6 — Legal surface** | L4, L5, S9 | Source-offer link on member Help + admin footer; provider attribution; fix the Windows path-scrub regex | **Done** — the source URL is `GT_SOURCE_URL`, not a constant, because §13 is about *this* deployment |

### W32 follow-through

| Item | Status |
|---|---|
| Vendor JS on member `base.html` (and admin shell) | **Done** — DataTables and Cropper.js load only on the pages that call them. jQuery stays for `$.notify` |
| WebRetro's own licence | **Done** — upstream MIT, Copyright (c) 2021 BinBashBanana; `webretro/LICENSE` + notices |
| L7 privacy/data-handling notes | **Done** — [privacy-data-handling.md](../admin/privacy-data-handling.md) |

### What Phases 0–4 cost, in case it matters later

Five new test files (104 assertions) all added to the CI core subset; one schema column; five new env
vars; the envelope ratchet tightened 151 → 149. Verification: **344 pytest passed, 0 failed** across
headers, SSRF, uploads, auth, ASGI static, envelope lint and the routes suites. Both ratchets green.

One pre-existing failure was found and **not** fixed by this work, because it is not this work:
`test_routes_styleguide.py::test_renders_every_gt_button_modifier` failed on a `gt-btn--lg`
modifier added by the in-flight UI/UX pass (present in the working tree, absent from `HEAD`). It
was handed to that pass and **is fixed there**: the styleguide now renders a `.gt-btn--lg` example
in the GT size row, opposite the Bootstrap `btn-lg` it is meant to pair with, so the coverage
contract holds again. `tests/test_routes_styleguide.py` is green at 6 passed.

A second pre-existing failure surfaced during Phase 5–6 and was likewise left alone:
`test_boot_assets.py::test_install_rejects_an_html_error_page`. Attributed rather than assumed —
`font_install.py` and the test are both unmodified vs `HEAD`, it fails in isolation so it is not
order-dependent, and `font_install` imports nothing this work touched. The module moved to
bundled-first fonts; the test still encodes the older network-only contract where an HTML error page
meant zero fonts written.

## Follow-through after the playbook

| Item | Status |
|---|---|
| **CSP enforcement** | **Closed 2026-08-26.** `CSP_ENFORCE` defaults true. Inline `<script>` and `onclick=` are gone (ratchet: `tests/test_no_inline_scripts.py`). WebRetro is native `/static/*` with baseline headers only, so Flask `script-src` is `'self'`. Set `CSP_ENFORCE=false` to report-only. `style-src` still allows `'unsafe-inline'` |
| **Non-commercial core clauses** | **Open — operator notes, not counsel.** `snes9x` and `genesis_plus_gx` restrict commercial distribution. Quotes + questions for a lawyer: [webretro-core-clauses.md](../admin/webretro-core-clauses.md). Taking them out of the tree makes the operator the provisioning party — it does not settle a commercial host |
| **DNS rebinding** | **Closed for `safe_request` callers (2026-08-26).** The hop is dialed by the address that passed the check; the original hostname is restored on `Host` / SNI. Callers that bypass `http_safe` still have the hole. Homelab `ALLOW_PRIVATE_LAN_URLS` still reaches RFC1918 — pinned by test |

### Decision taken (2026-08-25): the cores come out

**Phase 5, L1 — do the 24 core binaries stay in the tree?** Answer: **remove them, fetch on first
boot.** The two options as they stood:

- **Remove them** and let `scripts/fetch-webretro-cores.sh` populate the directory on first boot. This
  matches what `cores/README.md` already claims, matches the `samples/free-roms/` precedent, removes
  the distribution question entirely, and shrinks the repo. Cost: browser play stops working out of
  the box until an operator runs the script — a real product regression.
- **Keep them** and ship each core's license text plus a Corresponding Source offer. Preserves the
  zero-config experience. Cost: the non-commercial clauses on `snes9x` and `genesis_plus_gx` remain
  live questions for any commercial hosting, and this is where counsel is worth the hour.

Removal was chosen: it converts a licensing question into a build-step question, the fetch script
already exists, and `cores/README.md` already describes the directory that way. The cost is real and
accepted — a fresh install cannot do browser play until the fetch runs, so **Phase 5 must ship the
first-boot fetch and the removal together**, not the removal alone.

Counsel is still a human. Operator notes (quotes + questions, not advice):
[webretro-core-clauses.md](../admin/webretro-core-clauses.md).

---

## Sequencing against the UI/UX admin pass

Phases 0–4 and 6 touch backend modules, `utils/`, the desktop client and two footer components.
Phase 5 touches `static/vendor/` only. **None of them overlap the admin SPA chrome or the ~47 admin
Jinja templates** that the open UI/UX admin work is in — confirmed by the Phase 0–4 run, which
changed no admin SPA file and left the CSS ratchet untouched.

Phase 1's CSP now **enforces** (2026-08-26). Classic `onclick=` is gone; WebRetro WASM never sees
the Flask policy. `style-src 'unsafe-inline'` remains. Set `CSP_ENFORCE=false` only to report.

**Docs touched:** `docs/strategy/security-legal-playbook.md` · `docs/strategy/security.md` ·
`docs/strategy/progress.md` · `docs/strategy/docs-map.md` · `docs/README.md` ·
`docs/admin/troubleshooting.md` · `.env.example`
