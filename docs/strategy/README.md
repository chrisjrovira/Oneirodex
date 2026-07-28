# GameTheca strategy pack

**Product version:** 0.2.0 (in progress) — see [../../CHANGELOG.md](../../CHANGELOG.md).

Product direction for GameTheca as a **self-hosted, multi-user, DRM-free library & distribution platform**.

Read in this order:

| # | Doc | Purpose |
|---|---|---|
| 1 | [competitive.md](competitive.md) | Private vault pointer (peer catalogs gitignored) |
| 2 | [roadmap.md](roadmap.md) | North star, quarters, milestones, non-goals |
| 3 | [v1-readiness.md](v1-readiness.md) | Official 1.0.0 gate — keep-and-enhance + Ops |
| 3b | [pm-miss-backlog.md](pm-miss-backlog.md) | Living pre-1.0 miss tickets (MISS-*) |
| 4 | [features.md](features.md) | Implementation-ready feature plans (P0+) |
| 4b | [thin-client.md](thin-client.md) | Connect-only client — TC-1/TC-2 shell **shipped** |
| 4b2 | [android-apk-vr.md](android-apk-vr.md) | Android thin APK (phone/tablet) |
| 4b3 | [headset-vr.md](headset-vr.md) | Headset/VR — SteamVR/PSVR2 + Quest friend seat |
| 4b4 | [controller-input.md](controller-input.md) | Big Picture gamepad + Help legends |
| 4c | [external-facing-scrub.md](external-facing-scrub.md) | Keep competitor / Class A intel out of public git & builds |
| 4d | [challenge-bypass.md](challenge-bypass.md) | BYO TRAWL / captcha solvers — **shipped** · profile `challenge` · CH-1…5 · max tier 5 |
| 4e | [cover-art-studio.md](cover-art-studio.md) | Fallback art + admin art creator — **ART-1…3 shipped** |
| 4f | [gow-remote-play.md](gow-remote-play.md) | Moonlight / Wolf remote play — GOW-1/2 **shipped** |
| 4g | [game-servers-mods.md](game-servers-mods.md) | Mods + household game servers — **MOD-1/2 · SRV-1/2 APIs shipped** |
| 4h | [ambient-lighting.md](ambient-lighting.md) | Hyperion.ng / Home Assistant — LIGHT-1/2 **shipped** |
| 4i | [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md) | Jul 27 PM agent briefs + locked priority order |
| 4j | [name-resolution.md](name-resolution.md) | Folder → IGDB search variants · letter-bucket `scan_depth=2` |
| 5 | [ui.md](ui.md) | UI rebuild waves, BadgeStack, GameActionBar |
| 6 | [progress.md](progress.md) | What shipped / what's next |
| 7 | [social-av.md](social-av.md) | Household social + LiveKit waves |
| 8 | [emulation-coverage.md](emulation-coverage.md) | Wave 19 — systems below PS5 / Series |
| 9 | [security.md](security.md) | Security suite |
| 10 | [docs-map.md](docs-map.md) | Documentation inventory & gaps |

Member free-store claims: [../user/free-games.md](../user/free-games.md) (Wave 18).

## Stance (short)

- **In scope:** scan/recognition, freshness, ops health, API/tokens, playtime, collections, companion lifecycle, ownership sync (register-only), free-store claim feed (deeplink-only), household social, optional LiveKit, in-app support → GitHub
- **Out of scope:** Discord bots/webhooks; bundled torrent/debrid marketplace; DRM store download/install queues; always-on paid LLM inside Flask
- **Optional:** feature-flagged *arr/debrid, LiveKit profile, OIDC, AI assist

## Related code

- Package: `gametheca/`
- Member SPA: `frontend/member-app/`
- Admin SPA: `frontend/admin-app/` (hybrid with Jinja forms)
- Runbooks: `docs/runbooks/` · Guides: `docs/user/`, `docs/admin/`
- Docs sync skill: `.cursor/skills/docs-sync/`
- Desktop: `clients/desktop/` · Headset clients notes: `clients/quest/` (Quest = one seat; see [headset-vr.md](headset-vr.md))
