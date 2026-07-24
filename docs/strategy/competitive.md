# GameTheca Competitive Gap Analysis

**Date:** 2026-07-24 (v0.1.0)  
**Scope:** Compare GameTheca against 15 reference products spanning self-hosted libraries, *arr automation, desktop launchers, trackers, and emulation frontends.  
**Positioning baseline:** GameTheca is a **self-hosted, multi-user web game library + download server** (catalog, metadata, scan, stream-zip download, invite/whitelist auth) with a companion desktop client. It is **not** a DRM store client, torrent indexer, or closed LaunchBox-style Windows frontend.

## Competitor map

| Product | Category | Closest to GameTheca? | Key takeaway |
|---|---|---|---|
| [GameVault](https://gamevau.lt/) | Self-hosted multi-user library | **Yes — primary peer** | Install client, playtime sync, RBAC, plugins, OAuth, progress social |
| [Drop OSS](https://droposs.org/) | Self-hosted “open Steam” | **Yes — primary peer** | Store UX, native clients, SSO/OIDC, news, GiantBomb/PCGW |
| [Retrom](https://github.com/jmberesford/retrom) | Self-hosted emulation library | Adjacent peer | Emulator profiles, EmulatorJS, Steam unify, gRPC clients |
| [Playerr](https://github.com/Maikboarder/Playerr) | Game *arr / PVR | Automation peer | Indexers + download clients + hardlinks + Steam sync |
| [Gamarr](https://github.com/JeremiahM37/gamarr) | Game/ROM *arr | Automation peer | Scoring, safety, GameVault/RomM hooks, wishlist |
| [Repackarr](https://github.com/Yakrel/repackarr) | Repack update bot | Automation niche | Watches qBit/Transmission for newer repacks |
| [Playnite](https://playnite.link/) | Desktop aggregator | UI/UX inspiration | Themes, plugins, fullscreen, playtime, store imports |
| [LaunchBox](https://www.launchbox-app.com/) | Emulation frontend | UI/UX inspiration | Big Box, crowd DB, EmuMovies, save management |
| [Heroic](https://heroicgameslauncher.com/) | Epic/GOG/Amazon client | Download path out of scope | Ownership-list ideas useful; no DRM download queue |
| [Hydra](https://github.com/hydralauncher/hydra) | Torrent/debrid launcher | Out of core scope (legal risk) | Social + torrent + debrid |
| [Monarch](https://github.com/Monarch-Launcher/Monarch) | Native aggregator | Out of core scope | Quicklaunch hotkey |
| [LunaBox](https://github.com/Saramanda9988/LunaBox) | VN tracker/stats | Inspiration | Playtime cards, AI reports, cloud backup |
| [Bakabase](https://github.com/anobaka/Bakabase) | Otaku media manager | Inspiration | Health scoring, AI tagging, custom layouts |
| [tonkatsu_box](https://github.com/hacan359/tonkatsu_box) | Cross-media tracker | Inspiration | Boards, tier lists, multi-source import |
| [VRHub](https://github.com/LeGeRyChEeSe/VRHub) | Quest client | Adjacent client idea | Headset-native install of self-hosted catalog |

## Gap status (2026-07-24)

### Closed or code-complete

| # | Feature | Status |
|---|---|---|
| 9 | *arr connectors | **Shipped** behind flag — Prowlarr/Jackett + qBittorrent |
| 11 | Release calendar | **Shipped** — IGDB `/api/calendar` + `/calendar` |
| 12 | Quality profiles | **Shipped** — preferred/blocked groups + size band scoring |
| 13 | Hardlink / storage helpers | **Shipped** — preview + gated apply |
| 16–18 | Emulation depth | **Shipped** — profiles, saves, zip + optional 7z, Fernet encrypt |
| 20 | VR/Quest browse | **Shipped (web)** — `/vr` + API; native client deferred |
| 22 | GiantBomb / PCGW | **Shipped** — provider plugins + search APIs |
| 25 | Stats share cards | **Shipped** — SVG playtime card |
| 27 | AI assist (Ollama) | **Shipped** — triage + doctor notes; no auto-apply |
| 28 | Custom detail-page layouts | **Shipped** — order/visibility |
| 29 | i18n | **Deeper** — es catalog + library-grid locale strings |

### Still open / deferred

| # | Feature | Priority | Notes |
|---|---|---|---|
| 4 | Live Authentik smoke | Ops | Code + LAN runbook ready; paste Client ID/Secret |
| 20b | Native Quest APK | P2 | PWA MVP shipped at `/vr` |
| — | Desktop signing cert | Ops | CI/Tauri hooks ready; needs purchased cert |
| — | Full rar archives | P3 | Zip + 7z done; rar optional |

### Shipped this ops wave

| Feature | Status |
|---|---|
| Local-without-SSO install copy | **Shipped** |
| AI auto-apply (gated rename) | **Shipped** — `ENABLE_AI_AUTO_APPLY` |
| arr→hardlink pipeline | **Shipped** — preview/apply, triple-gated |
| Desktop signing hooks | **Shipped** — runbook + workflow |
| Quest PWA MVP | **Shipped** — manifest + service worker |

### Explicitly out of scope (unchanged)

Heroic DRM download queues · Hydra torrent/debrid · LaunchBox closed Windows frontend · Monarch hotkey Steam launch · Bakabase anime/manga manager.

## Recommended next bets

1. **Operator:** paste Authentik Client ID/Secret for LAN smoke; buy Windows signing cert when distributing  
2. **Polish:** more locales / React coverage; rar if needed  
3. **Optional:** Meta Quest APK wrapper if PWA is not enough  

