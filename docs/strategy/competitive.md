# GameTheca Competitive Gap Analysis

**Date:** 2026-07-26 (Wave 7)  
**Scope:** Compare GameTheca against **50+** products spanning self-hosted libraries, *arr automation, debrid, desktop launchers, emulation stacks/frontends, scrapers, WASM emulators, and cheat/assist tools.  
**Positioning:** Self-hosted multi-user DRM-free game library + download server with companion client, optional BYO acquisition (*arr/debrid), browser + native emulation, and single-player assists. **Not** a bundled pirate indexer or DRM store client.

## Competitor catalog (50+)

| # | Product | Category | Steal for Wave 7 | Ignore / out of scope |
|---|---|---|---|---|
| 1 | [GameVault](https://gamevau.lt/) | Self-hosted library | Progress social, plugins, OAuth polish | Closed client UX clone |
| 2 | [Drop OSS](https://droposs.org/) | Self-hosted library | Store-like browse, news, SSO | GiantBomb-only metadata |
| 3 | [Retrom](https://github.com/jmberesford/retrom) | Self-hosted emu library | Emulator profiles per client, EmulatorJS path | gRPC-only clients |
| 4 | [RomM](https://romm.app/) | Self-hosted ROM library | Platform folders, ES-DE/Pegasus export | Replacing our PC catalog |
| 5 | [Drathos](https://github.com/Valt1-0/drathos-backend) | Self-hosted library API | Mod tracking, Socket.IO events | Mongo-only stack |
| 6 | [MyGamesAnywhere](https://github.com/GreenFuze/MyGamesAnywhere) | Local-first launcher | Canonical merge, provenance | Desktop-only product |
| 7 | Loom / similar FOSS hosts | Self-hosted library | Simple multi-user ACL patterns | Incomplete projects |
| 8 | [Playerr](https://github.com/Maikboarder/Playerr) | Game *arr | Indexer → client → hardlink UX | Full PVR rewrite |
| 9 | [Gamarr](https://github.com/JeremiahM37/gamarr) | Game/ROM *arr | Scoring + wishlist hooks | Separate product |
| 10 | [Repackarr](https://github.com/Yakrel/repackarr) | Repack watcher | Newer-repack detection | Bot-only UX |
| 11 | [Prowlarr](https://prowlarr.com/) | Indexer manager | BYO indexer hub (already) | Shipping indexers |
| 12 | [Jackett](https://github.com/Jackett/Jackett) | Indexer proxy | Fallback search (already) | — |
| 13 | [Flaresolverr](https://github.com/FlareSolverr/FlareSolverr) | CF bypass helper | Optional ops note | Bundling |
| 14 | [Radarr](https://radarr.video/) | *arr pattern | Quality profiles UX | Movies domain |
| 15 | [Sonarr](https://sonarr.tv/) | *arr pattern | Wanted queue UX | TV domain |
| 16 | [qBittorrent](https://www.qbittorrent.org/) | Download client | Primary torrent client (already) | — |
| 17 | [Transmission](https://transmissionbt.com/) | Download client | Wave 7+ connector candidate | Priority over qBit |
| 18 | [Deluge](https://deluge-torrent.org/) | Download client | Optional connector later | — |
| 19 | [SABnzbd](https://sabnzbd.org/) | Usenet client | Later NZB path | Core Wave 7 |
| 20 | [NZBGet](https://nzbget.com/) | Usenet client | Later NZB path | Core Wave 7 |
| 21 | [Real-Debrid](https://real-debrid.com/) | Debrid | Magnet → cached HTTP | Hosting RD |
| 22 | [AllDebrid](https://alldebrid.com/) | Debrid | Second provider | — |
| 23 | [Premiumize](https://www.premiumize.me/) | Debrid | Optional third | — |
| 24 | [TorBox](https://torbox.app/) | Debrid | Optional modern API | — |
| 25 | [Playnite](https://playnite.link/) | Desktop aggregator | Themes, fullscreen, plugins | Windows-only shell |
| 26 | [LaunchBox](https://www.launchbox-app.com/) | Emulation frontend | Big Box / 10-foot UX | Closed commercial DB |
| 27 | [Heroic](https://heroicgameslauncher.com/) | Epic/GOG/Amazon | Ownership lists | DRM download queues |
| 28 | [Legendary](https://github.com/derrod/legendary) | Epic CLI | Auth patterns | Epic DRM |
| 29 | [Rare](https://github.com/DumRacs/rare) | Epic GUI | — | DRM |
| 30 | [Bottles](https://usebottles.com/) | Wine runner | Launch prefixes idea | Linux-only product |
| 31 | GOG Galaxy | Desktop store | Library sync ideas | Closed |
| 32 | [Hydra](https://github.com/hydralauncher/hydra) | Torrent launcher | Social + acquire UX cues | Bundled torrents/debrid marketplace |
| 33 | [Monarch](https://github.com/Monarch-Launcher/Monarch) | Aggregator | Quicklaunch | Steam hotkey focus |
| 34 | [Batocera](https://batocera.org/) | Emulation OS | System taxonomy | Full OS replace |
| 35 | [RetroBAT](https://www.retrobat.org/) | Emulation OS (Win) | Windows emu stack | — |
| 36 | [EmuDeck](https://www.emudeck.com/) | Emulation stack | Steam Deck presets | Deck-only |
| 37 | [RetroPie](https://retropie.org.uk/) | Emulation stack | Core/platform mapping | Pi-only |
| 38 | [Lakka](https://www.lakka.tv/) | LibreELEC + RA | Libretro-first | Appliance OS |
| 39 | [Recalbox](https://www.recalbox.com/) | Emulation OS | Kid-friendly modes | — |
| 40 | JELOS / ROCKNIX | Handheld OS | Handheld presets | Device firmware |
| 41 | [ES-DE](https://www.es-de.org/) | Emulation frontend | Collection + scrape UX | Replacing our SPA |
| 42 | EmulationStation | Frontend | gamelist.xml | Legacy |
| 43 | [Pegasus](https://pegasus-frontend.org/) | Frontend | metadata.pegasus.txt | — |
| 44 | [Attract-Mode](http://attractmode.org/) | Frontend | Attract / BP inspiration | — |
| 45 | [Steam ROM Manager](https://github.com/SteamGridDB/steam-rom-manager) | Steam shortcuts | Non-Steam ROM inject | Steam dependency |
| 46 | Daijisho | Android frontend | Mobile library UX | Android-first |
| 47 | Beacon / similar | Frontend | Lightweight launch | — |
| 48 | [Skyscraper](https://github.com/muldjord/skyscraper) | Scraper | Frontend export formats | CLI-only product |
| 49 | ScreenScraper | Metadata DB | ROM metadata | License terms |
| 50 | [IGDB](https://www.igdb.com/) | Metadata DB | Already primary | — |
| 51 | [SteamGridDB](https://www.steamgriddb.com/) | Art DB | Cover/hero art | — |
| 52 | LaunchBox Games DB | Metadata | Crowd metadata ideas | Closed |
| 53 | Libretro DB / .cht packs | Cheat DB | `.cht` format for Wave 7 | Redistributing copyrighted packs |
| 54 | [WebRetro](https://github.com/BinBashBanana/webretro) | WASM emu | Already vendored | — |
| 55 | [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS) | WASM emu | Alternate browser path | Dual-maintain |
| 56 | [js-dos](https://js-dos.com/) | DOS WASM | PCDOS playability | — |
| 57 | [Ruffle](https://ruffle.rs/) | Flash WASM | Niche Flash games | Core library |
| 58 | [Wand](https://wand.com/) (ex-WeMod) | Assists / cheats | Overlay UX, assist collections | Multiplayer cheats |
| 59 | [Cheat Engine](https://www.cheatengine.org/) | Memory editor | Trainer maker concepts | Shipping CE |
| 60 | [OpenForge](https://github.com/) | FOSS trainers | Config-driven packs | — |
| 61 | [Squalr](https://squalr.com/) | Memory editor | Scripted assists | — |
| 62 | GameConqueror / scanmem | Linux cheats | Linux companion later | — |
| 63 | ArtMoney | Memory editor | Classic trainer UX | Proprietary |
| 64 | Bit Slicer | macOS trainer | macOS later | — |
| 65 | RetroArch cheats | Libretro cheats | Primary emu cheat path | — |
| 66 | GameGuardian | Android cheats | Mobile later | Root tooling |
| 67 | [LunaBox](https://github.com/Saramanda9988/LunaBox) | VN tracker | Playtime cards | VN-only |
| 68 | [Bakabase](https://github.com/anobaka/Bakabase) | Otaku manager | Health scoring, layouts | Anime/manga focus |
| 69 | [tonkatsu_box](https://github.com/hacan359/tonkatsu_box) | Cross-media | Boards / tier lists | — |
| 70 | [VRHub](https://github.com/LeGeRyChEeSe/VRHub) | Quest client | Headset browse | Native APK now |

**Count:** 70 entries (≥50 requirement met).

## New competitors spotted (post–Wave 11 review)

| # | Product | Category | Steal next | Ignore |
|---|---|---|---|---|
| 71 | [RetroArr](https://retroarr.app/) | Game *arr + emu | NZBGet + EmulatorJS save UI + SignalR live scan badge + process-isolated plugins | Claiming full PVR rewrite overnight |
| 72 | [Gaseous](https://github.com/gaseous-project/gaseous-server) | ROM manager | Alternate WASM player path | Dual-maintain EmulatorJS |
| 73 | [Sail Launcher](https://github.com/) | Desktop launcher | aria2 + debrid UX cues | Bundled pirate marketplace |
| 74 | [Gamepile](https://github.com/) | Steam library vault | Activation key vault ideas | Steam DRM queues |
| 75 | Argosy / Freegosy (RomM clients) | Mobile / desktop clients | Official companion plugin model | Replacing Tauri companion |
| 76 | Hydra Classics (PS1–3) | ROM + native emu | DuckStation/PCSX2/RPCS3 launch profiles | Hydra download marketplace |
| 77 | MyGamesAnywhere deepen | Local-first merge | Provenance / source-backed pages | Desktop-only product |

## Gap status snapshot (Jul 26 post-review)

| Area | Status |
|---|---|
| *arr + quality + hardlink | Shipped (flagged) — thin Acquire UI |
| Debrid connectors | Shipped (RD/AD/Premiumize/TorBox) |
| Store search → library bind | Shipped MVP |
| WebRetro cores | Shipped; **cloud save = placeholder**; cheats = sessionStorage |
| Admin React bodies | **Hybrid** — HubPages + Jinja forms |
| Big Picture | MVP + kid CSS |
| Parental ACL | Models yes; **ASGI ROM/trailers/playtime holes fixed in review pass** |
| Plugins | Static registry only |
| OpenAPI | **Stale** vs Waves 7–11 |
| Unraid smoke | Operator |
| New: RetroArr-class NZBGet + live scan UX | Missing |
| New: EmulatorJS alternate / real save sync | Missing |
| New: RomM Playnite/handheld plugins | Missing |

## Wave 7 bets (from this map)

1. **BYO acquisition** — Playerr/Gamarr/Hydra UX cues on top of Prowlarr + qBit + Real-Debrid/AllDebrid (no embedded indexers).  
2. **Store-hit binding** — Ownership/Heroic-style match of Steam/GOG search → library UUID + wanted queue (Sonarr-like).  
3. **Emulator depth** — Retrom/RomM/WebRetro: more good-standing libretro cores, BIOS, cloud saves wired.  
4. **Assists** — Wand overlay UX + RetroArch `.cht` for ROMs; single-player / offline policy.  
5. **Big Picture** — Attract-Mode / LaunchBox Big Box / Playnite fullscreen cues.  
6. **Admin SPA** — GameVault-like ops density without abandoning Flask forms overnight.

## Explicit non-goals (unchanged)

Heroic DRM download queues · Hydra-as-product (bundled torrents/debrid marketplace) · LaunchBox closed frontend · Shipping Cheat Engine · Redistributing copyrighted ROM/cheat databases.
