# GameTheca Product Roadmap

**Date:** 2026-07-23 · **Updated:** 2026-07-27  
**Horizon:** ~12 months from baseline  
**Sources:** `features.md`, `ui.md`, `v1-readiness.md` (official 1.0.0 gate)

## Near-term program (Jul 27) — 0.2.0 polish → official 1.0.0

**Decision:** keep-and-enhance (no stack rewrite). Gate board: [v1-readiness.md](v1-readiness.md).

Member chrome is largely locked. Parallel tracks: **v1 caveats** (health probes, CI, Ops near-realtime, migrations/pins) · **Admin SPA** progressive Jinja→React · operator-owned WASM/Authentik/Hub/Unraid (desktop stays unsigned — no cert purchase).

Program board: [progress.md](progress.md).  

See [progress.md](progress.md) for Jul 27 status. New team seat: `agent-ops`.

## Product north star

Become the best **self-hosted, multi-user, DRM-free game library & distribution platform** for homelabs — strong on **scan/recognition/freshness/ops**, competitive on **clients, playtime, auth, and polish**.

## Themes

| Theme | Outcome |
|---|---|
| A Foundation | API, realtime, design system |
| B Parity | Playtime, RBAC, collections, health |
| C Clients | Desktop companion + Install/Update/Uninstall CTAs + Big Picture |
| D Trust | OIDC, audits, Unraid/Docker reliability |
| E Automation | Wishlist + optional *arr module |
| F Emulation | Profiles, archives, saves |
| G Polish | Providers, i18n, imports, AI optional, title-card badge system |

## Quarterly roadmap (indicative)

### Q1 — Foundation + visible polish
- OpenAPI + API tokens  
- WebSocket events for scan/download  
- UI Wave 0–1 (design system, library/details)  
- **Title-card badge system v1** (Netflix/Roku-style overlay; default bottom-left; collision-aware)  
- Theme picker with swatches + **icon packs** (orthogonal CSS packs)  
- Library health score v1  
- Docs/runbooks pack (see `docs-map.md`)  
- Docker/Unraid hardening follow-through

### Q2 — Peer parity
- Playtime sessions  
- Collections + news/announcements  
- Updates inbox (freshness + calendar)  
- RBAC v1 + parental library scopes  
- Multi-version download selector  
- **Lifecycle action bar on game details:** Download · Install · Update · Uninstall (web shows state; client executes)  
- **Badge taxonomy expansion:** New import · New update · New release · Owned · Freshness OUT/~  
- Admin Recognition hub (UI Wave 3 start)

### Q3 — Clients
- Windows companion client (download/extract/**install**/launch DRM-free)  
- Install manifests + playtime sync from client  
- **Client-backed Install / Update / Uninstall** wired to the same CTA component as web  
- Big Picture / controller mode (badges + CTAs controller-friendly)  
- OIDC/SSO  
- Plugin provider interface + SteamGridDB plugin

### Q4 — Automation & depth
- Wishlist/requests  
- Optional indexer/download-client module (feature-flagged)  
- Emulator profiles + archive ROM support  
- Import bridges (Playnite)  
- i18n pass  
- Save sync (experimental)  
- Store **ownership sync** (register-only): Epic/GOG/Amazon/Steam owned titles → per-user personal library marks/matches; **no** store downloads

## Milestone checklist

- [x] M1: OpenAPI published; TS client generated  
- [x] M2: React library is default browse path  
- [x] M3: Playtime live in UI  
- [x] M3b: Title-card badges v1 (collision-aware, bottom-left default)  
- [x] M4: Desktop client public beta with Install/Update/Uninstall  
- [x] M5: OIDC works with Authentik  
- [x] M6: Wishlist GA  
- [x] M7: *arr module beta behind flag  
- [x] M8: Emulation profiles GA  
- [x] M9: Store ownership sync (register-only; no DRM download path)

## Current focus (12 months)

What we are building toward, in order. This section deliberately says what is
**in** rather than declaring anything permanently out — scope calls change, and
a roadmap that forecloses is harder to revise than one that prioritises.

- A game library that identifies what is actually on disk, better than anything else does
- Household access: invites, parental ACL, spaces with text and voice
- Play where it is convenient (browser) and where it is right (companion)
- A storefront-feeling Discover that curates from on-box signals only

Anything not listed is **unscheduled, not refused**. Where we have chosen not to
build something yet, the reasoning and the conditions that would change it live
in the private working doc (`docs/_private/scope-decisions.md`) rather than as a
public "never".

## Dependency graph (simplified)

```
OpenAPI ──► Desktop client ──► Install / Update / Uninstall
   │              │
   └─► Plugins    └─► Playtime sync
UI design system ──► Library cards + BadgeStack + ActionBar
Health + Freshness ──► Updates inbox + badge signals
RBAC ──► Parental + Collections ACL
Wishlist ──► (*optional) Indexer module
```

## Risk register

| Risk | Mitigation |
|---|---|
| Scope explosion chasing every peer feature | Stick to in-scope list; quarterly kill list |
| Legal perception of *arr module | Optional, BYO indexers, clear ownership framing |
| UI rewrite stalls features | Waves; ship usability wins early |
| Client AV false positives | Accepted on unsigned builds; transparent open builds — no code signing |
| IGDB API changes | Provider abstraction + secondary sources |

## Review cadence

- Monthly product review against this roadmap  
- Revisit backlog priorities each quarter  
- Kill or defer any P2/P3 item that didn’t get user demand signals
