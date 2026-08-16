# Thin client — 1.0 feature guide

**Date:** 2026-07-27  
**Status:** TC-1 protocol **shipped**. TC-2 thin shell **buildable** (`npm run tauri:build:thin` → unsigned EXE; connect + Open library / Friends only).  
**Audience:** PM · Desktop · Backend · UI/UX · Docs  
**Related:** [desktop-companion.md](../user/desktop-companion.md) · [thin-client.md](../user/thin-client.md) · [v1-readiness.md](v1-readiness.md) · [features.md](features.md) · [social-av.md](social-av.md) · [pm-dispatch-2026-07-27.md](archive/pm-dispatch-2026-07-27.md)

---

## Problem

Household members often want to **connect to GameTheca** (browse, social, Big Picture, browser play) without the **full desktop companion**: download/extract/install/launch, RetroArch cheat staging, Flips patch apply, FS ACLs, and antivirus-sensitive native lifecycle.

Today the only native client is the **full companion** (`clients/desktop`). Everyone else uses a browser. That works, but:

- Browser bookmarks feel “not a product client”
- Companion UI mixes lifecycle CTAs that confuse non-PC-gaming seats (TV laptop, kids tablet later, second machine)
- Token scopes today are coarse (`read:library`, `write:download`) — a thin seat should not hold download powers

---

## Product definition

**Thin client** = a **connect-only** client that authenticates to a GameTheca server and surfaces **library + social + browser-capable play**, with **zero local install pipeline**.

| | Full companion (today) | Thin client (1.0) |
|---|---|---|
| Connect | Base URL + API token | Base URL + **thin-scoped** token **or** site login in shell |
| Browse library | Yes (search/preview) | Yes (member SPA or shared grid) |
| Download / Install / Update / Uninstall | Yes | **No** |
| Native Play (exe / RetroArch) | Yes | **No** — deep-link to browser play or “open on companion PC” |
| Friends / Chat / Activity | Friends window + web | First-class (dock or embedded routes) |
| Big Picture | Via web | Supported (controller-first shell) |
| FS / Tauri ACL | downloads, cheats, patches | **Browse / webview only** (Friends-window privilege model) |
| Device class | Companion heartbeat | `device_kind=thin` |

**Personas**

1. **Lounge seat** — HTPC / living-room laptop; Big Picture + browser cores + voice  
2. **Social seat** — stay-open Friends / Chat while someone else owns the install PC  
3. **Browse seat** — find games, wishlist, free-games claims; never installs locally  

**Non-goals (locked)**

- Not a rewrite of Flask / member SPA / full companion  
- Not Discord webhooks / Electron migration / bundled torrent-debrid marketplace  
- Not DRM store download queues  
- Not romhacking.net scraping  
- Not “full companion with buttons hidden” without **scope + device_kind** enforcement (UI hide alone is insufficient)

---

## Recommended shape (decision default)

**Primary:** **Thin shell** — small Tauri 2 app (or shared harness with companion) that:

1. Stores server base URL  
2. Opens an authenticated webview to the **member SPA** (session cookie login **or** token-bootstrapped session)  
3. Optional always-on-top Friends window (reuse current social capability)  
4. **No** download/install/launch plugins  

**Secondary (same wave or TC-2b):** **PWA** install of member SPA for Chromebook / locked-down seats (no native binary).

**Defer:** Google/Meta store listings; Unity/Godot VR client; WebXR library room (see [android-apk-vr.md](android-apk-vr.md)).

**Adjacent:** Android **thin APK** ([android-apk-vr.md](android-apk-vr.md)); headset/VR **SteamVR/PSVR2 + Quest** ([headset-vr.md](headset-vr.md)); controllers ([controller-input.md](controller-input.md)).


Rationale: reuses shipped SPA (library, details, social, BP, browser play); avoids dual UI; matches Friends-window least-privilege pattern already proven.

---

## Capability matrix (what ships when)

| Capability | Thin | Full companion | Browser only |
|---|---|---|---|
| Auth to household server | ✓ | ✓ | ✓ |
| Library browse / details / Systems | ✓ | ✓ | ✓ |
| Social dock / Chat / Activity / LiveKit UI | ✓ | ✓ (Friends win) | ✓ |
| Browser play (WebRetro / Ruffle) | ✓ | via web | ✓ |
| Native install lifecycle | — | ✓ | — |
| Companion command queue (install/update) | — | ✓ | — |
| Presence heartbeat as named device | ✓ (`thin`) | ✓ (`companion`) | optional |

---

## Server / API needs

### 1. Token scopes (Backend)

Extend `VALID_SCOPES` beyond `read:library` / `write:download`:

| Scope | Thin | Full |
|---|---|---|
| `read:library` | Required | Required |
| `read:social` (new) | Optional → default for thin presets | Optional |
| `write:presence` (new) | Heartbeat / “I’m playing” | Same |
| `write:download` | **Denied** for thin tokens | Required for DL |
| `write:lifecycle` (new or alias) | **Denied** | Required for install ack |

