# Social, chat & voice

Household social is first-party (no third-party chat webhooks). Optional voice uses LiveKit.

## What members get

| Surface | Where | Notes |
|---|---|---|
| **Friends companion** | Floating dock · **Pop out** · `/social-companion` · desktop **Open friends window** | Stay-open friends list with DM / party invite / share — works beside Big Picture without living in the main library UI |
| Presence / activity | **More → Activity** | Who’s online / recent play |
| Profiles | `/members/<id>` | From friends / activity |
| Notifications | **More → Notifications** | Friends, chat, admin alerts; optional email for mentions/DMs |
| Chat (DMs + channels) | **More → Chat** | Reactions (Unicode + household custom) · search · reply threads · @mentions · mute |
| Voice lobby | Activity (+ Big Picture party) | LiveKit; **spectator** = listen-only token |
| Community link | Preferences / More | BYO Stoat or Matrix URL if admin set it |
| Report issue | **More → Report issue** | Ticket → admin inbox (+ GitHub when configured) |

## Friends companion (stay-open)

- Library UI shows a **Friends** pill (bottom-right). Open it for presence, DMs, party invite, and share-game.
- **Pop out** opens `/social-companion` in a separate browser window you can park on a second monitor.
- **Big Picture:** header **Friends** or press **Y** — dock stays available while you browse the rail.
- **Desktop companion:** **Open friends window** creates or focuses an always-on-top Tauri webview to `/social-companion`. Needs a Server URL; uses your **site login** in that window (companion Connect optional). If the companion is Offline, the window still opens but may not load until the server is back — the status strip explains this. Least-privilege ACL — no install/launch from the Friends window. Same surfaces as web: dock · pop-out · Big Picture **Y**. See [desktop-companion.md](desktop-companion.md).

## Optional email (mentions & DMs)

- **Instant:** Default **off**. Enable **Email me for mentions & DMs** under Notifications.
- **Daily digest:** Default **off**. Enable **Daily email digest** for a summary of unread mentions, DMs, and free games (needs Admin SMTP + verified email).
- Instant and digest are independent — you can use either or both.
- Free-game-only digests are not separate; free games are included in the daily digest.

## Mute a channel or DM

- Open **More → Chat**, select a channel, click **Mute** / **Unmute**.
- Muted channels show `(muted)` in the sidebar.
- While muted, you still see messages in Chat, but @mentions and DM notifications for that thread are suppressed.

## Chat reactions & search

- Click an emoji under a message to toggle your reaction (same emoji again removes it).
- Admins can upload household custom emoji (Integrations → **Manage custom chat emoji**, max 20 images) — they appear next to the fixed Unicode set in Chat.
- Use **Search messages** at the top of Chat (min 2 characters). Hits open the channel.

## Voice (LiveKit)

1. Admin enables LiveKit (`ENABLE_LIVEKIT`, API key/secret, `LIVEKIT_URL`) and optionally `docker compose --profile livekit up -d`.
2. Open **Activity** → Voice lobby → **Get voice token** (or Big Picture party voice on a focused game).
3. Room ids are opaque (`household:lobby`, `household:party:<game-uuid>`) — game titles are not sent to the SFU.
4. Child accounts: audio OK; camera/screenshare requests are rejected.

Ops detail: [livekit-unraid.md](../runbooks/livekit-unraid.md) · plan: [social-av.md](../strategy/social-av.md).

## What we don’t do

- No Discord bots, webhooks, or “notify Discord” library actions.
- No always-on cloud LLM inside the app for triage.
