# Ambient lighting — Hyperion.ng & Home Assistant

**Date:** 2026-07-27  
**Status:** Feature guide — **opt-in; in 1.0 scope** (LIGHT-1/LIGHT-2; no 1.1 track)  
**Audience:** Backend · Ops · UI · Docs  
**Upstream:** [hyperion.ng](https://github.com/hyperion-project/hyperion.ng) · [JSON API](https://api.hyperion-project.org/) · [HA Hyperion integration](https://www.home-assistant.io/integrations/hyperion/)  
**Related:** Big Picture · LiveKit party · Activity presence · [pm-dispatch-2026-07-27.md](pm-dispatch-2026-07-27.md)

---

## Locked (Jul 27 PM)

| Decision | Stance |
|---|---|
| LIGHT-1 / LIGHT-2 | **Shipped in 1.0** — Hyperion JSON-RPC + HA REST on play start/stop |
| Default | `ENABLE_AMBIENT_LIGHTING=false` (opt-in) |
| HA caller | LIGHT-2 follows LIGHT-1; never block play launch |

---

## Problem

Big Picture / party / play sessions feel richer when room lights react (bias lighting, team color, “now playing” accent). Operators already run Hyperion.ng and/or Home Assistant; GameTheca has no hooks.

---

## Product definition

**Ambient bridge** (admin opt-in):

1. **Hyperion.ng direct** — JSON-RPC: set color / effect / clear priority when play starts/stops or party voice joins.  
2. **Home Assistant** — REST/WS call service (`light.turn_on`, scenes) or rely on HA’s Hyperion integration (GT → HA → lights).  
3. Prefer **HA as hub** when operator already has it; Hyperion direct for LED-only households.

| Mode | When |
|---|---|
| `lighting.provider=off` | Default |
| `hyperion` | `HYPERION_URL` + optional token; priority channel |
| `homeassistant` | `HA_URL` + long-lived token; entity/scene ids |

### Triggers (MVP)

| Event | Action |
|---|---|
| Play session start | Accent from game dominant color **or** fixed admin color |
| Play session stop | Clear priority / scene off |
| Big Picture enter/exit | Dim / restore scene |
| Party voice lobby join | Optional “party” effect |
| Child account | No lighting control (ignore) |

### In scope

- Admin config + Test button  
- Fire-and-forget async (never block play launch)  
- Cover-derived palette optional (Pillow sample)  

### Out of scope

- Embedding Hyperion in GameTheca image  
- Controlling arbitrary IoT without admin allowlist  
- Video grabber / USB capture inside GT  

---

## Waves

| ID | Outcome | 1.0? |
|---|---|---|
| LIGHT-0 | Guide | Done |
| LIGHT-1 | Hyperion JSON client + play start/stop hooks | **Done (1.0)** |
| LIGHT-2 | HA service caller | **Done (1.0)** |
| LIGHT-3 | Admin UI + Big Picture toggle “sync lights” member pref | After LIGHT-1/2 |
| LIGHT-4 | Cover color sampling | Polish |

## Security

- Tokens in env/DB encrypted at rest pattern like other connectors  
- `validate_connector_http_url` + LAN allow flag  
- No member-supplied HA URLs  

## Success

- With provider off: zero network calls  
- With Hyperion up: LEDs change within ~1s of play start in lab  
