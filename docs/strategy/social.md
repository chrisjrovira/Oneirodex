# Social layer — Discord-like options & GameTheca fit

**Date:** 2026-07-26 · **Status:** investigation (no implementation)  
**Context:** Today GameTheca only has **outbound Discord webhooks** (library notifications). There is no in-app chat, friends graph, or presence. Activity feed + playtime sessions are the natural hooks for a lite social layer.

---

## Goal clarification

| Goal | What “social” means | Recommended path |
|---|---|---|
| Notify a Discord/server when games land | Outbound alerts | Keep / polish existing webhooks |
| Household / clan hangout (chat + voice) | Full community shell | **BYO** Stoat or Matrix — do not fork Discord into GameTheca |
| See who is playing what | Presence + friends | **Native lite social** on Activity / playtime |
| Org / ops team chat | Slack-like | Mattermost or Rocket.Chat (ops, not product UX) |

**Non-goal:** Shipping a full Discord clone inside GameTheca (channels, voice mesh, roles, bots platform).

---

## Landscape (2026)

### Closest Discord UX (self-host)

| Project | License / notes | Fit for GameTheca |
|---|---|---|
| **[Stoat](https://github.com/stoatchat)** (ex-Revolt) | AGPL; Discord-like servers/channels/roles/voice (LiveKit); Docker multi-service | Best **optional companion** chat stack on Unraid |
| **Spacebar** | Discord API-compatible experiments | Fragile; research-only |
| **DCTS / similar** | Early | Not product-ready |

### Federated / privacy-first

| Project | Notes | Fit |
|---|---|---|
| **Matrix + Element** (Synapse / Conduit / Dendrite) | Federation, E2E, Discord/Slack bridges | Best long-term if households want bridges + encryption |
| **XMPP** | Lighter protocol; less consumer UX | Niche |

### Org / team (not gamer hangout)

| Project | Notes | Fit |
|---|---|---|
| **Rocket.Chat** | Polished Slack/Discord hybrid | Admin/ops communities |
| **Mattermost** | DevOps workflows, simpler deploy | Homelab ops rooms |
| **Zulip** | Topic threads | Structured discussion, not Discord UX |

### Voice-only

| Project | Notes | Fit |
|---|---|---|
| **Mumble** | Low-latency gaming voice | Optional voice sidecar |
| **TeamSpeak** | Classic gaming VC | Same niche |

### Competitive cues (library products)

| Product | Social pattern to steal |
|---|---|
| **GameVault** | Progress / friends-style visibility |
| **Hydra** | Profiles, presence, social launcher feel — **not** their marketplace |
| GameTheca today | Activity feed, playtime sessions, Discord webhooks |

---

## Recommended architecture (Wave 13 candidate)

```
┌─────────────────────────────────────────────────────────┐
│ GameTheca (native lite social)                          │
│  • Friends / follow list (household RBAC aware)         │
│  • Presence from playtime sessions + companion heartbeat│
│  • Profiles: playtime, recent titles (ACL filtered)     │
│  • Share cards (already sketched in playtime SVG)       │
│  • Activity: “X started Y” (extend /activity)           │
└──────────────────────┬──────────────────────────────────┘
                       │ deep-link / optional embed
┌──────────────────────▼──────────────────────────────────┐
│ BYO chat (admin opt-in)                                 │
│  A) Stoat instance URL → “Open community” button        │
│  B) Matrix Space invite / Element deep-link             │
│  C) Keep Discord webhook for library events             │
└─────────────────────────────────────────────────────────┘
```

### Phase A — Native lite (ship in product)

1. Friend / household graph (reuse invites / users; parental ACL on shared titles).
2. Presence: online / in-game from `start_session` / companion ping; SSE already exists — wire member SPA.
3. Profile pages + compare playtime (opt-in).
4. Richer Activity (merge SystemEvents + play sessions).

### Phase B — BYO chat (ops compose, not core code)

1. Document Unraid compose snippets for Stoat **or** Matrix (pick one recommended default: Stoat for Discord migrants, Matrix for federation).
2. Admin setting: `community_chat_url` + label (no chat protocol in Flask).
3. Optional webhook parity: Stoat/Matrix incoming hooks later if useful.

### Phase C — Explicitly defer

- In-process WebRTC voice
- Role/permission chat engines
- Discord bot platform inside GameTheca
- Bridging user accounts 1:1 with external chat (SSO later if needed)

---

## Decision summary

| Choose | When |
|---|---|
| Native presence + Activity | Default product social — matches GameVault/Hydra cues without chat debt |
| Stoat (BYO Docker) | Household wants Discord-like UI on Unraid |
| Matrix + Element (BYO) | Want federation, E2E, Discord bridge |
| Mattermost / Rocket.Chat | Ops/admin team rooms only |
| Discord webhooks | Keep for outbound library notifications |

**Verdict:** Build **lite social in-app**; **compose-optional** Stoat or Matrix for real chat; keep Discord as notify-only. Do not merge a chat server into the GameTheca container.
