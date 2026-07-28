# Roadmap execution progress

**Branch:** `feature/wave2-admin-fixes` → ship to `main`  
**Release:** **0.2.0** (full-ship in progress — Jul 27 board includes WIP polish)  
**Updated:** 2026-07-28 (Full-app 3-pass review **Complete / ship-ready** · P3: 62 pytest · auth smoke 200 · **next:** Human ship → Unraid rebuild/schema → leaf libs)

## Locked for 0.2.0 (product decisions)

| Decision | Stance |
|---|---|
| Feature modules | Most `ENABLE_*` **on** by default — disable in setup / Admin → Features / `.env` |
| Auth | `OIDC_ENABLED` **off** until operator opts in (local login always works) |
| Safety locks | `ENABLE_AI_AUTO_APPLY` and `ALLOW_HARDLINK_APPLY` stay **off** |
| Malware scan | `ENABLE_MALWARE_SCAN` on; `MALWARE_SCAN_BLOCK_ON_HIT=true` skips/blocks library adds on heuristic or ClamAV hit |
| ClamAV sidecar | Optional `docker compose --profile clamav up -d` — heuristics still run without daemon |
| Social | First-party dock · `/social-companion` · desktop Friends window — **no Discord** |
| Patch catalog | Operator-owned YAML/JSON only — **no romhacking.net scrape** |
| ASGI static | Native `/static/*` outside WsgiToAsgi with traversal-safe path resolution |

## Jul 27 status (board close-out)

