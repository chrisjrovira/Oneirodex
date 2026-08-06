# Headsets · SteamVR · VR browse (not Quest-only)

**Date:** 2026-07-27  
**Status:** Strategy lock (relock — PC SteamVR / PSVR2 first-class; Quest = friend seat)  
**Audience:** PM · UI/UX · Ops · Docs · Desktop  
**Related:** [controller-input.md](controller-input.md) · [gow-remote-play.md](gow-remote-play.md) · [thin-client.md](thin-client.md) · [android-apk-vr.md](android-apk-vr.md) · [store-metadata-identify.md](store-metadata-identify.md) (Quest Store identify / ownership register-only) · `ENABLE_VR_BROWSE` · `/vr`

> Android APK paths stay in [android-apk-vr.md](android-apk-vr.md). This doc owns **headset / VR product**.

---

## Product question

VR must work for **more than Meta Quest**. Household example: operator owns **PSVR2 via Steam** (SteamVR); friends own Quest. GameTheca should not read as a Quest app.

---

## Headset matrix (locked)

| Seat | Hardware | How you use GameTheca | Play story |
|---|---|---|---|
| **PC VR owner (primary for many operators)** | **PSVR2 + SteamVR**, Index, Vive, Pico PC VR, etc. | Browser on **desktop** (second monitor / SteamVR dashboard overlay / Virtual Desktop browser) → `/vr` or **Big Picture**; optional **thin** shell on same PC for browse/social only | Native SteamVR titles on that PC; DRM-free flatscreen via **full** companion (thin has **no** install pipeline); optional **Moonlight** only when streaming *from another* host |
| **Standalone friend** | Quest 2/3/Pro, Pico standalone | Headset **browser PWA** → `/vr` | Browse + social; play via **Moonlight → household PC** or “ask companion PC” |
| **Couch non-VR** | TV + gamepad | Big Picture in TV browser | Local companion / WebRetro |
| **Phone/tablet** | Android thin APK / PWA | Thin shell | No local install pipeline |

**Rename mental model:** `/vr` = **headset-friendly browse** (large type, big tap), not “Quest exclusive.” PWA install remains useful on Quest; on SteamVR the usual path is **normal Chromium/Edge on the PC** pointed at the same `/vr` or Library.

---

## PSVR2 / SteamVR specifics

1. **You are already on the gaming PC** — Moonlight is secondary; companion + Big Picture matter more.  
2. Open GameTheca in a desktop browser window placed on a monitor you can see in passthrough / theater, **or** use SteamVR’s overlay/dashboard browser if available on your SteamVR build.  
3. **Sense controllers** → SteamVR games. For GameTheca UI, use **Xbox/DualSense/Steam Deck controls** via Big Picture, or mouse in desktop browser.  
4. Tag library titles with the existing **VR** badge when metadata says VR; `/vr` catalog can later filter `is_vr` more aggressively for “play on this headset” lists (VR-FILTER).  
5. Do **not** require Meta accounts or SideQuest for the PC VR owner path.

---

## Ladder (updated)

| Level | Experience | 1.0? |
|---|---|---|
| **L0** | `/vr` browse API + page | Shipped |
| **L1a** | Docs: SteamVR / PSVR2 / desktop browser path | **Yes — now** |
| **L1b** | Docs: Quest PWA path (friends) | Yes |
| **L2** | Controller-friendly `/vr` + BP legend | Nice (see controller-input) |
| **L3** | Friends / voice in browser while in headset theater | Stretch |
| **L4** | Moonlight CTA on `/vr` detail (Quest / away-from-PC seats) | Yes for away seats |
| **L4b** | “Open in Big Picture” / “Play on this PC” for SteamVR seats | Yes |
| **L5** | WebRetro in headset browser | Optional / honest “poor” |
| **L6–L7** | WebXR room / Unity client | **Out** |

---

## Backlog

| id | priority | owner | outcome |
|---|---|---|---|
| **VR-PC-1** | P1 | Docs | User + ops: PSVR2/SteamVR how-to (desktop browser + BP) |
| **VR-PC-2** | P1 | Docs | Reframe `clients/quest/` README → headset clients; Quest = one seat |
| **VR-FILTER** | P2 | UI + Backend | `/vr` default or chip: VR-flagged titles first |
| **VR-L4b** | P1 | UI | Detail CTAs: Big Picture · companion Play · Moonlight (context-aware) |
| **VR-L2** | P2 | UI | Pad/focus on `/vr` (shared with PAD-VR) |

---

## Not in this slice

*Scope note: these are **not in this slice**, not refused. Reasoning and
reopen conditions live in the private working doc.*

- Official Meta Store / SteamVR store app listing for 1.0  
- Shipping a native OpenXR GameTheca shell  
- Promising Sense-controller SPA navigation  
- Quest-only marketing or docs  
- Install / Update / Play pipeline on **thin** or headset browser seats — lifecycle stays on the **full** desktop companion  
- Shipping an Android / Quest APK as the primary VR path (spike only — [android-apk-vr.md](android-apk-vr.md))
