# Social + audio/video — Discord-class roadmap

**Date:** 2026-07-26 · **Status:** product plan (implementation starts Wave 14)  
**Supersedes (partially):** [social.md](social.md) lite-only verdict — we still **do not** fork Discord; we **do** deepen native social and add a **first-party voice path** via LiveKit (optional sidecar), with Stoat/Matrix remaining valid BYO alternatives.

---

## Product stance

GameTheca at ship is a **self-hosted household game library with social hangout**, not a public Discord competitor.

| Layer | Own in GameTheca | BYO / optional sidecar |
|---|---|---|
| Library, ACL, downloads, emu | **Core** | — |
| Presence, friends, profiles, Activity | **Core** | — |
| Text chat (channels, DMs, reactions) | **Native lite → mid** | Stoat / Matrix if household wants full Discord UX |
| Voice / video | **LiveKit-backed rooms** (opt-in) | Stoat (LiveKit) or MatrixRTC |
| Discord webhooks | Notify-only | Keep |

**Non-goals:** Shipping a full Discord clone (roles/bots platform/server templates marketplace), public federation as default, recording/CDN of user media without explicit admin enable.

---

## Feature map — Discord & peers → GameTheca

### Must-have for “household hangout” (ship bar)

| Discord-class feature | Peer refs | GameTheca plan | Wave |
|---|---|---|---|
| Friends / pending requests | Discord, Steam | Exists (W13) → polish UX | 14a |
| Online / in-game presence | Discord, Hydra, Steam | Play sessions + heartbeat → richer presence | 14a |
| Activity feed (“X started Y”) | Discord, GameVault | Exists → SSE + friend filter | 14a |
| User profiles (avatar, about, playtime) | Discord, Steam | Member profile pages | 14b |
| Direct messages (1:1 text) | Discord, Matrix | Native DM threads | 15a |
| Server / household channels | Discord, Stoat | Soft channels scoped to library household | 15b |
| @mentions + notifications | Discord | In-app + optional email/webhook | 15c |
| Voice channels / party | Discord, Stoat, Mumble | LiveKit rooms tied to “Now playing” / lobby | 16 |
| Screen share (party) | Discord | LiveKit screenshare (opt-in) | 16b |
| Roles / permissions | Discord | Reuse RBAC (admin/librarian/user/child) — no Discord-style role editor v1 | 15b |
| Parental visibility | — | Child cannot see adult channels/DMs; ACL on titles in social cards | all |

### Nice-to-have (post-ship / later waves)

| Feature | Notes | Wave |
|---|---|---|
| Reactions / emoji | Custom emoji deferred | 17 |
| Threads | Channel threads | 17 |
| Voice activity detection / push-to-talk | LiveKit defaults + UI | 16 |
| Stage / spectator | “Watch party” while one plays | 17 |
| Bots / webhooks inbound | Outbound Discord only for now | later |
| Message search | Full-text | 17 |
| Mobile push | Companion / PWA later | 18 |
| Bridges to Discord | Prefer Matrix sidecar if needed | BYO |

### Explicitly out of product (use BYO Stoat/Matrix)

Nitro-style boosts · public discovery · unlimited guilds · stickers marketplace · community moderation AI · global CDN emoji packs.

---

## Audio / video — best practices (2026)

### Architecture choice

| Approach | When | Verdict for GameTheca |
|---|---|---|
| **Mesh WebRTC (P2P)** | 2–3 people | Fine for DM voice; **does not scale** for party of 6+ |
| **SFU (LiveKit)** | Household party / channels | **Default** — Discord/Stoat/Element Call path |
| **MCU** | Rare | Skip — CPU heavy |
| **Embed Jitsi** | Quick MVP | Acceptable interim; migrate to LiveKit |
| **Mumble only** | Voice-only clans | Optional sidecar, not in-app |

**Recommendation:** Optional **`gametheca-rtc`** compose profile:

1. **LiveKit SFU** (host networking or UDP range + TLS WSS)  
2. **GameTheca JWT mint** — `/api/rtc/token` issues short-lived LiveKit tokens for `room=<household>:<channel|party>` after authZ  
3. Member SPA embeds LiveKit client components (audio first, then video/screenshare)  
4. TURN: prefer LiveKit embedded TURN; Coturn only if NAT-hostile ISPs  

### Security & privacy for A/V

- Tokens: short TTL (≤1h), room-scoped, no admin LiveKit API key in browser  
- Rooms named from opaque IDs, not game titles in the SFU metadata when possible  
- Child accounts: cannot join adult voice rooms; cannot enable camera by default  
- No cloud recording unless `ENABLE_RTC_RECORDING=true` (default off)  
- Document Unraid UDP ports (e.g. 50000–50100) and TLS requirements  
- Separate threat model from library SSRF — RTC JWT service must not accept arbitrary room names from clients without ACL  

### Ops notes (Unraid)

- LiveKit wants to know its **public IP**; behind CGNAT, TURN becomes mandatory  
- Prefer splitting RTC to its own container network with published UDP  
- Bandwidth: plan ~1–3 Mbps uplink per participant for voice; more for screenshare  

---

## Wave set (build order)

### Wave 14 — Social depth (no media yet)

| Slice | Scope |
|---|---|
| **14a** | Presence model (online / away / in-game + game UUID) · Activity SSE · friends filter on Activity · block/unfriend polish |
| **14b** | Public member profiles (avatar, about, recent games ACL-filtered, playtime totals) · compare-with-friend |
| **14c** | Notification center (friend request, “started playing”) · preference toggles |

### Wave 15 — Text chat (native mid)

| Slice | Scope |
|---|---|
| **15a** | 1:1 DMs (threads, read receipts lite, typing optional) |
| **15b** | Household channels (`#general`, `#looking-for-players`) · RBAC-gated create · child-safe default channel |
| **15c** | Mentions · mute · email digest optional |

### Wave 16 — Voice / video path start

| Slice | Scope |
|---|---|
| **16a** | Compose `livekit` profile · `/api/rtc/token` · voice lobby UI on Activity / Big Picture |
| **16b** | Party voice attached to “Now playing” game · screenshare flag |
| **16c** | Unraid runbook · connection tester · parental camera/mic policy |

### Wave 17 — Polish Discord-class gaps

Reactions · threads · watch-party spectator · message search · custom emoji (upload capped)

### Wave 18 — Clients & push

Desktop companion mute/deafen · PWA push · optional Matrix/Stoat deep-link parity for users who skip native chat

### Wave Sec-A / Sec-B (parallel)

See [security.md](security.md) — ship blockers for public household exposure.

---

## Acceptance for “ready to ship to users”

Social is **shippable** when:

1. Friends + presence + profiles work with parental ACL  
2. DMs + at least one household text channel  
3. Optional voice lobby works on LAN (LiveKit) **or** documented BYO Stoat/Matrix link is first-class  
4. Security suite P0/P1 from security.md closed  
5. No claim of “Discord replacement” in marketing — “household social for your library”  

---

## Relationship to existing code

| Exists today | Extends in |
|---|---|
| `UserFriendship`, `/api/social/*` | 14a |
| `/api/activity`, play sessions | 14a presence |
| `community_chat_url` | Keep as BYO escape hatch through Wave 18 |
| Discord webhooks | Notify-only forever |
| Plugin `social.community_chat` | Add `rtc.livekit` plugin entry in Wave 16 |
