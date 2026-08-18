# Changelog

All notable changes to GameTheca are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-07-24

First milestone release on the `feature/roadmap-q1-foundation` track (GameTheca rebrand + gap close).

### Added

- GameTheca package cutover (`gametheca/`), Docker image `chrisjrovira/gametheca`
- Optional *arr module (Prowlarr/Jackett + qBittorrent) and **arr→hardlink** pipeline (triple-gated)
- Release calendar, quality profiles, GiantBomb/PCGW providers
- Detail-page layout editor (order/visibility)
- Ollama AI assist + gated **auto-apply** rename (`ENABLE_AI_AUTO_APPLY`)
- Hardlink preview/apply helpers
- VR / Quest **PWA** browse at `/vr`
- OIDC / Authentik SSO (optional; local username/password always works)
- Desktop companion (Tauri) + signing runbook/CI hooks (later: unsigned-only product stance)
- Emulator save sync options, deeper en/es i18n, SVG playtime share cards
- Strategy docs, runbooks, OpenAPI artifact under `docs/`

### Changed

- Docker Compose now passes optional module flags (AI, VR, arr, OIDC, hardlinks)
- Setup and Integrations copy clarify that Authentik is optional for local installs

### Security / ops

- Hardlink and AI apply remain feature-flagged and path-sandboxed
- `SECRET_KEY` required; container refuses the placeholder

## [1.0.0-beta] — 2026-08-06

First beta of the 1.0 line. Everything previously tracked as *Unreleased* is
part of this release; the version was also unified — `VERSION`, `app_version`,
both SPA packages, the desktop client, the Compose image tag and the OpenAPI
contract had drifted across `0.1.0` and `0.2.0` and now all read `1.0.0-beta`.

> The desktop `tauri.conf.json` carries plain `1.0.0`: the Windows MSI installer
> requires a three-part numeric version and rejects a prerelease suffix.

### Breaking

- **`DATA_FOLDER_WAREZ` removed.** The deprecated alias, its `config.py` fallback, and a **live Compose volume fallback** are all gone; only `DATA_FOLDER_GAMES` is read. A deploy whose `.env` still sets only the old key will start with **nothing mounted at `/storage`** — rename the key before redeploying. Also dropped from `.env.example`, `.env.docker.example`, `.env.unraid.example`, and `install-linux.sh`.

### Security

- **Chat @mention fan-out leaked DM content to non-members.** The mention notifier matched *any* user whose name appeared in a message and skipped only those who were muted **members**, so a non-member matching the name was notified with the message body — including in DMs they had no access to. Membership is now required before a mention notification is sent.
- **LiveKit room authorization was name-shaped, not access-checked.** `user_may_join_room` only inspected the room-name string, so any authenticated user could mint a token for any room — including `household:party:<game-uuid>` rooms, whose UUIDs are visible in game-details URLs. Every room name now resolves to a real access check (`voice:<id>` → space membership · `household:party:<uuid>` → game access · `household:lobby` → non-child), and **anything unrecognised is denied** rather than allowed through.

### Added

