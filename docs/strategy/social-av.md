# Social + audio/video — household hangout roadmap

**Date:** 2026-07-27 · **Status:** Waves 14–17 shipped; Friends companion + LiveKit lobby live  
**Supersedes (partially):** [social.md](social.md) lite-only verdict — we deepen native social and add a **first-party voice path** via LiveKit (optional sidecar), with Stoat/Matrix remaining valid BYO alternatives.

---

## Design references (capability language)

GameTheca social combines **household-first** patterns without cloning a single vendor chat product:

| Layer | Ship in GameTheca | Avoid |
|---|---|---|
| Text chat | Rooms, DMs, mentions, reactions — native lite→mid | Public server discovery, bot/webhook platforms |
| Voice | Low-latency party rooms tied to “now playing” (LiveKit, optional) | Separate voice-only client for everything |
| Presence | In-game / library presence from play sessions + heartbeat | Public social graph / store pressure |
| BYO chat | Stoat / Matrix deep links when native chat is not enough | Running a second full chat stack by default |
| Library-adjacent cards | Activity tied to titles + ACL | Public multiplayer matchmaking marketplace |

**Shipped companion:** stay-open Friends dock + `/social-companion` pop-out + Big Picture **Y** + desktop always-on-top **least-privilege** window — [social-and-voice.md](../user/social-and-voice.md) · [desktop-companion.md](../user/desktop-companion.md).  
**Next polish:** denser party voice rooms and invite-to-room without third-party chat webhooks.


| Layer | Own in GameTheca | BYO / optional sidecar |
|---|---|---|
| Library, ACL, downloads, emu | **Core** | — |
| Presence, friends, profiles, Activity | **Core** | — |
| Text chat (channels, DMs, reactions) | **Native lite → mid** | Stoat / Matrix for full-featured chat |
| Voice / video | **LiveKit-backed rooms** (opt-in) | Stoat (LiveKit) or MatrixRTC |

**Non-goals:** Shipping a bots platform or public server-template marketplace, public federation as default, recording/CDN of user media without explicit admin enable.

---

## Feature map — household hangout & peers → GameTheca

### Must-have for “household hangout” (ship bar)

| Household-hangout feature | Capability target | GameTheca plan | Wave |
|---|---|---|---|
| Friends / pending requests | Friend lists + requests | Exists (W13) → polish UX | 14a |
| Online / in-game presence | Rich “now playing” | Play sessions + heartbeat → richer presence | 14a |
| Activity feed (“X started Y”) | Household activity stream | Exists → SSE + friend filter | 14a |
| User profiles (avatar, about, playtime) | Member profiles | Member profile pages | 14b |
| Direct messages (1:1 text) | DM threads | Native DM threads | 15a |
| Server / household channels | Scoped channels | Soft channels scoped to library household | 15b |
| @mentions + notifications | Mentions + alerts | In-app + optional email (instant / daily digest) — **no webhooks** | 15c |
| Voice channels / party | Party voice | LiveKit rooms tied to “Now playing” / lobby | 16 |
| Screen share (party) | Screenshare | LiveKit screenshare (opt-in) | 16b |
| Roles / permissions | RBAC | Reuse RBAC (admin/librarian/user/child) — no custom role editor v1 | 15b |
| Parental visibility | Child-safe social | Child cannot see adult channels/DMs; ACL on titles in social cards | all |

### Nice-to-have (post-ship / later waves)

| Feature | Notes | Wave |
|---|---|---|
| Reactions / emoji | Fixed set + admin custom (max 20) | **17a/b shipped** |
| Threads | Channel reply threads | **17b shipped** |
| Voice activity detection / push-to-talk | LiveKit defaults + UI | 16 polish |
| Stage / spectator | “Watch party” while one plays | **17b shipped** |
| Bots / webhooks inbound | **Won’t ship** — excised; use Support inbox + in-app alerts | — |
| Message search | Full-text (`ILIKE`) | **17a shipped** |
| Mobile push | Companion / PWA later | 18 |
| External chat bridges | Prefer Matrix sidecar if needed | BYO |

### Explicitly out of product (use BYO Stoat/Matrix)

Nitro-style boosts · public discovery · unlimited guilds · stickers marketplace · community moderation AI · global CDN emoji packs.

---

## Audio / video — best practices (2026)

### Architecture choice

| Approach | When | Verdict for GameTheca |
|---|---|---|
| **Mesh WebRTC (P2P)** | 2–3 people | Fine for DM voice; **does not scale** for party of 6+ |
| **SFU (LiveKit)** | Household party / channels | **Default** — Stoat/Element Call path |
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

| Slice | Scope | Status |
|---|---|---|
| **14a** | Presence model · Activity SSE · friends filter · block/reject | **Shipped** |
| **14b** | Public member profiles · compare-with-friend | **Shipped** |
| **14c** | Notification center | **Shipped** — `/api/notifications` + SPA prefs |

### Wave 15 — Text chat (native mid)

| Slice | Scope | Status |
|---|---|---|
| **15a** | 1:1 DMs (threads, read receipts lite, typing optional) | **Shipped** (typing deferred) |
| **15b** | Household channels (`#general`, `#looking-for-players`) · RBAC-gated create · child-safe default channel | **Shipped** |
| **15c** | Mentions · mute · email digest optional | **Shipped** — @mentions · mute API/UI · opt-in instant email · opt-in daily digest (mentions/DMs/free games) |

### Wave 16 — Voice / video path start

| Slice | Scope |
|---|---|
| **16a** | Compose `livekit` profile · `/api/rtc/token` · voice lobby UI on Activity / Big Picture | **Shipped** |
| **16b** | Party voice attached to “Now playing” game · screenshare flag | **Shipped** (opaque `household:party:<uuid>`) |
| **16c** | Unraid runbook · connection tester · parental camera/mic policy | **Shipped** — [livekit-unraid.md](../runbooks/livekit-unraid.md); child camera/screenshare blocked |

### Wave 17 — Polish household-hangout gaps

| Slice | Scope |
|---|---|
| **17a** | Message reactions (fixed emoji set) · message search (`ILIKE`) | **Shipped** |
| **17b** | Threads · watch-party spectator · custom emoji (upload capped) | **Shipped** — reply threads + spectator + admin custom emoji (max 20) |

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
5. Market it as “household social for your library”

---

## Relationship to existing code

| Exists today | Extends in |
|---|---|
| `UserFriendship`, `/api/social/*` | 14a |
| `/api/activity`, play sessions | 14a presence |
| `community_chat_url` | Keep as BYO escape hatch through Wave 18 |
| Plugin `social.community_chat` | `rtc.livekit` registered (Wave 16) |
