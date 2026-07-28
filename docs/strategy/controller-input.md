# Controllers · help · input

**Date:** 2026-07-27  
**Status:** Strategy + gap (Big Picture gamepad **partially shipped**; Help/FAQ thin)  
**Audience:** PM · UI/UX · Docs · Desktop  
**Related:** [android-apk-vr.md](android-apk-vr.md) · [ui.md](ui.md) · Big Picture · HelpPage · [faq.md](../user/faq.md)

---

## Product question

Have we thought about **controller support**, on-screen help, and remapping — for couch Big Picture, Steam Deck–class seats, and headsets (PSVR2 / Quest / etc.)?

**Short answer:** Partially. Big Picture already polls the Gamepad API (A/B/X/Y-style + D-pad/stick). Help and FAQ barely document it. `/vr` is large-tap, not pad-first. Steam Input / DualSense haptics / gyro are **not** in scope as a custom layer.

---

## What ships today

| Surface | Input | Help |
|---|---|---|
| **Big Picture** (`/big-picture`) | Keyboard arrows + `A`/Enter open, `D` download, `B` Attract, `Y` Friends, Esc; **Gamepad** via `navigator.getGamepads()` (south=confirm, west=download, east=attract, north≈Y friends) | Hint line in BP header only |
| Library / details / Chat | Pointer + keyboard; Command palette `Ctrl+K` | Help FAQ sections |
| `/vr` | Touch / pointer large targets | Quest README ops note |
| Desktop companion | Mouse/keyboard | Companion README |
| Browser play (WebRetro) | Per-core keyboard/gamepad (emulator) | browser-play docs |

---

## Locked defaults

| Default | Value |
|---|---|
| Custom Steam Input / DualSense SDK layer | **Out** — rely on browser Gamepad API + OS/Steam |
| Shipping a remapping UI for every page | **Out** for 1.0 — BP + documented map first |
| Controller-first as default for desktop mouse users | **Out** — Big Picture is opt-in |
| On-screen button legend | **In** for BP + VR browse (PAD-HELP) |
| HelpPage + FAQ controller section | **In** (PAD-DOCS) |

---

## Personas

1. **Couch / HTPC** — Xbox/DualSense on TV browser → Big Picture  
2. **Steam Deck / Legion Go** — SteamOS browser or thin client → BP  
3. **PSVR2 (SteamVR)** — flatscreen BP on PC monitor or SteamVR overlay browser; Sense controllers mostly for SteamVR games, not our SPA  
4. **Quest friend** — touch + optional Bluetooth gamepad in Quest Browser  
5. **Kid seat** — BP kid CSS; simpler legend (no Download if ACL blocks)

---

## Backlog

| id | priority | owner | outcome | DoD |
|---|---|---|---|---|
| **PAD-DOCS** | P1 | Docs + UI | Help + FAQ controller map | Xbox + DualSense labels; BP + Esc exit |
| **PAD-HELP** | P1 | UI/UX | On-screen legend toggle in Big Picture (`?` / Select) | Overlay with same map as docs; dismissible |
| **PAD-VR** | P2 | UI/UX | `/vr` focus rings + optional gamepad grid nav | Works with BT pad on Quest + keyboard on desktop VR browse |
| **PAD-CONSIST** | P2 | UI/UX | Align keyboard letters with gamepad face buttons in one table | No conflicting hints |
| **PAD-STEAM** | P3 | Docs | Note: Steam Big Picture / Steam Input can remap browser if launched from Steam | Ops/user one-pager |
| **PAD-A11Y** | P2 | UI/UX | Focus visible + reduce-motion respect in BP | Keyboard-only parity |

---

## Honest limits

- **PSVR2 Sense controllers** will not drive the GameTheca SPA unless the browser exposes them as a standard Gamepad (unreliable). Treat Sense as for **SteamVR titles**; use a normal pad or mouse/keyboard for our UI.  
- **WebRetro** cores have their own binds — link out, don’t duplicate.  
- **Companion install/play** stays mouse-first unless we later add a Deck skin.

---

## Sequencing

```text
PAD-DOCS + PAD-HELP  →  PAD-VR (with headset matrix)  →  PAD-A11Y
PAD-STEAM optional alongside SteamVR headset docs
```
