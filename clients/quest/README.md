# Quest / headset client (MVP)

GameThecaâ€™s Quest path is an **installable PWA** around `/vr`, not a Meta Store APK.

## Enable

```env
ENABLE_VR_BROWSE=true
```

Restart GameTheca, sign in on the headset browser, open `https://<host>/vr` (or LAN HTTP for lab).

## Install on Quest browser

1. Open `/vr` while logged in.
2. Use the browser **Add to Home** / install prompt (Quest Browser supports PWAs for many sites).
3. Launch the installed shortcut for large-tap browse (catalog + detail; **no downloads** in this view).

## Assets

| Path | Role |
|---|---|
| `/static/vr-manifest.webmanifest` | Web app manifest |
| `/vr/sw.js (sourced from static/vr-sw.js)` | Service worker (shell + `/api/vr` GET cache) |
| `/vr` | Browse UI |

## Native APK (deferred)

A Capacitor/WebView wrapper that points at your GameTheca URL can be added later. Prefer HTTPS + SSO/token auth before shipping sideloaded APKs.

