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
- **Licensed under AGPL-3.0**

### Fixed

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
- The last SharewareZ-era leftover in code (`get_warez_folder_usage()`)

[1.0.0-beta]: https://github.com/chrisjrovira/gametheca/releases/tag/v1.0.0-beta
[0.1.0]: https://github.com/chrisjrovira/gametheca/releases/tag/v0.1.0
