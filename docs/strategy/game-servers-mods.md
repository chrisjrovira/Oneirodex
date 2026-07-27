# Game mods, extensions & household game servers

**Date:** 2026-07-27  
**Status:** Feature guide — mods deepen existing `ENABLE_MOD_TRACKING`; **servers = admin/ops only**  
**Audience:** Backend · Ops · UI/UX · Docs · Game Master  
**Related:** `gametheca/utils/game_mods.py` · [challenge-bypass.md](challenge-bypass.md) · social party

---

## Mods & extensions

### Today

`ENABLE_MOD_TRACKING` exists — track/associate mods with games (library metadata). Depth still thin vs full mod managers.

### Steal / build

| Capability | Notes |
|---|---|
| Mod registry per game | Name, version, source URL, enabled flag, load order |
| Companion apply | Stage files under install dir (path-safe); Windows/Linux |
| Browser note | WebRetro cannot load arbitrary PC mods — honesty badges |
| Curse/Modrinth/Thunderstore | **BYO links only** — no scrape marketplace; operator pastes URLs |
| Extensions | Emulator cores, shader packs, cheat packs — tie to existing cheat/patch paths |

### Waves

| ID | Outcome | Owner |
|---|---|---|
| MOD-1 | Model + API CRUD for game mods (admin + librarian) | Backend |
| MOD-2 | Details UI: mod list + enable | UI |
| MOD-3 | Companion “Apply mod pack” command | Desktop |
| MOD-4 | Docs + parental: child cannot enable arbitrary mods | Docs / security |

---

## Household game servers (ops/admin only)

**Goal:** Admin can stand up **friend-play servers** (Minecraft, Valheim, Terraria, dedicated Source, etc.) from Ops — not a public game-hosting SaaS.

| Principle | Stance |
|---|---|
| Who configures | **Admin / Ops only** |
| Who joins | Household members + invited friends (ACL) |
| Runtime | BYO Docker/Compose on Unraid — GameTheca stores **metadata + links + health ping** |
| Not in GT image | Game server binaries stay operator images |

### MVP fields

- Display name, game UUID (optional), connect string / IP:port, Discord-free invite note  
- Compose project name / container id for status  
- `GET` health (TCP ping or HTTP) on Ops summary  
- Start/stop via **docker socket proxy** (optional, dangerous — flag `ALLOW_DOCKER_SERVER_CONTROL` default **false**)

### Waves

| ID | Outcome | 1.0? |
|---|---|---|
| SRV-0 | Guide | Done |
| SRV-1 | Admin registry of servers (CRUD + member-visible list) | Target 1.0 |
| SRV-2 | Ops health chips | With SRV-1 |
| SRV-3 | Docker control (start/stop) behind explicit flag | Post-1.0 OK |
| SRV-4 | Party “Join server” deep link | Nice |

### Non-goals

- Multi-tenant public hosting  
- Auto-billing  
- Bundled Minecraft jar in GameTheca image  

---

## Sequencing vs other streams

```text
MOD-1/2 ── parallel with ART / CH
SRV-1/2 ── after Ops summary stable (V1-OPS)
SRV-3    ── after 1.0 unless spike approved
```
