# Android APK · (headset VR → see headset-vr.md)

**Date:** 2026-07-27  
**Status:** Strategy lock — **APK** focus here; **headset/VR product** moved to [headset-vr.md](headset-vr.md) (SteamVR/PSVR2 first-class; Quest = friend seat)  
**Audience:** PM · Desktop · Ops · UI/UX  
**Related:** [headset-vr.md](headset-vr.md) · [controller-input.md](controller-input.md) · [thin-client.md](thin-client.md) · [gow-remote-play.md](gow-remote-play.md) · `ENABLE_VR_BROWSE` · `/vr`

---

## Product question

1. How should household members get a **native-feeling Android install** (phone / tablet / sideloaded Quest)?  
2. Headset / VR depth → **[headset-vr.md](headset-vr.md)** (not Quest-only).

---

## Locked defaults

| Default | Value |
|---|---|
| Play store / Meta Store listing | **Out** for 1.0 (sideload / LAN only) |
| Windows-style code signing for Android | **Optional later**; unsigned debug/release APK OK for household |
| Separate Unity/Godot / OpenXR VR app | **Out** unless explicitly funded post-1.0 |
| Download/install on phone or standalone HMD | **Out** — thin / VR seats stay connect-only |
| Real PC game play away from the PC | Prefer **Moonlight → Sunshine/GOW host** |
| PC VR owner (PSVR2/SteamVR) play | Prefer **local companion + Big Picture** on that PC |

---

## Android APK — recommended path

### Ranked options

| Rank | Approach | Fit | Cost | Verdict |
|---|---|---|---|---|
| **1** | **Tauri 2 Android thin flavor** | Thin scopes, Friends webview | Medium | **Primary phone/tablet APK** |
| **2** | **Capacitor WebView wrapper** | Quest sideload if PWA fails | Low–medium | **Fallback only** |
| **3** | **PWA Add to Home** | Quest / Android browsers | Lowest | **Standalone seats** |
| **4** | TWA / Play Store | HTTPS + asset links | Medium | Defer |
| **5** | React Native / Flutter | Dual UI | High | **Reject** |

### Build sketch (when wave opens)

```text
cd clients/desktop
npm run build:thin
npx tauri android init
npx tauri android build --apk
```

### Quest-specific APK note

Standalone **PWA** first (`clients/quest/README.md`). Capacitor APK only if PWA fails. PC VR owners should **not** be pushed toward Quest APK.

---

## VR ladder

See **[headset-vr.md](headset-vr.md)**. Controllers: **[controller-input.md](controller-input.md)**.

---

## Sequencing (APK only)

| ID | Priority | Owner | Outcome |
|---|---|---|---|
| **APK-0** | P2 | Desktop | Spike Tauri Android thin |
| **APK-1** | P2 | Desktop + QA | Unsigned thin APK + install doc |
| **APK-Q** | P3 | Desktop | Capacitor Quest wrapper if PWA fails |

Do **not** block 1.0.0 on APK.
