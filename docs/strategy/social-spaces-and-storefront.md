# Spaces, scoped voice, and storefront Discover

**Date:** 2026-08-03 · **Owner:** GM (rules) → Backend → UI · **Status:** decisions **LOCKED**, build in progress

Two directions from human feedback on 2026-08-03, plus the fix for the voice-ACL gap found in
[review-2026-08-03-findings.md](archive/review-2026-08-03-findings.md).

> **"Discord-like" means the UX pattern only.** The long-standing stance holds unchanged: first-party native
> social, **no Discord product**, no webhooks, no bots, no bridging. Spaces/channels are our own model that happens
> to read the way people already expect chat to work.

---

## Part 1 — Spaces (servers) with text + voice channels

### Locked decisions

| Decision | Stance |
|---|---|
| Who creates a space | **Admins only** |
| Membership | Two flavours per space: **`household`** (every non-child user auto-joins) or **`invite`** (explicit membership only) |
| Invites | Real tokens — expiry + max-uses + revoke, same shape as existing `InviteToken` |
| Child safety | `is_child_safe` on the space **and** the channel; a child needs both to pass |
| Channels | Belong to a space; `kind` = `channel` (text) \| `voice`. DMs stay space-less |
| Voice rooms | Derived from the **voice channel id** — never free text from the client |

### Why this closes the security gap

`user_may_join_room` previously only blocked `role == 'child'` from rooms whose name contained "adult" or started
with "admin" — any other authenticated user could mint a token for **any** room string, and party rooms are keyed on
game UUIDs that are visible in `/game_details/<uuid>` URLs. It was obscurity, not enforcement.

The room name now has to resolve to something the user demonstrably has access to, and **anything unrecognised is
denied**:

| Room pattern | Who may join |
|---|---|
| `space:<space_id>:voice:<channel_id>` | Members of that space, passing both child-safety flags |
| `household:party:<game_uuid>` | Users who can access that game (`user_can_access_game`) |
| `household:lobby` | Any authenticated non-child user (the one intentionally household-wide room) |
| anything else | **Denied** (default deny) |

### Model

- **`ChatSpace`** — `name`, `slug`, `description`, `visibility` (`household`\|`invite`), `is_child_safe`,
  `display_order`, `created_by_user_id`, `archived_at`.
- **`ChatSpaceMember`** — `space_id`, `user_id`, `role` (`owner`\|`moderator`\|`member`), `muted`, `joined_at`.
- **`ChatSpaceInvite`** — `space_id`, `token`, `expires_at`, `max_uses`, `uses`, `revoked_at`, `created_by_user_id`.
- **`ChatChannel`** gains `space_id` (nullable — DMs have none) and `display_order`; `kind` accepts `voice`.

Space membership grants channel access. `ChatChannelMember` stays, but for **per-channel read state and mute** —
it is no longer the sole access record for space channels.

### Migration stance

Existing flat channels are **not** orphaned: `updateschema.py` creates a default **Household** space
(`visibility='household'`) and adopts every existing non-DM channel into it, so nothing disappears on upgrade.
DMs are untouched.

---

## Part 2 — Storefront Discover

**Roku-like zones + screensaver stay queued** as a separate later slice — this replaces neither. The storefront is
the primary Discover surface; the ambient/TV concept can layer on afterwards.

### Locked decisions

| Decision | Stance |
|---|---|
| Shape | Steam-storefront: featured hero, **Curated for you**, **Upcoming**, plus admin shelves |
| Curation | Derived from the member's own signals (favorites, play status, genres) — **no external recommender, no telemetry off-box** |
| Upcoming | `first_release_date` ahead of now — reuses the existing Calendar data, no new scraping |
| Events | Any shelf can carry `starts_at` / `ends_at` and appears only inside that window |
| Config | All of it admin-editable under settings — order, visibility, layout, schedule, curation source |
| Honesty | A shelf with nothing to show is **hidden**, not padded with filler |

### Model

`DiscoverySection` already carries `identifier` / `section_type` (`seed`\|`custom`) / `display_order` /
`is_visible` / `config`. It gains:

- `starts_at` / `ends_at` — nullable; when set, the shelf only renders inside the window (this is what makes a
  shelf an "event").
- `layout` — `shelf` (default) \| `hero` \| `carousel`, for storefront treatment.
- New seed identifiers: **`curated_for_you`** and **`upcoming`**.

Existing seed shelves (`libraries`, `latest_games`, `most_downloaded`, `highest_rated`, `last_updated`,
`most_favorited`) and admin custom zones keep working unchanged.

---

## Build order

| Slice | Focus | Status |
|---|---|---|
| **W23-SOCIAL-1** | Space / member / invite models · channel `space_id` · migration + backfill | **Done (uncommitted)** — `chat_spaces.py` · `/api/chat/spaces*` · **QA 16/16** |
| **W23-SOCIAL-2** | Voice channels · room resolver + default deny · **closes the ACL gap** | **Done (uncommitted)** — covered by the same 16/16 |
| **W23-SOCIAL-3** | Space rail · text/voice channel lists · invite flow · scoped `VoiceLobby` | **Done (uncommitted)** — `SpaceRail.jsx` **QA 7/7** · free-text room box removed · voice panel names the room and says plainly when it is the shared lobby |
| **W25-STORE-1** | `curated_for_you` · `upcoming` · schedule + layout columns | **Done (uncommitted)** — `storefront.py` · `is_live()` window |
| **W25-STORE-2** | Admin shelf/event settings · member storefront UI | **Done (uncommitted)** — `PUT /admin/api/discovery_sections/<id>/schedule` (layout + window, **any** shelf incl. seed) · Discover renders `layout` + live "Event · ends in N days" |
| **W25-ZONES** | Roku-like ambient zones · screensaver gaming city | Queued (unchanged) |
