# Native household RTC / SFU (replace LiveKit)

**Date:** 2026-07-29  
**Status:** Nice-to-have · post-1.0 backlog (**not started**)  
**Priority:** backlog / sprint nice-to-have  
**Audience:** PM · Backend (Social) · UI · Desktop · Ops · QA · Docs  
**Shipped path today:** [social-av.md](social-av.md) — Wave 16+ voice lobby / screenshare / spectator · optional `--profile livekit` · [livekit-unraid.md](../runbooks/livekit-unraid.md)  
**Related:** [social.md](social.md) · [features.md](features.md) · [external-facing-scrub.md](external-facing-scrub.md) · [pm-miss-backlog.md](pm-miss-backlog.md)

---

## Problem

LiveKit is a **Class D** allowed integration and the **shipped 1.0 default** for optional household party voice. Operators still hit:

| Friction | Why it bites |
|---|---|
| Ops complexity | API keys, UDP port ranges, Unraid networking / public IP / TURN |
| External SFU product | Desire for a thinner path that is not forever bound to one SFU vendor image |
| Small-party fit | Many households only need **2–8** voice seats, not a full multi-tenant SFU stack |

**Product intent:** optional **first-party** voice/video path so household party rooms are not dependent on the LiveKit server image + API keys, while allowing **LiveKit** (or MatrixRTC / Stoat deep links) as **BYO forever**.

This epic does **not** gate official 1.0.0. LiveKit remains the shipped optional default until cutover DoD.

---

## Product definition

**Native household RTC (RTC-N)** = abstract room-token API + mesh and/or thin SFU sidecar so member SPA / Friends companion can join party voice without hard-binding the LiveKit client forever.

| Principle | Stance |
|---|---|
| Default until cutover | LiveKit Compose profile + `/api/rtc/token` LiveKit JWTs |
| BYO forever | LiveKit · MatrixRTC · Stoat deep links remain first-class escapes |
| Scale target | Household party **2–8** seats — not public CDN conferencing |
| Non-goals | Public recording CDN · bots/webhooks · Discord |

### In scope

1. Abstract room token / session API so UI does not hard-bind LiveKit forever  
2. Mesh WebRTC path for 2–3 (DM / tiny party)  
3. Optional household thin SFU sidecar for 4–8  
4. Screenshare + spectator parity with shipped Wave 16/17 behavior  
5. Demote LiveKit Compose profile to BYO-only after cutover  

### Not in this slice

*Scope note: these are **not in this slice**, not refused. Reasoning and
reopen conditions live in the private working doc.*

- Public server discovery / federation as default  
- Bots, inbound webhooks, Discord  
- Cloud recording / CDN of user media without explicit admin enable (same as today)  
- Claiming LiveKit is removed from 1.0 docs  

---

## Alternatives matrix (capability language)

| Approach | Fit | Tradeoff |
|---|---|---|
| **Keep LiveKit BYO** | Always | Lowest churn; ops keys/UDP remain |
| **Mesh WebRTC (P2P)** | 2–3 seats | Simple; does not scale to party of 6+ |
| **Self-hosted thin SFU** (Mediasoup / Ion / Pion-style / custom) | 4–8 household | More GameTheca ownership; build/ops cost |
| **MatrixRTC BYO** | Operators already on Matrix | Second stack; deep-link first, not default |

### Recommended direction

**Mesh-first for DM / 2–3, then optional thin SFU sidecar for household parties (4–8).** Keep LiveKit as BYO profile forever. Prefer a thin SFU over inventing a full MCU or embedding a heavy third UI. Do not frame this as ripping a peer chat product — capability language only.

---

## Recommended shape

```text
  Member SPA / Friends / Big Picture
            │
            ▼
   /api/rtc/*  abstract room session + short-lived tokens
            │
     ┌──────┼────────────────────────┐
     ▼      ▼                        ▼
   Mesh   Thin SFU sidecar      LiveKit / MatrixRTC
  (2–3)   (4–8 household)       (BYO forever)
```

---

## Capability matrix / phases

| Capability | RTC-N1 | RTC-N2 | RTC-N3 | RTC-N4 | RTC-N5 |
|---|---|---|---|---|---|
| Abstract room token API (UI not hard-bound to LiveKit client) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mesh DM / tiny-party voice path | | ✓ | ✓ | ✓ | ✓ |
| Optional household SFU sidecar | | | ✓ | ✓ | ✓ |
| Screenshare + spectator parity | | | | ✓ | ✓ |
| LiveKit demoted to BYO profile only | | | | | ✓ |

### Phase detail

| ID | Outcome | Owner seats | Exit criteria |
|---|---|---|---|
| **RTC-N1** | Abstract room token / session API | Backend · UI | LiveKit adapter behind interface; SPA uses abstract hooks |
| **RTC-N2** | Mesh DM voice path | Backend · UI · Desktop | 2–3 seats LAN smoke; child ACL preserved |
| **RTC-N3** | Optional household SFU sidecar | Backend · Ops | Compose profile; Unraid UDP/TLS runbook draft |
| **RTC-N4** | Screenshare / spectator parity | Backend · UI · QA | Match Wave 16b/17b honesty |
| **RTC-N5** | LiveKit demote to BYO-only | Ops · Docs · QA | Default docs path = native; LiveKit profile still documented |

---

## Risks

| Risk | Mitigation |
|---|---|
| Rewrite SPA twice | RTC-N1 abstraction before mesh/SFU |
| Unraid networking still hard | Thin SFU runbook mirrors LiveKit lessons; TURN honesty |
| Feature gap vs LiveKit | Parity table for voice / screenshare / spectator before demote |
| Scope creep to public CDN | Explicit non-goal |

---

## Definition of done (epic)

- [ ] RTC-N1…RTC-N5 complete or ADR-deferred  
- [ ] LiveKit (and MatrixRTC/Stoat) remain BYO  
- [ ] Child camera/mic policy preserved  
- [ ] No Discord / webhooks / public recording CDN  
- [ ] Docs scrub: social-av + livekit runbook + settings-modules honesty  

---

## Owner seats

| Seat | Role |
|---|---|
| **Backend** (Social lane) | Token API · mesh · SFU adapter |
| **UI** | Lobby / party / spectator clients against abstract API |
| **Desktop** | Friends companion voice path |
| **Ops** | Compose profiles · Unraid ports · TURN notes |
| **QA** | Mesh + SFU + LiveKit BYO regression |
| **Docs** | Living contract · runbooks · scrub |

**Shipped default until cutover:** LiveKit remains optional Compose profile.

---

## Related links

- Shipped A/V roadmap: [social-av.md](social-av.md)  
- LiveKit Unraid: [livekit-unraid.md](../runbooks/livekit-unraid.md)  
- User guide: [social-and-voice.md](../user/social-and-voice.md)  
- Feature index: [features.md](features.md) (Nice-to-have / post-1.0)  