Account UI: token preset **“Thin client”** = `read:library` + `read:social` + `write:presence` (no download).  
**Shipped (TC-1 + member UI):** `GET /api/tokens` returns `scope_presets`; `POST /api/tokens` accepts `"preset": "thin"` or `"preset": "companion"`. Members create/revoke at **Account → API tokens** (`/tokens`).

### 2. Device kind (Backend)

On `POST /api/client/heartbeat` (or equivalent):

- Accept `device_kind`: `companion` | `thin` | `browser` (default companion for back-compat)  
- Persist on client device row; Admin Ops / devices list shows kind  
- Command queue (**install/update**) delivered **only** to `companion` + token with download/lifecycle scopes  

### 3. Capability advertisement (Backend → UI)

`GET /api/client/capabilities` (or heartbeat response field):

```json
{
  "device_kind": "thin",
  "allows": ["browse", "social", "browser_play", "presence"],
  "denies": ["download", "install", "update", "uninstall", "native_play"]
}
```

Member SPA / GameActionBar: when thin session detected, hide or explain Install/Update (same honesty pattern as companion Offline).

### 4. Auth bootstrap (Backend + Desktop)

Pick one path for TC-1 (spike if needed):

- **A (preferred):** Site login inside thin webview (cookie session) — mirrors Friends window today  
- **B:** Device code / one-time paste token that mints a thin-scoped API token  
- **C:** Existing API token with thin preset only  

A alone may be enough for v1 of thin; B/C for kiosk or no-password seats.

### 5. OpenAPI / shared client

Wire thin shell to `@gametheca/api-client` (v1-readiness already lists this) so heartbeat + capabilities stay typed.

---

## Client work units (Desktop + UI)

| ID | Unit | Owner | Notes |
|---|---|---|---|
| TC-SHELL-1 | New package or flavor `clients/thin/` **or** `clients/desktop` build flavor `thin` | Desktop | Prefer **flavor** first (shared Tauri version, stripped capabilities) to avoid two update channels forever |
| TC-SHELL-2 | Capabilities JSON: no FS/download ACL (copy `social.json` least-privilege) | Desktop | |
| TC-SHELL-3 | Connect UX: URL + Online/Offline; no lifecycle buttons | Desktop / UI | Reuse `connection-ux` patterns |
| TC-SPA-1 | GameActionBar / details respect `denies` from capabilities | UI | |
| TC-SPA-2 | Optional “Open on install PC” deep link / notify companion device | UI + Backend | Nice-to-have TC-3 |
| TC-PWA-1 | Web app manifest + install prompt for member SPA | UI | TC-2b |
| TC-SIGN-1 | Optional unsigned/signed thin artifact in CI | Desktop / Ops | Separate artifact name `gametheca-thin` |

---

## Wave plan (1.0 scope)

| Wave | Outcome | Exit criteria | Status |
|---|---|---|---|
| **TC-0** | This guide accepted; open decisions closed | PM sign-off | Done |
| **TC-1** | Scopes + `device_kind` + capabilities API + Admin device label | **Done** — pytest `tests/test_thin_client_tc1.py`; thin token blocked on download routes | **Done** |
| **TC-2** | Thin shell binary (or flavor) ships; Connect + SPA + Friends | Manual smoke + desktop tests | Queued |
| **TC-2b** | PWA install path documented | Getting-started + FAQ | Queued |
| **TC-3** | SPA honesty (hide lifecycle) + optional “play on companion” | vitest GameActionBar | Queued |
| **TC-4** | Docs, FAQ, troubleshooting, Ops device list, optional signing | docs-sync complete | Queued |

**PM lock:** There is **no 1.1 track** — TC-1 lands in 1.0; shell (TC-2+) may trail the tag if protocol is stable.

---

## Risks

| Risk | Mitigation |
|---|---|
| Users install “thin” expecting Install | Naming + first-run copy: “Browse & social — use Desktop companion to install games” |
| Scope confusion / over-privileged tokens | Presets; never default `write:download` on thin create |
| Two apps to maintain | Prefer **build flavor** over fork; shared version bump |
| ASGI/static / cookie auth cross-origin | Same-origin webview to server URL only; document Trusted Proxies / Site URL |
| Feature creep toward full companion | Hard denies list; PM rejects native play in thin |
| Signing / AV false positives | Thin has no extract → lower AV heat; still unsigned-ok for LAN |

---

## Docs inventory (when building)

| Doc | Action |
|---|---|
| This file | Living contract |
| `docs/user/thin-client.md` | **Have** — user thin note (TC-2) |
| `docs/user/desktop-companion.md` | Thin build + token preset cross-link |
| `docs/user/getting-started.md` | Which client to download |
| `docs/user/faq.md` | Thin preset called out on API tokens |
| `docs/strategy/progress.md` | 1.0 backlog row |
| `docs/strategy/docs-map.md` | Index |
| `docs/strategy/v1-readiness.md` | TC-1 in 1.0 scope |

---

## Success metrics (post-ship)

- Thin seats connect without ever requesting `write:download`  
- Zero thin→install support tickets caused by missing CTAs (copy is clear)  
- Full companion remains the only path for local lifecycle  
- Ops can distinguish `thin` vs `companion` devices  

---

## Open product decisions

See Program Manager backlog — max three blockers before TC-1 coding.