- **Health probes** — unauthenticated `GET /healthz` (liveness) and `GET /readyz` (DB + startup init); Compose `healthcheck` uses `/readyz` instead of `/` — [docker-compose-deploy.md](docs/runbooks/docker-compose-deploy.md)
- **Ops services pulse** — Admin Ops summary includes LiveKit, malware/ClamAV, companion heartbeats, and scan/download queues — contract: [ops-summary.md](docs/admin/ops-summary.md)
- **Observability stub** — commented Compose `# profile: observability` + [observability-profile.md](docs/runbooks/observability-profile.md) (Prometheus not required)
- **CI test gate** — `.github/workflows/ci-tests.yml` (pytest core + member-app vitest)
- **Library grid virtualization** — `@tanstack/react-virtual` in member-app `GameGrid`
- **Command palette** — member SPA Ctrl/Cmd+K (`cmdk`) for nav + Preferences
- **Desktop secure token store** — Windows Credential Manager / OS keyring via Tauri (`keychain`); scrub plaintext token from `config.json`
- **External-facing scrub** — Class A docs/UI placeholders neutralized; GitHub PR/Issue templates (SCRUB-6); competitive catalog private vault
- **Icon packs** (Outline, Filled, Duotone, Pixel, Soft, Mono) — orthogonal to color themes; Preferences chips + `data-icon-pack` CSS; see `docs/strategy/icon-themes.md`
- Lite social (friends, Activity poll) + community chat URL; WebRetro save/cheat bridge; NZBGet in Acquire
- Security suite P0/P1 hardening + `tests/test_security_suite.py`
- **Wave 14–17 social:** presence, Activity SSE, profiles, notifications, DMs, household channels, @mentions, mute, reactions, search, threads, custom emoji (max 20), LiveKit voice lobby + spectator
- **Friends companion:** stay-open dock · `/social-companion` pop-out · Big Picture **Y** · desktop always-on-top friends window
- **Sec-B:** `ALLOW_PRIVATE_LAN_URLS`, `OIDC_LOCK_ROLES`, Bearer-only client lifecycle POST
- **Admin Users SPA** roster at `/admin/users` (classic editor `/admin/manage_users`); live Scans status polling; **Admin → Features** toggles (setup + ops)
- **Malware scan** (`ENABLE_MALWARE_SCAN`, ClamAV + heuristics) — default on when configured
- **Multi-region set completeness** chips via `set_completion_regions` on Systems
- ROM language / translation-patch hooks · free-games News shelf · WebRetro save polish
- Proxy login rate-limit runbook — `docs/runbooks/login-rate-limit-proxy.md`
- **Legal free sample ROMs** — `samples/free-roms/` + `scripts/fetch-free-roms.py` (NES/GB/GBA/Genesis/Atari 2600)
- **Docs media capture** — Playwright recipe `scripts/capture_docs_media.py` · screenshots + `docs/media/video/product-tour.webm` — [CAPTURE.md](docs/assets/readme/CAPTURE.md)
- **W23 — Spaces (servers with their own channels)** — `ChatSpace` / `ChatSpaceMember` / `ChatSpaceInvite`; `household` (everyone) vs `invite` (scoped, genuinely invisible to non-members) visibility; text **and** voice channels per space; invite codes with revoke; space rail UI — [social-and-voice.md](docs/user/social-and-voice.md#spaces-servers-with-their-own-channels)
- **W25 — Storefront Discover** — `curated_for_you` (unplayed titles in genres the member favourites, excluding what they already picked) and `upcoming` (release dates still ahead, reusing Calendar data — no new scraping) shelves; `hero` / `carousel` / `shelf` layouts; **shelves as scheduled events** via `starts_at` / `ends_at`; admin schedule API. Curation uses on-box signals only — no external recommender, nothing leaving the box. Empty shelves hide rather than pad — [discover-sections.md](docs/admin/discover-sections.md)
- **Related media on a game** — adaptations, tie-ins, novelisations, documentaries, soundtracks as a popup **before** screenshots and trailers. Context, not a tracker: no watched/progress/rating fields exist on the model, and download-shaped links are refused — [library-and-systems.md](docs/user/library-and-systems.md#related-media)
- **Theme fonts** — era-appropriate faces (8-bit · compact pixel · arcade · 32-bit/disc · CRT terminal) mapped per system by **era, not brand**; admin upload with extension allowlist, size cap, and magic-byte validation; operator drop-ins offered beside the built-ins. Manufacturer typefaces are **not** shipped, and the OFL font files are operator-supplied — `installed: false` is reported honestly so a picker can say so — [theme-fonts-and-images.md](docs/admin/theme-fonts-and-images.md)
- **Batch artwork upload** — drop a folder of prepared art; files match games by `<uuid>` or `<uuid>_<kind>`; per-file outcomes reported so one bad file cannot sink the batch
- **FEAT-D1 scan freshness** — check version / updates / DLC after a scan; **off by default** (`SCAN_CHECK_FRESHNESS`) because each check is outbound store traffic, capped by `SCAN_FRESHNESS_LIMIT` (50)
- **FEAT-D2 PC cheat notes** — notes, not a trainer: console command / config edit / save field / launch flag / note. Never writes a game binary, never injects into a process
- **FEAT-D3 generated cover art** — self-hosted A1111-compatible endpoint (AUTOMATIC1111 / SD.Next / Forge); **off by default**, nothing leaves your network; regenerating replaces only the previous *generated* image so hand-picked art is never clobbered; `comfyui` engine raises an honest "not implemented" rather than silently doing nothing
- **FEAT-D5 play rooms** — per-system rooms grouped by **setting** (CRT living room · arcade cabinet · handheld · disc era · desk) rather than by brand
- **FEAT-D6** — seamless free-game claim when a store is linked
- **Emulator BIOS manifest + runbook** — [emulator-bios.md](docs/runbooks/emulator-bios.md)
- 15 missing console platforms added to `LibraryPlatform` (now 72)
- **Sortable admin tables** (`DataTable`) — asc → desc → clear, numeric-aware, nulls last in both directions, never mutates the caller's array

### Changed

- **BE-DET-9 Fandom alias registry** — Soft alias · series · remaster · regional EN↔JP · soft-title adjacency expand search variants + proposal ranking · propose-first soft paths · hard auto-identify ≥**0.92** · **QA PASS 65/65** · fixture pack 50 soft · capability language only (no Class A lists in public docs) — [name-resolution.md](docs/strategy/name-resolution.md)
- **BE-DET-8 Arcade / Neo Geo AES** — Set-folder peel (dump or MAME/FBNeo set basename) · propose-first on large ARCADE / compact set names · AES≠CD TGDB hard guard · threshold **0.92** · **QA PASS 141/141** (peel+Stage E) · be_det8 **14/14** — [name-resolution.md](docs/strategy/name-resolution.md) · [libraries-and-scans.md](docs/admin/libraries-and-scans.md)
- **UID-004 Search name** — Admin Dupe glance + Unmatched operator label **Amend naming** → **Search name** (labels · tooltips · toasts); Kind Soft title/Utility intact — [libraries-and-scans.md](docs/admin/libraries-and-scans.md#unmatched-folders)
- **UID-016 Dupe side-by-side Compare** — Admin Dupe glance + Unmatched show This folder | Library game columns (path · size · date); soft-read UI + Backend null-safe `size_bytes`/mtime on list/`matched_game` (library from Game; folder size null until denorm) — [libraries-and-scans.md](docs/admin/libraries-and-scans.md#unmatched-folders)
- **Desktop distribution — unsigned only** — Windows code-signing certs will never be pursued; CI no longer has an optional `signtool` step — [desktop-code-signing.md](docs/runbooks/desktop-code-signing.md)
- Pin `requirements.txt` with `==` versions for reproducible 1.0 builds; Compose local image tag `gametheca:0.2.0` (matches `app_version`)
- **OpenAPI / semver hygiene** — `docs/openapi/openapi.json` `info.version` **0.2.0** aligned with `app_version` / Compose image tag
- **Default `UVICORN_WORKERS=1`** in Docker (`startweb-docker.sh`, Compose, `.env*.example`); override to 2+ still allowed
- **Two-bar chrome (UIR).** One `AppBar` for identity and destinations, one `ContextBar` under it for what the current page can do. Page titles and ledes retire under `data-chrome="v2"` — a heading that says "Library" while you are looking at the library is the least useful pixel on the page — and header *actions* stay put until each page moves them in. Library, News, Notifications and Calendar have moved: their hand-rolled tab strips are now bar two's segmented control, and Calendar's two window selects are a badged popover. Admin's Jinja renders the same bars from the same stylesheet, pinned by `tests/test_chrome_parity.py`, because the two SPA builds cannot import from each other. Behind `ENABLE_NEW_CHROME` until every page has adopted it — [ui-refresh-2026-08-06.md](docs/strategy/ui-refresh-2026-08-06.md)
- **Member SPA rebrand (wave 1):** browse routes (Discover, Library, Favorites, Downloads) serve a React Router shell from `frontend/member-app` (`member-app.js`), with GameTheca top nav, design tokens, and Docker multi-stage build of `/static/dist/member-app/`
- Docs: progress, bug triage, preferences/themes, security, social-av plans; Discord/webhook promises excised; peer catalogs kept private
- Mobile density: FilterBar + PaginationBar + Chat touch targets ≤900px
- WebRetro cloud saves: export retries, `.mcr`/`.sav` pick, auto `_cmd_load_state` when available
- Tile size: continuous 0–100% slider (legacy S/M/L/XL mapped)

### Fixed

- **Steam metadata was never mapped onto games.** `storesearch` hardcoded `summary=None`, `appdetails` dropped genres / developer / publisher / release date, and Stage D called no enrichment at all — so a Steam-identified import arrived with empty checkboxes and no summary. Added a single mapper with fill-don't-clobber semantics plus a backfill endpoint for rows already imported.
- **The scan path still asked Steam and nothing else.** The multi-source cascade shipped wired into store/software identify and the repair endpoint, but the ordinary IGDB scan — how nearly every title arrives — kept calling the Steam-only enricher. Steam has no SNES ROM, so console libraries scanned in blank exactly as before. `enrich_game_all_sources` now runs the Steam pass only for PC-family platforms and continues through GOG/Epic/itch/Giant Bomb/MobyGames/RAWG/TheGamesDB while `summary`, `genres` or `developer` are still empty. The cascade gained a `skip` argument so Steam is not queried twice per title (also applied to the two older callers, which both hydrated by App ID and then re-searched Steam by name).
- **Emulated audio ran fast and glitchy.** `audio_max_timing_skew` was `0.15` — three times the usual `0.05` — with no `audio_sync`, so audio chased the browser's 60Hz vsync against NTSC's 60.098Hz and was repeatedly yanked back. Now `audio_sync` + `audio_rate_control` with a 0.005 delta and standard skew — [browser-play.md](docs/user/browser-play.md#audiovideo-tuning--wasm-limits-snes-and-friends)
- **`chat_spaces` migration omitted `created_at`** and so silently no-op'd its own Household adoption step (`updateschema.py` swallows per-statement errors)
- **BE-DET-10 image kinds:** 6 of the 8 kinds had no UI surface at all
- Tile control stack, badge corner clearance, overflow-*measured* "Show more" (was a 420-char guess against an 8-line CSS clamp), and page-size handling
- Cover title legibility (FEAT-D4): minimum title size floor raised from 14px, plus editable headline / subtitle and a clamped `title_scale`
- Setup wizard mid-flow redirect: step map includes Features (3) + IGDB (4); `/setup` no longer claims “already completed” while wizard is in progress
- `InitManager` back-compat alias for `InitializationManager` (setup seed helpers)
- Admin Features template extends `base_admin.html`; Integrations community chat POST route restored (`admin2.community_chat_settings`)
- Admin SPA `hasLegacyBody` detects `.gt-admin-card` so Features Jinja is not pushed below an empty React hub
- `admin_required` role normalization; honest `/playromtest` messaging
- Docker Compose forces `DATABASE_URL` host `db` (stops Unraid `.env` `@localhost` loops)
- Entrypoint rewrites loopback DB URLs inside containers
- Local image tag `gametheca:0.2.0` (matches `app_version`; no Docker Hub pull required for local compose)
- Env examples / NAS deploy docs clarified for Compose vs native installs

### Removed

- Discord webhook / bot integration (use Support inbox + in-app admin alerts)

### Emulation honesty

- **Browser vs companion** — in-browser Play only for systems with present WebRetro cores; heavy systems (GC/Wii/Dreamcast/3DS/PS2/Vita) are companion-preferred — no fake Play-in-browser CTA.
- **Deferred WASM** — PCE / Commodore / DOS browser unlock is discover-on-disk / operator-vendored, not a claim that every core ships in the image.
- **No scrape** — no romhacking.net (or similar) scrape; reference DATs are operator-uploaded; DRM storefronts stay ownership register-only.

### Still operator-owned

- Live Authentik smoke (operator secrets) — OIDC stays **opt-in** (`OIDC_ENABLED` off by default)
- Native Quest APK (PWA MVP ships in 0.1.0)
- Publish optional Hub image `chrisjrovira/gametheca` when ready
- ClamAV daemon reachability for malware scan; LiveKit compose profile for voice; deferred WebRetro WASM (PCE/VICE/DOS)
- Optional Compose `observability` profile (Prometheus/Grafana) — stub only; see [observability-profile.md](docs/runbooks/observability-profile.md)

## [Unreleased]

Work since the 1.0.0-beta tag (2026-08-06).

### Added

- **Fonts and firmware install with the server.** Both were scripts nobody ran: the picker offered
  five faces and shipped none, and a populated local BIOS folder still read as empty. Fonts install
  in the background and never block startup (`FETCH_FONTS_ON_BOOT`); firmware imports from
  `BIOS_IMPORT_SOURCE` and never overwrites
- **Editable cover text in the Art Studio** — headline, subtitle and a title-size slider. The
  renderer always accepted these and only the preview forwarded them; Generate now matches what the
  preview showed
- **API envelope ratchet** (`scripts/api_envelope_lint.py`) — the shared response envelope landed
  with two files migrated and the problem then grew from ~699 call sites to 1194. Existing sites are
  recorded; a file may never exceed its count
- **Two-bar chrome** — side rail + top bar (`SideRail`, `TopBar`, and the `partials/rail.html` ·
  `partials/topbar.html` Jinja equivalents) so React and classic pages present one shell. Page views
  moved into bar two across both stacks; admin adopted the same bar one and its pages retired their
  now-duplicated titles
- **Chat pop-out** — `openChatPopoutWindow()` plus a `?popout=1` chrome-less host, matching the pattern
  the Friends dock has used since the social wave. Chat no longer blocks library interaction
- **Bad-match feedback** — operators can say a proposed match is wrong, on both the React `DupeGlance`
  and the classic unmatched table, so the two surfaces do not disagree about whether feedback exists
- **Game preview popup** — hover surfaces the state that actually decides whether a title can be played
- **Local installer builds** — `scripts/build-installers.sh` + [local-installers.md](docs/runbooks/local-installers.md);
  desktop installers no longer require GitHub Actions. Per-host limits are stated rather than implied —
  a `.dmg` genuinely needs a Mac
- **BIOS import** from an operator-supplied local collection (`scripts/import_bios.py`), preferring the
  majority copy when candidates disagree
- **Ownership polling** (`gametheca/utils/ownership_poller.py`) and a `/styleguide` route
- **CSS token lint** (`scripts/css-token-lint.mjs`) with a baseline — 2365 violations down to 1317
- **Sortable classic tables** (`js/gt_sortable_table.js`) — the Jinja counterpart to the React
  `DataTable`, so a table sorts the same way on both stacks instead of per page or not at all. Adopted
  on **Active Scan Jobs**, which had no sorting at all, and on **Unmatched**, which had its own
  private implementation. A page opts in with two attributes and the module wires itself up, because
  a page that must remember to call something eventually will not. A table that should arrive already
  ordered declares it in markup (`data-gt-sort-default`) rather than being re-sorted after each render

- **Theme asset freshness check** (`gametheca/utils/theme_freshness.py`), surfaced as a **Theme assets**
  panel in the Ops console. Theme CSS only reaches `static/library/themes/` on a **Reset Themes**, and
  nothing reported the drift — the only symptom was "the fix didn't work". The panel hashes source
  against deployed and distinguishes *behind* from *never deployed*, since those are different problems
  wearing the same number. It never copies anything; the fix stays an operator decision

### Changed

- **Ops console and dashboard tables now sort.** Five hand-rolled panel tables moved onto the shared
  `DataTable`, which gained a `toolbar={false}` mode — these panels hold three or four rows, and a
  filter box above them was the reason hand-rolling them looked reasonable. They already shared the
  styling, so they had the look of the other admin tables and none of the behaviour. Two stay
  hand-rolled on purpose: the key/value detail panels, and the Services checklist, whose row order is
  the order you read it in
- **Child access to the household voice lobby is now a household setting**, not a hardcoded stance
- Chrome buttons and primitive buttons now agree on focus: one ring, one offset, and a fallback so a
  theme missing the token loses the colour rather than the outline
- **Four more surfaces answer through the shared response envelope** — wishlist, support tickets,
  wanted list and the patch catalog, taking the ratchet baseline from **875 to 849**. The wire contract
  is unchanged (`api_ok` / `api_error` still mirror `error`, `message` and `success`, and every HTTP
  status is the same), but the messages stop being developer strings: "Forbidden" becomes "That request
  belongs to someone else", "Not found" becomes "Ticket not found". These are member-facing failures, so
  they are exactly the ones the SPA's shared error component has to render
- **Theme selection lives in Preferences only.** The admin Themes page carried its own swatch grid
  writing the same `current_user.preferences.theme` that Preferences writes, so two surfaces could
  disagree about what was selected with nothing to say which had won. Preferences is the keeper — it
  builds its list from `get_installed_themes()`, so it already covers uploaded packs as well as presets,
  and font, icon pack and tile size live there too. The Themes page keeps upload, reset and delete, and
  now links to Preferences rather than silently dropping the affordance
- **The News page leads with admin notes**, full width, and only when there are any. Headlines dropped
  their full-row span so News and Free sit side by side beneath the notes instead of Free sharing a row
  with an often-empty panel
- **Help quick-navigation is one segmented strip** on the shared `.gt-seg` the context bar and admin tab
  strips already use, instead of a third set of individually bordered pills wrapping into ragged rows.
  Help sections became panels matching the admin guide they were meant to resemble
- **Licensed under AGPL-3.0**

### Fixed

- **A long wishlist title made a new row on every resubmit.** `POST /api/requests` looked for an
  existing pending row using the full title but stored `title[:255]`, so anything past the column width
  could never match itself and the duplicate guard silently did nothing. Truncation now happens once,
  before the lookup, so the query and the insert compare the same string
- **Reopening a wishlist request left it stamped as resolved.** `pending` is a valid target for
  `PATCH /api/requests/<id>`, but the handler set `resolved_at` and `resolved_by_user_id` for every
  status, so a reopened row read as pending *and* closed and anything counting by `resolved_at` counted
  it as done. Reopening now clears both stamps
- **Reset Default Themes still told operators to hard-refresh** — the one instruction the cache fix
  above made obsolete, on the very page that runs the reset, contradicting both the runbook and member
  Help. It now says to reload
- **The same wishlist refusal read two different ways.** A child account blocked from requesting games
  got the GT-B1 envelope from a game page and a hand-rolled `{ok: false, …}` with no `error_code` from
  Library multi-select, because `POST /api/games/batch/wishlist` was never migrated alongside
  `POST /api/requests`. Both `can_request_games` denials answer through `api_error` now
- **The patch catalog's disabled-module 403 skipped the envelope**, so one endpoint reported failure in
  two shapes depending on which guard tripped; the same 403 was also copy-pasted into both routes and
  had already drifted. It is one helper now, and `POST /api/patch-catalog/attach` returns its success
  through `api_ok` rather than passing a helper's hand-rolled `ok` straight to `jsonify`. Baseline
  **849 → 846**
- **The envelope ratchet was counting an optimistic number**, which matters more than any single route
  because every migration wave steers by it. It only inspected `jsonify({...})` **dict literals**, so an
  envelope assembled anywhere else was invisible — which is how `patch_catalog.py` was recorded as
  migrated (6 → 2) with its main success path still hand-rolling `ok`, and how `wishlist.py` left the
  baseline altogether with three such returns in it. It now also resolves `body = {…}` → `jsonify(body)`
  and `jsonify(helper())` for bare functions defined in the file or imported absolutely from inside
  `gametheca/`. Attribute calls like `obj.to_dict()` are deliberately left alone: they cannot be tied to
  one definition, and their `status` is usually a real field rather than an envelope — a lint that cries
  wolf gets `--update`-ed away, which is the one outcome that breaks a ratchet. **The recorded count
  went 846 → 856, and the rise is the point**: those ten call sites were always there, and four of them
  sit in files that had looked clean. `--list` prints every site with the reason it counted
- **Four surfaces the blind spot had been hiding now answer through the envelope** — image delete and
  unmatched-folder toggle in `routes.py`, orphan version cleanup, and free-game claim assist — together
  with the sibling failure branches in the same handlers, so no handler answers in two shapes. Baseline
  **856 → 847**. Six of the ten stay recorded on purpose, because the legacy key there is *data, not an
  envelope*, and "migrating" them would corrupt a response: `preview_hardlink()` returns
  `ok: would_succeed`, so `api_ok` would overwrite a real "no, this would not work" with `True`;
  `ollama_status()` reports `error` as the reason Ollama is unreachable on an otherwise fine 200, and
  `api_ok` strips that key outright; `/healthz` returning `{status: 'ok'}` is the liveness contract three
  runbooks `curl -f` against. **The ratchet's job is to stop growth, not to dictate migration** — a
  tolerated entry is sometimes the permanent right answer
- **The SPA was showing members developer strings instead of the sentences the backend sends.** Every
  one of the 25 `api/` wrappers hand-rolled its own failure path, and they had drifted into two broken
  tiers. The worse one never read the body at all — `throw new Error(\`announcements ${status}\`)` — and
  since `PageStatus` renders an Error's message as the headline, a household member hitting a 403 was
  shown **"announcements 500"** rather than "Free games are switched off". The milder one read `error`
  but dropped `error_code` and `status`, which is exactly what the detail line renders. Both are
  invisible in review because each file reads fine alone; only the set is wrong. One
  `errorFromResponse()` now serves all of them, 28 call sites across 22 modules, and
  `envelopeContract.test.js` asserts the set rather than naming files — a new wrapper is free to appear,
  it just has to use the helper. Two failure paths are exempt with reasons: `/settings_panel` renders
  HTML, and `discover.js` guards a content-type after an *ok* response. The first version of the guard
  only looked for a `new Error()` directly after `if (!response.ok)`, which missed the same flattening
  one level down inside a helper — `tokens.js` had a tidy-looking `readError()` doing exactly it, and
  five more sat in `batchActions.js`. What identifies the bug is reaching for `data.error` to build an
  Error, wherever that happens, so that is what the guard matches now: **ten further sites across six
  modules**. Wrappers that need the parsed body on the success path use `errorFromBody()`, because a
  Response body can only be read once and calling the response-reading variant after that would quietly
  yield the developer string again
- **Six api wrappers could send an empty CSRF token, and the 403 said nothing about why.** Fifteen
  modules each carried their own token lookup, in **nine variants** that differed in exactly the place
  that matters — how many sources they try. Nine walked `meta → input → #csrf_token`, three stopped at
  the input, and two read only the meta tag, so on any page rendering the field rather than the meta tag
  those two sent `''` and the request failed with nothing to diagnose. One `csrf.js` now holds the
  **superset** chain, so consolidating widened every narrow copy and narrowed none, and six modules that
  had been bypassing `window.CSRFUtils` (its own fallbacks, plus a script-element source and a cache)
  now go through it like the rest. The contract test rejects a local redefinition or a hand-built
  `X-CSRFToken` header — it caught two stragglers on its first run
- **Collections answers entirely through the envelope** — the first whole file taken to zero rather than
  a route at a time, **26 → 0**, baseline **847 → 821**. Five of its handlers opened with the same six
  lines (look the collection up, 404 if absent, 403 if the caller may not edit it), so those became one
  `_editable_collection()` and the refusal wording can no longer drift between them. The messages stop
  being developer strings — "Not found" becomes "Collection not found", "Forbidden" becomes "That
  collection belongs to someone else" on a write and "That collection is private" on a read, which are
  different refusals and used to read identically. The two sentences `test_collections_api_wiring.py`
  greps for are kept verbatim
- **Libraries, ownership and social answer through the envelope** — 15 / 15 / 13 → 6 / 0 / 0,
  baseline **294 → 257**. The friend-request path needed care rather than conversion: it builds one
  anti-enumeration response and returns it from two places, so an unknown username is indistinguishable
  from a real one. `api_ok` already returns `(body, status)`, so the `, 200` at each return site had to
  go with it — and the lint's double-wrap guard would not have caught that form, because the value
  arrives through a variable rather than a literal call. `test_social_friends_enum.py` still passes.
  `library.py` keeps six on purpose, now annotated: three batch refusals carry the scan-queue
  `status: 'rejected'`, one `ok` is computed (`started > 0`, meaning "did any delete start"), and
  `admin_manage_libs.js` reads `data.status === 'success'` off another
- **AI assist, the user API and admin settings answer through the envelope** — 17 / 17 / 16 → 1 / 0 / 0,
  baseline **343 → 294**. `user.py`'s play-status responses keep their `status` key: there it is the
  game's own state (`beaten`, `unplayed`), not an envelope marker, and the same is true of AI config's
  `status: 'saved'`. `settings.py`'s `status: 'error'` **was** the marker and is gone — checked first
  that its only caller, the integrations template, reads `response.ok` and `data.message`, both of which
  `api_error` still provides. The one site left in `ai_assist.py` is annotated: `ollama_status()` reports
  `error` as *why* Ollama is unreachable on an otherwise fine 200, and `api_ok` pops `error`, so
  wrapping it would delete the field the endpoint exists to return
- **Acquire, companion client and emulator saves answer through the envelope** — **19 / 19 / 17 → 0**,
  baseline **398 → 343**. All three were single-shape files, so the conversion was mechanical; the two
  keys that needed a decision both stay as payload data — the acquire readiness `message`, and the
  delete-save `status: 'deleted'`, which is an outcome rather than an envelope marker
- **Three more surfaces answer through the envelope** — system settings **23 → 0**, cover art studio
  **21 → 0**, downloads **20 → 2**; baseline **460 → 398**. Downloads had the same three-guard opening
  (malformed uuid, missing game, no access) in three handlers, now one `_downloadable_game()`. Its two
  remaining sites are annotated: the download request's own `status` is data, and the missing-file
  refusal carries `code: 'path_missing'`, which `api/downloads.js` reads and which **`api_error` cannot
  carry — `code` is its own parameter for the error_code**. That is the second key, after `status`, the
  helper's signature blocks. Deleting a download request now answers with `error` as well as `message`,
  so the member finally sees "Download request not found" rather than a status code
- **The legacy `routes.py` answers through the envelope where it safely can** — **38 → 13**, baseline
  **485 → 460**. Four more handlers were passing `str(e)` to the browser; those log and answer with a
  sentence, including the three that stay on `jsonify`, because fixing a leak never required migrating
  the shape. The thirteen that remain are the `status` state machine `admin_manage_libs.js` drives —
  it branches on `'error'`, `'success'`, `'started'`, `'connected'`, `'completed'` and `'not_found'`,
  and four tests assert on it. There is also a structural reason they cannot move: **`api_error`'s own
  signature takes `status` as the HTTP code**, so it cannot carry a legacy `status` key at all.
  `api_ok` can, through its payload dict, which is why the success half of that family did migrate
- **The envelope lint also rejects a double-wrapped response.** `return api_ok({...}), 200` nests the
  `(body, status)` tuple the helper already built, and Flask rejects it — while compiling cleanly and
  carrying no legacy key, so neither the interpreter nor the call-site count notices. Caught twice
  while converting multi-line literals, where the closing `}), 200` survives the rewrite
- **Scan management answers through the envelope** — `scan.py` **43 → 7**, baseline **521 → 485**.
  Seven stay and are annotated where they sit: `status` there is the **scan-queue contract**, not the
  legacy marker — `scanQueuePolicy.js` documents it as `'queued' | 'started' | 'rejected'` and
  `admin_manage_scanjobs.js` branches on `status === 'rejected'`. The per-item `ok` inside each
  `results` list is untouched for the same reason: it answers "did this folder succeed", not "did the
  request succeed"
- **The envelope lint now rejects a response that is built and thrown away.** `api_ok`/`api_error`
  both build a response *and* return it, so a call in statement position means a handler computed a
  refusal and then honoured the request anyway. Not baselined — it is never legitimate. Found the hard
  way: a migration regex ate the `return` on eleven guards in one file, and exactly one of the eleven
  had a test covering that path, so the suite reported a single failure for eleven broken validators
- **Admin artwork answers through the envelope** — `routes_admin_ext/images.py` **37 → 0**, baseline
  **558 → 521**. Two handlers passed `str(e)` from a bare `except Exception` to the browser; those now
  log and answer with a sentence. The unwritable-`IMAGE_SAVE_PATH` refusals keep every field they
  carried — `image_save_path`, the zeroed counters, the `errors` list — because the Images page renders
  them to explain *why* nothing downloaded, and a refusal that drops them would just look broken
- **Library tools answer through the envelope** — `library_tools.py` **32 → 0**, baseline
  **590 → 558**. This was the `{'status': 'ok'}` family, the third of the five competing shapes and the
  one that needed checking rather than converting: `status` is a real field name as well as an envelope
  marker. Here all 27 were the marker (`'ok'` or `'error'` and nothing else), and the admin clients read
  `response.status` and `data.message || data.error` rather than the body's `status`, so dropping it is
  safe. `routes.py` keeps its own — the same key there carries genuine scan-job state (`starting`,
  `deleting_games`, `completed`), which is data
- **Admin discovery sections and zones answer through the envelope** — `routes_admin_ext/system.py`
  **40 → 0**, baseline **630 → 590**. Another single-family file: all 40 sites used `{success, error}`,
  which `api_error` still mirrors, so the admin SPA is unaffected. The seven `Internal server error`
  handlers were already doing the right thing — logging the exception and returning a generic sentence —
  so they only changed shape
- **Metadata providers answer through the envelope, and an upstream failure is now nameable** —
  `providers.py` **29 → 0**, baseline **659 → 630**. Five search endpoints refused a missing `q` in
  their own words and four spelled out the same "not configured" 503; both are one helper now, with
  `provider` still riding along as an envelope extra because the admin UI uses it to link to that
  integration's card. **`bad_gateway` (502) joins `ERROR_CODES`** — fifteen route sites across five
  files already returned a bare 502 with nothing to branch on, and "the provider answered badly" is a
  different operator action from "we broke" (`internal`) and from "the integration is switched off"
  (`unavailable`)
- **The admin user editor answers through the envelope** — `routes_admin_ext/users.py` **36 → 0**,
  baseline **695 → 659**. This file used the *other* legacy shape throughout — `{success, message}` at
  all 36 sites — which is exactly the case the envelope was designed to absorb without breaking
  anything: `api_error` still mirrors `message` and `success`, so the admin SPA reading them is
  unaffected. Six validator refusals in a row became one lazy `_first_refusal()` that takes callables
  rather than results, so `check_username_unique` still does not hit the database when the username was
  already rejected. The refusals inside conditional branches stay written out — one of those pairs mixes
  a 400 with a 403, and folding it into a single-code helper would have hidden that
- **Chat answers entirely through the envelope** — `chat.py` **38 → 0**, baseline **733 → 695**. Ten
  handlers answered a bare `'Not found'`, across four different causes; they are one
  `_refuse_not_found()` now, with the reason for the opacity stated once instead of being folklore —
  a 403 would confirm that a channel someone cannot see exists. Channel lookups collapse into
  `_visible_channel()` / `_active_channel()`. The `str(exc)` passthroughs are kept: unlike the raw
  system exceptions in `game.py`, the chat helpers raise `PermissionError`/`ValueError` carrying a
  sentence written for the member
- **A test could only pass once against the shared test database.**
  `test_chat_spaces_voice_acl.py` committed a game with a hardcoded unique `igdb_id`, and `conftest`'s
  `db_session` deliberately never rolls back — `drop_all` is commented out for speed, so rows survive
  the run. The first run left the row behind and every later run died on a `UniqueViolation` that looks
  nothing like its cause. Now derives the id the way `test_library_health_pulse` already did
- **Chat spaces answers entirely through the envelope** — `chat_spaces_api.py` **28 → 0**, baseline
  **761 → 733**, and `jsonify` is no longer imported there at all. Seven handlers opened with the same
  "space not found" 404, one of which also rejected an archived space; `_refuse_missing_space()` carries
  both so the two wordings cannot drift. The deliberate white lie stays: a child account asking for a
  voice channel that is not child-safe still gets "Voice channel not found" rather than a 403, because
  the refusal should not confirm the channel exists
- **The game API answers through the envelope** — `routes_apis/game.py` **41 → 6**, baseline
  **796 → 761**. Five handlers shared the "load the game, 404, check access, 403" opening and had
  already drifted — the details endpoint said "Access denied" where the other four said "Forbidden",
  for the identical check — so that is one `_refuse_inaccessible_game()` now. **Four handlers were
  handing raw exception text to the browser** (`str(e)` from a failed commit, a library move, an IGDB
  id lookup), which can carry filesystem paths; those go to the log and the browser gets a sentence.
  The six that stay are recorded on purpose and annotated in place: five batch endpoints answer
  `ok: len(errors) == 0`, which means *"did every item succeed"* rather than *"did the request
  succeed"* — the SPA reads `data.ok !== false` to flag a partial batch, so routing those through
  `api_ok` would stamp them `True` and hide the failures
- **Cheats answers entirely through the envelope** — `emulator_cheats.py` **25 → 0**, baseline
  **821 → 796**. Five handlers shared the same four-line "load the game, 404, check access, 403"
  opening, now one `_accessible_game()`. The `cheat_surface` key both refusals carry — the one the
  Cheats and PC-cheats panels mount on — rides through as an envelope extra, so the surface-mismatch
  responses keep telling the client which panel belongs there
- **Moving the tile-size slider and navigating away left two timers running.** Neither was ever
  cleared: the transition-suppression class lives on `<html>` rather than on anything React unmounts, so
  leaving the library mid-drag stripped the tile-size transition for the rest of the session, and the
  debounced preference save fired from an unmounted component. The class comes off on unmount and the
  owed save is **flushed rather than dropped**, so the drag that was just made still persists
- **The admin SPA had the same duplication, one layer thinner.** `adminApi.js` was already the shared
  fetch module, but `SupportInboxPage` kept its own `csrfToken()`, `AnnouncementsPage` kept a whole
  private `postJson` / `getJson` pair — missing the 401→`/login` redirect every other admin call has —
  and **eleven** sites built the `X-CSRFToken` header by hand, three of them inside `adminApi.js`
  itself. All of it now goes through `csrfHeaders()`. The four error paths in that module also threw a
  bare `Error(message)`, so a page could show the sentence but could not tell a 403 from a 500;
  `adminError()` keeps `status` and `error_code` on the Error. Unlike the member app, the narrow
  meta-tag-only token lookup was **not** an active bug here — `base_admin.html` always renders the meta
  tag — so widening it is consistency rather than a fix. `ops-glance` was already clean
- **The CSS token ratchet could not be run locally on Windows.** `cssTokenLint.test.js` died with
  `SyntaxError: Invalid or unexpected token` before collecting a single test, because `.gitattributes`
  said only `* text=auto` — so a Windows checkout got `scripts/css-token-lint.mjs` with CRLF, and Vite's
  transform rejects a CRLF `.mjs` (sibling `.js` files are fine; it is specific to the extension). CI
  checks out LF and never saw it, so the gate was working *there* while a local `npm test` was red for a
  reason unrelated to whatever you had changed — the surest way to teach people to ignore a failing
  suite. `*.mjs text eol=lf` pins it and the four `.mjs` files are re-materialised
- **The unmatched-folder AJAX path never rolled back its failed transaction** — `db.session.rollback()`
  sat after the `return`, so only the non-AJAX branch reached it — and it handed the raw SQLAlchemy
  error text to the browser. The rollback now runs before either branch returns, and the exception
  detail goes to the log while the browser gets a sentence
- **Success responses were missing the `error` and `error_code` keys the envelope promises.** `api_ok`
  stripped them and never put them back, so a client reading `data.error_code` got `undefined` on the
  way through and a real token on the way out. They are present and `null` on success now, which is what
  the contract said all along
- **A completed theme reset stayed invisible for up to an hour** — the reason a run of CSS fixes looked
  like they never landed. `asgi.py` served every static file with `public, max-age=3600` and **no
  validator** (no ETag, no `Last-Modified`), while Reset Themes rewrites
  `static/library/themes/<theme>/…` *in place* behind an identical URL. Nothing about the request
  changed, so the browser cache answered for the full hour and only a hard refresh appeared to fix it.
  Both halves are closed: `theme_asset` appends a version derived from the file's mtime and size so
  replaced bytes produce a new URL (memoised, since a page links a few dozen of these and the tree can
  sit on a network path — Reset Themes clears the memo, which is what makes a reset visible), and the
  static handler serves `/static/library/themes/` with `no-cache` so even an unversioned reference
  revalidates. Hashed SPA bundles, images and fonts are content-addressed and keep the hour
- **One scan announced itself several times.** New-game alerts coalesce into a five-second window, so
  any pause longer than that — a slow scrape, a large file, a rate-limited provider — flushed the digest
  mid-scan and announced a library that was still filling, producing a run of "N games added" alerts with
  different Ns. Scan completion was the signal that was missing: `flush_library_add_digest()` is now
  called when the job is marked Completed, cancelling the pending timer and emitting once with the
  finished count. Safe when nothing is pending, and wrapped so a notification failure can never fail a
  completed scan
- **Tile menus rendered underneath the tiles below them.** Virtual rows are absolutely positioned *and
  transformed*, and a transform creates a stacking context — which trapped `.game-card`'s `z-index: 20`
  inside its own row, so the next row painted over the open menu. That is why raising the card read as a
  correct fix and did nothing, and why it only ever happened in the library grid. The row is the level
  the menu lives at, so the row is what gets raised, scoped to `:has(overlay-open)` so rows never
  otherwise reorder
- **Dead space above and below library tiles, with pagination pushed far down.**
  `estimateGridRowHeight()` returned the bare cover height; the plain grid gets its row spacing from
  `gap` for free, but virtual rows are absolutely positioned, so that number *is* the spacing. Rows
  stacked flush and `getTotalSize()` ran short by one gap per row. The estimate now includes the gap and
  the row carries it as padding, so the measured height agrees
- **Top-right tile buttons were hard to see and ignored the theme** — flat `rgba(0,0,0,.7)` on a white
  hairline with a fixed white glyph, which vanished over light cover art. Repointed at `--gt-surface` /
  `--gt-border` / `--gt-text`, and the menu offset now derives from the same stride as the button stack
  instead of a magic `82px`, so hiding or adding a control moves the menu with it
- **The scroll pair floated in a box instead of aligning to the rail.** `chrome/ScrollJump.css` had
  already been rewritten to sit in the rail footer, but a duplicate in `gt-chrome.css` won on
  specificity and kept the old fixed-position bordered design. The duplicate is gone. The selection bar
  and filter panel also docked at a literal `3.25rem` — the comfortable-density top bar height — so they
  detached and floated over the tiles on compact; both read `--gt-topbar-h` now
- **The Help quick-nav chips and section headers had no focus indicator**, clearing their outline and
  leaning on a treatment hover already produces, so a keyboard user could not tell focus from hover. Same
  visible ring as everywhere else now; the panel radius became a declared token rather than a raw `14px`
- **An empty News announcements panel held a column permanently.** `announcements` is an array, so
  `announcements &&` was true when empty and rendered a heading, a zero count and "No announcements yet."
  The empty state survives on the Admins tab, where the section *is* the page and silence would read as a
  failed load rather than an empty one
- **Emulated games ran far too fast with broken audio.** Nothing measured the display refresh rate:
  RetroArch defaults `video_refresh_rate` to 60 and `video_vsync` paces to rAF, so a 120/144/165Hz
  monitor ran the core **2–2.75× too fast**. `measureRefreshHz()` now samples 32 frames (median, with a
  hidden-tab guard) and writes the real rate. **Unverified on hardware — needs a >60Hz display**, since
  a 60Hz panel is exactly the case the old default already got right
- **Firmware you added did not appear.** `list_bios_files` was a flat `os.listdir` that skipped
  directories, so per-system sets (`bios/psx/`, `bios/saturn/`) left a populated volume reading as
  empty. Nested files are found, and *present but misplaced* is now reported distinctly from *absent* —
  libretro cores read the system root, so the two need different fixes
- **A duplicated settings row would have locked everyone out of login**
- **Firmware upload never sent a CSRF token**
- Oversized cover uploads crashed on Pillow 10+
- Upgrading from the legacy quality-profile format 404'd on first edit
- A completed setup recorded itself as parked on Features
- Collection detail rendered with no name under the new chrome
- The scan path used a single scraper source instead of finishing the cascade
- Tile hover was effectively invisible
- **Seven controls had no visible keyboard focus.** The show/hide password toggle removed its focus
  outline and put nothing back — on a field whose contents are hidden too — and five others (admin top
  bar links, theme links, scan filter chips, account nav, loading-motif specimens) shared one rule with
  `:hover`, so a focused control and a hovered one looked identical. Account nav was the worst: that
  same styling is its "current page" state, so focus and "you are already here" were the same picture
- **Disabled chrome buttons looked and behaved like live ones.** `.gt-cbtn` had no disabled styling at
  all, so "Mark all read" with nothing unread, refresh while refreshing, and delete mid-delete were
  indistinguishable from working buttons — and still lit up on hover, so the one control that would not
  respond was the one inviting the click
- **Background workers shared the request's database session.** Six sites paired
  `@copy_current_request_context` with a raw `Thread`, which carries the request's session onto the new
  thread — including library deletion, which walks every game committing repeatedly. Replaced by
  `run_in_background()` ([gametheca/utils/background.py](gametheca/utils/background.py)), which runs the
  worker in its own `app_context` and so its own session, and logs failures against a named task instead
  of a bare traceback. None of these workers ever wanted a request context; the decorator was handing
  them one they did not use, and the shared session came along with it. Two sites also passed ORM objects
  or read attributes from the thread — those now snapshot ids and re-fetch. A leaked deletion worker was
  the cause of the flaky test suite, and it was masking a pagination bug that is now fixed too

### Removed

- **The classic `/admin/manage_users` editor**, at every layer — rail entry, page link, route resolver,
  Flask route, template, CSS and JS. The React roster at `/admin/users` is the only user editor; the
  invites page now points there. **A bookmark to the old path will 404.**
- **The admin theme picker and `POST /admin/themes/apply`** — grid, fetch and handler. Theme choice is
  Preferences' job; see *Changed*. The 16 tests that covered the route are rewritten as retirement
  guards rather than deleted, on the principle the files already had: "gone" is a contract worth
  asserting
- `templates/settings/settings_panel.html` — `/settings_panel` renders `modal_preferences.html`, so the
  file was rendered by nothing while holding a third copy of the theme picker, element ids and all
- The last SharewareZ-era leftover in code (`get_warez_folder_usage()`)

[1.0.0-beta]: https://github.com/chrisjrovira/gametheca/releases/tag/v1.0.0-beta
[0.1.0]: https://github.com/chrisjrovira/gametheca/releases/tag/v0.1.0
