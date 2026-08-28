# Headset / VR clients (MVP)

GameTheca’s headset path is **browser-based** — not a Meta Store or SteamVR store app.

**Important:** This is **not Quest-only**. PC VR (e.g. **PSVR2 via SteamVR**, Index, Vive) uses a desktop browser on the gaming PC. Quest is the common *standalone friend* seat.

## Enable

```env
ENABLE_VR_BROWSE=true
```

Restart GameTheca, sign in, open `https://<host>/vr` (or LAN HTTP for lab).

## PC VR / SteamVR / PSVR2

1. Put on the headset; keep a desktop browser window visible (monitor, theater view, or SteamVR dashboard/overlay browser).
2. Open Library, **Big Picture**, or `/vr` on that PC.
3. Use an **Xbox / DualSense / Deck** controls for Big Picture — Sense controllers are for SteamVR titles, not the GameTheca site.
4. Play SteamVR games natively on this PC; use the desktop companion for DRM-free flatscreen installs.

See [controllers-and-vr.md](../../docs/user/controllers-and-vr.md).

## Standalone (Quest, etc.)

1. Open `/vr` while logged in.
2. Use the browser **Add to Home** / install prompt when available.
3. Large-tap browse only in this view (**no downloads**). For real PC games, use **Moonlight → household host** (see [controllers-and-vr.md](../../docs/user/controllers-and-vr.md)).

## Assets

| Path | Role |
|---|---|
| `/static/vr-manifest.webmanifest` | Web app manifest (handy on Quest) |
| `/vr/sw.js` (from `static/vr-sw.js`) | Service worker |
| `/vr` | Headset-friendly browse UI |

## Native APK / OpenXR app

Deferred. Phone/tablet thin APK and full headset matrix: local strategy notes; member guide [controllers-and-vr.md](../../docs/user/controllers-and-vr.md).