| Area | Status |
|---|---|
| Member SPA + systems + details | Shipped |
| Waves 7–11 foundations | Foundations |
| Wave 12 save/cheat bridge · NZBGet · OpenAPI | Shipped |
| Wave 13 lite social · community chat link | Shipped |
| Wave 14 presence · profiles · notifications | Shipped |
| Wave 15 DMs · household channels · @mentions | **Shipped** — mute · opt-in instant + daily digest email |
| Wave 16 LiveKit voice lobby | Shipped — [social-av.md](social-av.md) · [livekit-unraid.md](../runbooks/livekit-unraid.md) |
| Wave 17a chat reactions + search | Shipped — fixed emoji set + `/api/chat/search` |
| Wave 17b threads + spectator | **Shipped** — reply threads · LiveKit spectator · admin custom emoji (max 20) |
| Admin SPA invites + users bodies | Shipped — `/admin/invites` · `/admin/users` React roster · classic `/admin/manage_users` |
| BIOS / N64 play hints | Shipped — `browse_play_fields` bios + n64_note |
| Wave 18 free games | **Shipped** — News Free now · notify · deeplink + connected sync assist — [free-games.md](../user/free-games.md) |
| Wave 19 emulation coverage | **Shipped (19a–g)** — companion honesty + Systems badges — [emulation-coverage.md](emulation-coverage.md) |
| Legal free sample ROMs | **Shipped** — `samples/free-roms/` + `scripts/fetch-free-roms.py` (binaries gitignored) — [samples/free-roms/README.md](../../samples/free-roms/README.md) |
| Login rate limit | **Shipped** — in-process + proxy runbook — [login-rate-limit-proxy.md](../runbooks/login-rate-limit-proxy.md) |
| Companion polish | **Shipped** — Tauri append/rename ACL · server update merge · uninstall staging cleanup — [desktop-companion.md](../user/desktop-companion.md) |
| Desktop Friends + offline UX | **Shipped** — always-on-top `/social-companion` window · least-privilege `social` capability · Online/Offline heartbeat gating — [desktop-companion.md](../user/desktop-companion.md) |
| Desktop secure token store (V1-DESK-1) | **Shipped** — OS credential store (`keyring` / Windows Credential Manager) · migrate+scrub plaintext `config.json` token — [desktop-companion.md](../user/desktop-companion.md) |
| Desktop distribution | **Unsigned only (product stance)** — `desktop-build.yml` ships unsigned `.exe`; Windows code-signing certs will never be pursued — [desktop-code-signing.md](../runbooks/desktop-code-signing.md) |
| Social email notify | **Shipped** — instant mentions/DMs + daily digest (`email_digest_daily`) — [social-and-voice.md](../user/social-and-voice.md) |
| Friends companion | **Shipped** — dock · `/social-companion` pop-out · Big Picture **Y** · desktop always-on-top — [social-and-voice.md](../user/social-and-voice.md) |
| Feature defaults (modules ON) | **Shipped** — setup + Admin → Features · OIDC opt-in only · AI/hardlink apply locked off — [settings-modules.md](../admin/settings-modules.md) |
| Admin → Features + malware scan | **Shipped** — `ENABLE_MALWARE_SCAN` + block-on-hit default · ClamAV profile — [settings-modules.md](../admin/settings-modules.md) · [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) |
| ASGI static path hardening | **Shipped** — native `/static/*` serving · `resolve_static_path` rejects traversal — `asgi.py` · `tests/test_asgi_static.py` |
| Game details polish | **Shipped** — screenshot lightbox · external store links · cover URL existence check · Social companion dock on details (`gameUuid` wired) · ≤900px action/lightbox/store layout |
| Mobile density | **Shipped** — Chat · filters · pagination · tiles ≤900px — [getting-started.md](../user/getting-started.md) |
| Tile size control | **Shipped** — continuous 0–100% slider (legacy S/M/L/XL mapped) |
| Library grid virtualization (V1-UI-1 partial) | **Shipped** — `GameGrid` row virtualizer (`@tanstack/react-virtual`) · pagination unchanged |
| Command palette (Ctrl/Cmd+K) | **Shipped** — member SPA `cmdk` nav jumps + Preferences · Search hint in TopNav — [ui.md](ui.md) · [getting-started.md](../user/getting-started.md) |
| Admin SPA bodies | Hybrid — Dashboard/Ops React live counts; Libraries/Scans Jinja fixed (no nested `</body>`); Integrations hub React cards (IGDB/SMTP/OIDC/LiveKit/Support) + Jinja forms; Support/Announcements/Invites/Users live |
| Library badge/filter chrome | **Shipped** — GameTheca tokens in member-app CSS (no bare browser buttons) |
| Custom chat emoji | **Shipped** — admin upload capped at 20 — [social-and-voice.md](../user/social-and-voice.md) |
| WebRetro WASM scaffold | **Shipped** — disk discovery + local `relativeBase` + `installed-cores.js` + fetch scripts — [webretro-cores.md](../runbooks/webretro-cores.md); deferred PCE/VICE/DOS binaries still operator-owned |
| WebRetro save polish (O1) | **Shipped** — export retries · `.srm`/`.mcr`/`.sav` · auto load state — [browser-play.md](../user/browser-play.md) |
| ROM set completeness | **Shipped** — DAT upload · title + hash match · Systems % — [reference-sets.md](../runbooks/reference-sets.md) |
| Multi-region heatmap | **Shipped** — `set_completion_regions` chips on Systems |
| Perf review P0–P2 | **Shipped** — browse batch · SPA lazy · Chat/IGDB · WebRetro cold start · scan defer (images/Steam/HLTB + **folder size**) · Discover API · SSE queue · favorites page · filters bundle · scan session.remove |
| Activity SSE vs single worker | **Shipped** — native ASGI `/api/activity/stream` + `/api/events/stream` · Flask WSGI returns 503 · companion SSE only when dock open |
| Compose pg_hba (`no encryption`) | **Shipped** — `docker/postgres/pg_hba.conf` + `hba_file=` · runbook §3b |
| Team review Jul 27 (boot→Discover→Admin) | **Blocked on Unraid deploy** — code/docs pass; E2E needs commit+push + `force-recreate db` + app rebuild — see canvas |
| Unraid test-bed wave (Jul 27 evening) | **In flight** — local: ASGI SSE · pg_hba · scan identify/progress · themes · GIF scrub · **Ops volume sectioning + `.env.unraid.example` + monitor checklist** · **Ops RO-games path honesty** · **Ops scan counters + OpsPage tile** · **IGDB name variants** · **console-gaming library model LOCKED (per-platform)** · **skip-dir patterns (code)** · **enums NEOGEO/PSP/SWITCH/ARCADE (code, catalog/companion honesty)** · Unraid runbook leaf-lib + skip-dir apply; **next:** Human ship (skip-dir + enums) → Unraid schema/rebuild → create per-platform leaf libs (NES/Genesis/PS1 first; then Neo Geo/PSP/Switch/Arcade as needed) — **Blocked:** Unraid until ship — see program canvas |
| IGDB name-resolution strategy | **Shipped (docs)** — letter-bucket / BGDA matcher rules — [name-resolution.md](name-resolution.md) |
| IGDB name variants (matcher) | **Shipped (code)** — BGDA1 → Baldur's Gate: Dark Alliance; Human ship + `_pc`/`_b` rescan next — [name-resolution.md](name-resolution.md) |
| Console-gaming skip-dir (scan) | **Shipped (code)** — emu/FE/tool **prefix** globs + `dir:` Admin filters; tightened Jul 28 review (no `GOD*` / `*dolphin*` title false positives); **no** scan_depth=3 family walk — [console-gaming-libraries.md](console-gaming-libraries.md) |
| Console-gaming library model | **LOCKED** (per-platform leaf libraries; not one mega-lib) — [console-gaming-libraries.md](console-gaming-libraries.md) |
| Console-gaming enum add list | **Shipped (code)** — `NEOGEO` · `PSP` · `SWITCH` · `ARCADE` (catalog/companion honesty; Wii U deferred) — [console-gaming-libraries.md](console-gaming-libraries.md)#locked-enum-add-list-backend |
| Full-app 3-pass review Jul 28 | **Complete / ship-ready** — P1: major routes 200 auth · pytest 51 · SSE hang = env. P2: skip-dir GOD/dolphin · Ops RO honesty · Ops counters · Big Picture friends · Desktop Friends URL/keyring · Unraid runbooks. P3: 62 pytest · auth smoke 200 · ship-ready. **Next:** Human ship (skip-dir+enums+Pass2) → Unraid rebuild/schema → leaf libs NES/Genesis/PS1 — **Blocked:** Unraid E2E until ship only — see program canvas |
| PM Task-disperse process | **Shipped (process)** — always-apply `pm-disperse.mdc` · parent Tasks Ops/Backend/UI/Desktop/QA/Docs/GM · Docs owns program canvas Done/Next/Blocked/Team flow each wave — [agent-skills.md](../dev/agent-skills.md) |
| Deep scan stall (folder size / IGDB) | **Shipped** — defer size walk on identify · 60s size timeout · IGDB HTTP timeout · rate-limiter unlock · max 3 name fallbacks |
| Scan progress stall at 1 + empty Stop UX | **Shipped** — atomic `bump_scan_job_progress` · Stop drains in-flight · Cancelled shows `Stopped N/total` · Stopping button labeled |
| Ops glance scan counters | **Shipped** — `/admin/api/ops/summary` `scans.jobs` exposes `folders_*` / `current_processing` / `last_progress_update` / `id_short` (+ recent terminal jobs 24h) — [ops-summary.md](../admin/ops-summary.md#scans-key) |
| ShareWarez loader GIF purge | **Shipped** — pirate `searching*.gif` deleted; folder browse / scan / identify / libraries / IGDB use `gt-spinner` + a11y status |
| Setup admin create redesign | **Shipped** — `gt-setup` wizard (mark · green accent · dense fields) · Admin Users create/edit `gt-user-modal` |
| Admin Themes page densify | **Shipped** — `gt-themes-*` blocks · tighter admin top nav · Reset Default Themes after deploy (`GENERATOR_VERSION` **8**) |
| Bug scrub O4–O12 + O1/O8 | **Shipped** — see [bug-triage.md](bug-triage.md) |
| ROM translation (detect + catalog + Flips apply) | **Shipped** — filename lang chips · preferred `en-US` · extras · companion apply · Library LANG/PATCH · **operator patch catalog hooks** · **RetroArch AI overlay hints** · offline stubs — [translation-patches.md](../user/translation-patches.md) · [rom-auto-translate.md](rom-auto-translate.md) |
| Security P0/P1 + Sec-B | Done — [security.md](security.md) |
| Icon packs (6 styles, any color theme) | Shipped — [icon-themes.md](icon-themes.md) |
| Support tickets (no Discord) | Shipped — [support-inbox.md](../admin/support-inbox.md) |
| Docs sync on every change | Skill + always-apply rule — `.cursor/skills/docs-sync/` |
| Prompt-brief middleman | Always-on — `.cursor/skills/prompt-brief/` · [agent-skills.md](../dev/agent-skills.md) |
| Bug scrub triage | [bug-triage.md](bug-triage.md) |
| Competitive catalog | Private vault only — `docs/_private/` (gitignored); public stub [competitive.md](competitive.md) · **Jul 27 landscape expansion** (≥30 net-new × 8 service lanes) |

## Still thin / next (board order — Jul 27 PM locks)

Priority for **1.0.0** — **no 1.1 track** (see [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md)):

1. ~~**CH-1 → CH-5**~~ — challenge bypass **shipped** · profile **`challenge`** · max tier **5** — [challenge-bypass.md](challenge-bypass.md) (CH-6 MITM runbook thin)  
2. ~~**ART-1 → ART-3**~~ — cover art studio **shipped** — [cover-art-studio.md](cover-art-studio.md)  
3. ~~**MOD-1 → MOD-2** · **SRV-1 → SRV-2**~~ — mods + server registry APIs **shipped** — [game-servers-mods.md](game-servers-mods.md) (~~MOD-3~~ companion apply **shipped** · SRV UI polish in flight)  
4. ~~**GOW-1 → GOW-2**~~ — remote play host + Moonlight CTA — **shipped** — [gow-remote-play.md](gow-remote-play.md)  
5. **LIGHT-1 → LIGHT-2** — Hyperion + HA ambient hooks — **shipped** — [ambient-lighting.md](ambient-lighting.md)  
6. ~~**TC-1**~~ — thin client scopes + `device_kind` + capabilities API — **shipped** — [thin-client.md](thin-client.md) · ~~TC-2 shell build~~ **shipped** (`tauri:build:thin`)  
6b. **Android APK** — [android-apk-vr.md](android-apk-vr.md) · **Headset/VR** relocked SteamVR/PSVR2-first — [headset-vr.md](headset-vr.md) · **Controllers** — [controller-input.md](controller-input.md) (PAD-DOCS/HELP queued)  
7. ~~**Desktop MOD-3**~~ — companion mod pack apply **shipped** — [desktop-companion.md](../user/desktop-companion.md) · GOW-2 copy-host stub **deferred** (no GOW API yet)  
8. **Official 1.0.0** — [v1-readiness.md](v1-readiness.md) · [pm-miss-backlog.md](pm-miss-backlog.md) agent MISS-* **closed** · remaining **human:** Authentik/Hub/Unraid  
9. **SCRUB** — [external-facing-scrub.md](external-facing-scrub.md) · SCRUB-1…4,6–9 done; **SCRUB-6b GitHub Issues/PR search clean** ([github-scrub-2026-07-27.md](github-scrub-2026-07-27.md)); SCRUB-5 history rewrite deferred  
10. Optional: Admin Integrations **forms** still Jinja (hub cards done MISS-UI-3) — [admin-hybrid.md](admin-hybrid.md)  
11. **1.0 capacity (non-gating):** Alembic · live Prometheus · api-client SPA ([ADR 0002](../adr/0002-defer-api-client-spa.md))  
12. Operator-owned: deferred WASM · Authentik · Unraid · Capture  

### Jul 27 agent-team wave

| Seat | Shipped |
|---|---|
| Ops | `/healthz` `/readyz` · Ops Services pulse · observability stub + Unraid Services checklist |
| QA | `ci-tests.yml` |
| Backend | pinned requirements · image `0.2.0` · [ADR 0001](../adr/0001-schema-migrations-defer-alembic.md) |
| UI/UX | GameGrid virtualization · **Art studio** (ART-1…3) · **Themes densify** · setup `gt-setup` · loader GIF purge (`GENERATOR_VERSION` 8) |
| Desktop | OS keyring token store · `app-smoke.test.ts` · Friends session vs keyring docs |
| Game Master | [v1-gamemaster-signoff.md](v1-gamemaster-signoff.md) · CHANGELOG Emulation honesty |
| Docs | [admin-hybrid.md](admin-hybrid.md) · [upgrade-notes-1.0.md](upgrade-notes-1.0.md) · [observability-profile.md](../runbooks/observability-profile.md) |

## Agent team (Jul 27)

Seats: PM · UI/UX · Backend · Desktop · QA · Docs · Game Master · **Ops** (`@agent-ops` — Unraid/Compose health + ops glance). Index: [agent-skills.md](../dev/agent-skills.md).

**Disperse:** Parent acts as PM and **Task**s seats (no in-parent product code). Docs owns program canvas Done/Next/Blocked/Team flow each wave.

## Flags

See `.env.example` — most `ENABLE_*` on; **`OIDC_ENABLED`**, **`ENABLE_AI_AUTO_APPLY`**, **`ALLOW_HARDLINK_APPLY`** off; **`MALWARE_SCAN_BLOCK_ON_HIT`** on (skip/block adds on hit); `CLAMAV_*` + optional `--profile clamav`; `ENABLE_ARR_MODULE`, `ENABLE_DEBRID`, `ENABLE_LIVEKIT`, `ENABLE_ROM_PATCH_APPLY`, `ENABLE_PATCH_CATALOG`, `FLIPS_PATH`, `SUPPORT_GITHUB_*`, …

## Operator-owned

Authentik secrets · Unraid rebuild + Reset Default Themes (+ icon packs install on boot) · SMTP for social email · ClamAV daemon reachability (optional profile) · deferred WebRetro WASM (PCE/VICE/DOS) via [webretro-cores.md](../runbooks/webretro-cores.md) · No-Intro/Redump DAT uploads via [reference-sets.md](../runbooks/reference-sets.md) · operator patch catalog YAML (no romhacking.net scrape) · desktop remains unsigned (no cert purchase — [desktop-code-signing.md](../runbooks/desktop-code-signing.md))
