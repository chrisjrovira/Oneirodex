# Remote play / Games on Whales — feature guide

**Date:** 2026-07-27  
**Status:** Research + feature guide — **in 1.0 scope** (GOW-1/GOW-2; no 1.1 track)  
**Audience:** PM · Backend · Ops · Desktop · Docs  
**Upstream:** [Games on Whales](https://games-on-whales.github.io/) · [Wolf](https://github.com/games-on-whales/wolf) (Moonlight streaming) · Sunshine as simpler single-user alternative  
**Related:** [thin-client.md](thin-client.md) · desktop companion · LiveKit social · [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md)

---

## Locked (Jul 27 PM)

| Decision | Stance |
|---|---|
| GOW-1 / GOW-2 | **Shipped in 1.0** — admin host + Moonlight CTA |
| Desktop stub | “Copy Moonlight host” CTA on game details (web); desktop may mirror later |

## Shipped (GOW-1 / GOW-2)

| Piece | Location |
|---|---|
| Admin UI | `/admin/remote_play` — Sunshine/Wolf URLs, hints, enable toggle |
| Env | `ENABLE_REMOTE_PLAY=false` (default), `SUNSHINE_BASE_URL`, `WOLF_BASE_URL`, hint vars |
| Member API | `GET /api/remote-play/status` |
| Admin API | `GET` / `PUT /api/admin/remote-play/config` |
| Member UI | `GameActionBar` → **Play via Moonlight** (copy host + hints) |
| Plugin | `remote_play.moonlight` |

LAN URLs: `ALLOW_PRIVATE_LAN_URLS=true`. No Wolf/GOW in GameTheca image.

---

## Capability fit

| Capability | GOW/Wolf pattern | GameTheca fit |
|---|---|---|
| Multi-user stream from one host | Moonlight clients | Optional **BYO stream host** link from library/party |
| Headless virtual desktops | Supported upstream | Ops runbook — not in GT container |
| Dockerized Steam / RetroArch / apps | Supported upstream | Point game “Play remote” at Wolf app id |
| Co-op / shared room + PIN | Supported upstream | Map to household **party** + invite |
| Gyro / DualSense inputs | Supported upstream | Document client requirements |
| GPU encode split (iGPU encode / dGPU play) | Supported upstream | Ops Unraid note |
| Fenrir / k8s multi-Wolf | Later | Out of 1.0 |

## Product stance

- GameTheca does **not** vendor Wolf/GOW into the app image.  
- **Integrate:** admin registers a Wolf/Sunshine base URL + apps; members get **Play via Moonlight** / deep link / copy host+PIN.  
- Companion remains local install; remote play is **optional parallel path**.  
- Sunshine (single-session) = simpler first connector; Wolf = multi-user stretch.

## Waves

| ID | Outcome | 1.0? |
|---|---|---|
| GOW-0 | This research guide | Done |
| GOW-1 | Admin “Remote play host” settings (Sunshine or Wolf URL, token) | **Done** |
| GOW-2 | Game details CTA: Open in Moonlight / copy connection | **Done** |
| GOW-3 | Party invite includes remote-play PIN when host online | After GOW-1/2 |
| GOW-4 | Compose profile docs for Wolf sidecar (operator-owned GPU) | Docs |

## Not in this slice

*Scope note: these are **not in this slice**, not refused. Reasoning and
reopen conditions live in the private working doc.*

- Replacing Moonlight with in-browser WebRTC game stream in 1.0  
- Bundling Steam or game containers inside GameTheca  

## UX priorities (when built)

1. Multi-seat honesty (“this title streams from host X”)  
2. Party + remote play together  
3. RetroArch-in-container as alternative to local companion for light systems  
4. Headless / no dummy plug — ops education only  
