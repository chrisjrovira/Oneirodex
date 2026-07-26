# GameTheca Product Roadmap

**Date:** 2026-07-23 · **Updated:** 2026-07-26  
**Horizon:** ~12 months from baseline  
**Sources:** `competitive.md`, `features.md`, `ui.md`

## Near-term program (Jul 26) — Systems + Admin SPA

Member chrome is largely locked: top nav, Systems hub, green glass B+C (`#2fd67b`). Next execution track is **React admin SPA** (shell → migrate all Jinja admin surfaces → verify), after brand/docs waves on the program board canvas:
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`

See [progress.md](progress.md) for Jul 26 status.

## Product north star

Become the best **self-hosted, multi-user, DRM-free game library & distribution platform** for homelabs — stronger than GameVault/Drop on **scan/recognition/freshness/ops**, competitive on **clients, playtime, auth, and polish**.

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
- Import bridges (Playnite / GameVault)  
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

## Explicit non-goals (12 months)

- Heroic-style Epic/GOG/Amazon **DRM download / install** pipelines (ownership *registration* is allowed)  
- Hydra-style embedded torrent/debrid marketplace  
- Becoming a general anime/manga manager  
- Full LaunchBox commercial frontend clone

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
| Scope explosion chasing every competitor | Stick to in-scope list; quarterly kill list |
| Legal perception of *arr module | Optional, BYO indexers, clear ownership framing |
| UI rewrite stalls features | Waves; ship usability wins early |
| Client AV false positives | Code signing; transparent open builds |
| IGDB API changes | Provider abstraction + secondary sources |

## Review cadence

- Monthly product review against this roadmap  
- Re-score competitor matrix each quarter  
- Kill or defer any P2/P3 item that didn’t get user demand signals
