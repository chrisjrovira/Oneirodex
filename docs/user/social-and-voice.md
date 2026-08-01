# Social, chat & voice

Household social is first-party (no third-party chat webhooks). Optional voice uses LiveKit.

## What members get

| Surface | Where | Notes |
|---|---|---|
| **Friends companion** | Floating dock · **More → Friends** · **Pop out** · `/social-companion` · desktop **Open friends window** | Stay-open friends list with DM / party invite / share — works beside Big Picture without living in the main library UI |
| Presence / activity | **More → Activity** | Who’s online / recent play |
| Profiles | `/members/<id>` | From friends / activity |
| Notifications | **More → Notifications** | Dense inbox with unread filter; alert prefs folded under **Alert preferences**; optional email for mentions/DMs |
| Chat (DMs + channels) | Left slide-out · **More → Chat** · Chat pill · `/chat` deep-link | Full room: channel rail · thread · composer (emoji · attach) · reactions · search · reply · mute · **Archive** / **Leave** · **Voice** / **Screenshare** header entry · **Expand** for a wider panel |
| Voice lobby | Activity (+ Big Picture party) | LiveKit; **spectator** = listen-only token |
| Community link | Preferences / More | BYO Stoat or Matrix URL if admin set it |
| Report issue | **More → Report issue** | Title required; symptom/logs optional · Context/Logs collapsed · ticket → admin inbox (+ GitHub when configured) |

## Friends companion (stay-open)

- Library UI shows a **Friends** pill (bottom-right). **More → Friends** (and Ctrl/Cmd+K → Friends) opens the same dock in place — it does **not** swap the SPA to a full-page `/social-companion` shell. Open it for presence, DMs, party invite, and share-game. The dock **starts closed** and only opens `/api/activity/stream` while open (avoids starving Discover/Library on single-worker ASGI).
- **Pop out** opens `/social-companion` in a separate browser window you can park on a second monitor (desktop companion uses the same host route).
- **Big Picture:** header **Friends** or press **Y** — companion starts closed; open when you need it so the rail stays responsive.
- **Desktop companion:** **Open friends window** creates or focuses an always-on-top Tauri webview to `/social-companion`. Needs a Server URL; uses your **site login** in that window (companion Connect optional). If the companion is Offline, the window still opens but may not load until the server is back — the status strip explains this. Least-privilege ACL — no install/launch from the Friends window. Same surfaces as web: dock · pop-out · Big Picture **Y**. See [desktop-companion.md](desktop-companion.md).

## Optional email (mentions & DMs)

- **Instant:** Default **off**. Enable **Email me for mentions & DMs** under Notifications.
- **Daily digest:** Default **off**. Enable **Daily email digest** for a summary of unread mentions, DMs, and free games (needs Admin SMTP + verified email).
- Instant and digest are independent — you can use either or both.
- Free-game-only digests are not separate; free games are included in the daily digest.

## Chat slide-out

- Library UI shows a **Chat** pill (bottom-left). **More → Chat** and Ctrl/Cmd+K → Chat open the same **left slide-out** — TopNav and the page underneath stay available.
- Layout reads as a **full household room**: denser channel rail (Channels + Direct) · active thread · composer. Use **More** in the room list for search and open-DM. **Add** creates a household room. **Expand** / **Compact** widens the panel without leaving the library.
- Composer: **emoji** picker (household fixed + admin custom set) · **Attach** (upload then send with `attachment_ids`). Soft-disables with a hint if the upload route is missing or the account is a **child**. Message bubbles render `attachments` (image thumb + download link).
- Thread header: **Voice** and **Screenshare** open the LiveKit entry panel (child accounts: audio OK; camera/screenshare may be rejected by the server). Also **Mute** / **Leave** / **Archive**.
- Dismiss with ×, the dimmed scrim, or Esc; reopen from the pill or More anytime. Open preference is remembered in localStorage.
- `/chat` deep-links open the slide-out and replace to Library (no orphan full-page chat shell).
- Friends dock **Chat** / DM actions open this panel in place (standalone `/social-companion` still uses `/chat` deep-link).
- No Discord bots, webhooks, or Discord branding — native GameTheca chat only.

## Mute a channel or DM

- Open Chat, select a channel, click **Mute** / **Unmute**.
- Muted channels show `muted` in the sidebar.
- While muted, you still see messages in Chat, but @mentions and DM notifications for that thread are suppressed.

## Create / manage household rooms

- Authenticated members (`user` / librarian / admin) can **create** from the slide-out **Add** field (`POST /api/chat/channels` with `name`, optional `slug`). Child accounts cannot create rooms — the API returns 403.
- Member-created rooms are always child-safe; only librarian/admin may set `is_child_safe: false`.
- **Archive** (thread header) — household rooms only; room creator or librarian+. Confirm, then `POST …/archive`. Room disappears from the list for everyone. Permission errors show as 403 copy.
- **Leave** (thread header) — confirm, then `POST …/leave`. DMs drop membership (conversation leaves the list); household rooms mute (same effect as **Mute**; sidebar shows the **muted** badge; unmute later).
- List payload includes `id`, `name`, `type`/`kind`, `unread`, `muted`, `created_by_user_id` (`rooms` alias on `GET /api/chat/channels`).

## Chat reactions & search

- Click an emoji under a message to toggle your reaction (same emoji again removes it).
- Admins can upload household custom emoji (Integrations → **Manage custom chat emoji**, max 20 images) — they appear next to the fixed Unicode set in Chat.
- Open **More** in the room list → search messages (min 2 characters). Hits open the channel.

## Chat attachments (images & small files)

- Members (`user` / librarian / admin) can attach images and small files in household rooms and DMs. **Child accounts cannot upload** (same policy as camera/screenshare).
- Flow: upload first (`POST /api/chat/channels/<id>/attachments` multipart field `file`), then send with `attachment_ids` on `POST …/messages`. Body may be empty when attachments are present.
- Limits: **5 MB** per file · **5** attachments per message · types: `png` / `jpg` / `webp` / `gif` / `txt` / `csv` / `pdf`.
- Message payloads include `attachments: [{id, url, mime, name, size}]` (URL under `/static/library/chat-attachments/…`).

## Voice (LiveKit)

1. Admin enables LiveKit (`ENABLE_LIVEKIT`, API key/secret, `LIVEKIT_URL`) and optionally `docker compose --profile livekit up -d`.
2. Open **Activity** → Voice lobby → **Get voice token** (or Big Picture party voice on a focused game).
3. Room ids are opaque (`household:lobby`, `household:party:<game-uuid>`) — game titles are not sent to the SFU.
4. Child accounts: audio OK; camera/screenshare requests are rejected.

Ops detail: [livekit-unraid.md](../runbooks/livekit-unraid.md) · plan: [social-av.md](../strategy/social-av.md).

## What we don’t do

- No Discord bots, webhooks, or “notify Discord” library actions.
- No always-on cloud LLM inside the app for triage.
