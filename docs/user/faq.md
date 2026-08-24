# FAQ (members)

## Navigation

**How do I jump around quickly?**  
**Ctrl+K** (⌘K on Mac) or the top-nav **Search** hint opens the command palette — pages, Preferences, Help, Admin. On **Library**, Ctrl+K searches **library titles** first (Search library group); Navigate / More / Account stay listed.

**How do I jump to the top or bottom of a long page?**  
When the member page is scrollable, aurora glass **Jump to top** / **Jump to bottom** controls appear (bottom-left, clear of the Friends/Chat dock). They hide on short pages that don’t scroll.

## Sign-in & accounts

**I can’t log in.**  
Ask an admin to check your invite/whitelist and that the server is up (`/healthz` liveness · `/readyz` ready). SSO only works if Admin → Integrations has OIDC enabled *and* `OIDC_ENABLED=true`. After several failed passwords you may see “Too many login attempts” — wait a few minutes.

**I can’t pair the desktop companion.**  
Account menu → **API tokens** (`/tokens`). Create with the **Desktop companion** preset, then **Copy secret** (raw `gt_…` only) into Connect. Format is `gt_<prefix>_<secret>` — the secret segment may include `-` / `_`; paste the **full** string (do not stop at the last `-`). Thin seats use the **Thin client** preset (no download). Browser **Copy** writes only the `gt_…` secret; on plain HTTP LAN (common on Unraid), use the Copy fallback or select the secret field and Ctrl+C / ⌘C. See [desktop-companion.md](desktop-companion.md) · [thin-client.md](thin-client.md).

**Why can’t I Install / Play in the thin client?**  
By design — thin is connect-only (browse / social / Big Picture). Use the **full** companion on the install PC. Build: `npm run tauri:build:thin` — [thin-client.md](thin-client.md).

**Child account can’t see some games.**  
Parental ACL / library allowlists filter the library. That’s intentional.

## Library & downloads

**Library looks unstyled.**  
Missing `member-app.css` — admin must rebuild the Docker image / frontend dist.

**Download stuck or empty zip.**  
Confirm the game path exists on the games mount and you’re not a child blocked from that library. See [troubleshooting.md](troubleshooting.md).

**Why is Download hidden / “Missing on disk” on a version?**  
Game details lists installs with honest presence: a version marked **Missing on disk** (`path_missing`) is not downloadable — Download is hidden for that row. The **Default** chip marks the base install. Measured **size** shows when known. Librarians/admins can **Remove missing versions** (orphan cleanup) when stale version rows linger after files moved. See [library-and-systems.md](library-and-systems.md) · [downloads.md](downloads.md).

**How many games per Library page?**  
Preferences → items per page: **20 / 50 / 100 / 200 / 250 / 300 / 400 / 500 / 1000**.

**What are Signals chips?**  
Inside Library Filters: UPDATE · MISSING · NEW · LANG — same browse params as the badges; they persist with other filters. VR is a tile badge / More → VR, not a Signals chip. MISSING means files were removed from disk. Tile badges sit in four corners only (occupied corners; rounded-square chrome). No OUT / ~ / RELEASE on tiles or Signals chips (UPDATE alone covers freshness-behind).

**Can I hide the Library Filters column?**  
On desktop, the chevron collapses Filters to a slim rail so covers reclaim the width (saved in the browser). On phones/narrow tablets (≤900px), Filters still open as a drawer — collapse rail does not apply.

**What are Kind chips?**
Inside Library Filters: Games · Soft titles · Emulators · Utilities — multi-select sets `item_kind` on browse (comma list; API tokens stay `experience` / `tool`). None selected = all kinds. Persist with other library filters. Tile badges stay short (**EXP** / **TOOL**) with tooltips **Soft title** / **Utility**.

**Can I favorite, set play status, wishlist, or re-check freshness on many Library titles at once?**  
Yes via Library multi-select (checkbox / long-press / Shift+click · **Select page** for visible tiles): sticky Favorite / Unfavorite / **Add to wishlist** / **Play status** / Refresh freshness / **Refresh covers** (More; librarian+ · max 20) / Clear. Batch APIs: favorite set/clear (`POST /api/games/batch/favorite`, ≤100) · play status (`POST /api/games/batch/status`, ≤100; empty status clears) · wishlist queue (`POST /api/games/batch/wishlist`, ≤50; accounts that can request) · freshness re-probe (`POST /api/games/batch/freshness/check`, ≤50) · cover refresh (`POST /api/games/batch/refresh_images`, ≤20; 202 queued). Sticky **Refresh freshness** always re-probes the selection. Only titles you can see; partial-success toasts report updated/queued/skipped/failed. Admins still use library-wide `POST /api/admin/freshness/refresh`. No DRM download queues.

**A folder didn’t show up after a scan?**  
Librarians triage it under Admin → Scan management → Unmatched Folders (and Dupe glance). Each Unmatched row shows a **Why unmatched?** line (and a **Name transform trail** expander when Backend sends peel steps) so they can Identify as game or Mark as Soft title / Emulator / Utility. Bare folders named **UPDATE** / **Updates** stay Unmatched with an update-package why note — they are **not** auto-marked Soft title.

**Where are ES-DE / Pegasus export packs?**  
On **Systems**, scroll to the secondary **Export packs** section (below the platform grid) — optional downloads of ES-DE `gamelist.xml` and Pegasus metadata for other frontends. Admins also find them under Integrations → Export packs. Paths stay portable (no NAS mount leaks). See [library-and-systems.md](library-and-systems.md).

**Trailers page is empty.**  
That’s OK (HTTP 200 + CTA) when no trailer metadata is available yet — open a title that has video, or ask an admin to enrich metadata. On **game details**, trailers play from `trailers[].embed_url` (or a YouTube demo when no trailers).

**Where are Extras / DLC on a game?**  
Game details → **Extras & DLC**. Rows show honest **on-server** when the vault has the folder; PC libraries pick up common `DLC`/`extras` sidecars on scan — console DLC ingest is deferred.

**Open path does nothing / doesn’t open Auto Scan.**  
Open path uses **OpenPathModal** → companion `open_path` (or clipboard fallback). It never jumps to Auto Scan. Pair the desktop companion Online and send a path your PC can see — [desktop-companion.md](desktop-companion.md).

## Themes & icons

**Theme vs icon pack?**  
Color theme = palette/chrome (Wave 2d: glass/CRT/type + paired default pack). Icon pack = glyph style (outline, filled, …) — still overridable. Independent after save — [preferences-themes.md](preferences-themes.md). Preferences is sectioned (Library · Look & density · Game language) without heavy cards and uses the theme **swatch grid** (not name-only). **Preferences is the only place a theme is chosen** — admins included; the separate admin picker was retired in favour of one surface that cannot disagree with itself.

**Loading spinners look wrong / stuck on ring?**  
Household mode is Admin → Themes → **Loading icons** (rotate catalogue or lock one). Motif CSS needs **Reset Default Themes** after Wave 2d deploy — [themes-reset.md](../admin/themes-reset.md).

**Why do some games show a GameTheca placeholder cover?**  
Titles without downloaded artwork use branded fallbacks (`default_cover.jpg`). Admins can generate custom placeholders in **Admin → Settings → Art studio** and attach them to games or set a site-wide fallback pack.

**Do I need an admin to install fonts?**  
No. Every face the Font picker lists ships with GameTheca and is copied into place on each server start — no download, no admin step, works air-gapped. "Not installed" now means a real filesystem problem on the server, not the normal state. What is *not* bundled is console manufacturers' own typefaces; those are trademarked, so the bundled faces evoke each era instead — [preferences-themes.md](preferences-themes.md).

**I picked a theme and nothing changed after reload.**  
Fixed. On a build from before that fix, the whole install served whichever theme was current when its templates were first rendered, so only a server restart ever applied a change — re-picking and hard refreshing did nothing because neither was the problem. See [troubleshooting](troubleshooting.md#a-new-theme-doesnt-appear-after-reload).

**Theme/prefs look wrong after deploy?**  
Ask an admin for **Reset Default Themes** if `gt-account.css` / `modal-components` lag on the library volume — [themes-reset.md](../admin/themes-reset.md).

## Social & voice

**Where are friends?**  
Use the **Friends** pill (bottom-right), **More → Friends**, or Big Picture **Y**. Pop out / desktop “Open friends window” parks `/social-companion` on another monitor — [social-and-voice.md](social-and-voice.md).

**Where is chat?**  
**Chat** pill (bottom-left), **More → Chat**, or Ctrl/Cmd+K → Chat opens a **left slide-out** (rooms · messages · composer) — TopNav stays. `/chat` deep-links open the same panel then return you to Library. Dismiss with × / scrim / Esc; reopen anytime. Use **Add** to create a room (child accounts cannot). Thread header **Archive** (household rooms, creator/librarian+) and **Leave** (DM drop / household mute — room list shows a **muted** badge after leave). Optional BYO Stoat/Matrix if the admin set Community chat.

**Voice doesn’t appear.**  
LiveKit is optional. If off, Activity shows “LiveKit is off.” Admins enable `ENABLE_LIVEKIT` + compose profile — [social-and-voice.md](social-and-voice.md).

**Play via Moonlight on game details?**  
Optional. When the admin enables remote play and registers a BYO Sunshine or Wolf host, game details show **Play via Moonlight** — it copies the host and app/PIN hints for your Moonlight client. GameTheca does not stream in the browser.

**Can I use Discord webhooks?**  
No. GameTheca does not integrate Discord (bots or webhooks). Use in-app notifications, chat, optional email for mentions/DMs, or optional LiveKit / BYO community link.

**Does GameTheca ship peer “we’re not Product X” catalogs?**  
No — public docs use GameTheca capability language only. Competitive intel stays in the private vault (`docs/_private/`, gitignored).

## Updates & calendar

**Where are library updates?**  
**More → Updates** — freshness inbox (auto-refresh while the tab is visible), store search / apply packs, plus a short **Upcoming releases** teaser that links to the calendar. The refresh control and the "Updated HH:MM" timestamp sit together on the **Library freshness inbox** heading row, time first.

**The Updates inbox is empty — how do I make it check my library?**  
Press **Check library for updates** beside Refresh. The two do different things:

- **Refresh** re-reads what the *last* probe found. If nothing has ever been probed, refreshing forever will keep showing nothing.
- **Check library for updates** makes a new probe happen — `POST /api/updates/scan`, oldest-checked titles first, skipping anything probed in the last 24 hours.

Each press does one bounded batch (25 titles, 50 max) because every title is a live request to Steam / GOG — an unbounded sweep would hang for minutes and get you rate-limited. The line under the heading reports what it found and **how many titles are still to check**, so pressing again picks up where it left off. Librarians and admins still have the library-wide `POST /api/admin/freshness/refresh`.

**Where is the release calendar?**  
**More → Calendar** — IGDB releases (metadata only) with Ahead/Behind window controls and a **List / Month** view switcher (choice remembered in the browser). Month shows each day's **cover art**; when more than one title lands on a day the tile cycles through them every ten seconds and a `+N` badge says how many more there are. Click a day for the full list beneath the grid. GameTheca does not download those titles.

> The old **Agenda** view is gone. It was the List view with week headings between the rows — the same titles in the same order — so it was a third tab that never showed anything List did not. A browser still holding `agenda` as its remembered choice falls back to List.

## News & notifications

**Where is News?**  
**More → News** — tabbed feed (All · Admins · Free now · Headlines) with a featured strip and magazine densify (truncated body · readable dates). Empty tabs return an honest empty state (HTTP 200), not an error.

**Where do free Steam/Epic/GOG offers show up?**  
**News → Free now.** Claim opens the store page (or launcher if that account is linked under Ownership). Details: [free-games.md](free-games.md).

**Will GameTheca add the game to my DRM library automatically?**  
No — claim on the store, then sync Ownership for badges. Local DRM-free library folders are separate.

**Where are Notifications?**  
**More → Notifications** — dense unread inbox; alert prefs live under **Alert preferences**. Empty inbox is honest (HTTP 200). **Mark all read** sits on the **INBOX** heading row, aligned with the label and directly above the list it clears — not in the top bar, which holds page-level controls.

## Reporting bugs

**How do I report an issue?**  
**More → Report issue**. Title required; symptom and logs optional. Start with title, area, and severity. **Context** (deploy / client / URL) and **Logs** stay collapsed until you expand them. Tickets go to admins and sync to GitHub Issues when configured — confirmation shows a ticket id (and GitHub link if synced).

**Where is Help?**  
**More → Help** — accordion sections (Getting started open by default); use the topic chips or Expand all. Deep links like `/help#translations` still open that section.

Each section carries a colour and a glyph drawn from the theme's own semantic set (accent · info · success · warning · danger), so a topic can be found at a glance instead of by re-reading twelve identical headings — and a theme or icon pack restyles them along with the rest of the product. In the bar, **Expand all** is first and **Collapse all** is last, with *Report an issue* between them: they used to be adjacent, so overshooting Expand by one button collapsed everything you had just opened.

## Big Picture

Gamepad-friendly browse at **More → Big Picture**. Esc exits; Attract opens trailers. Full button map (Xbox + DualSense): [controllers-and-vr.md](controllers-and-vr.md).

## VR / headsets

`/vr` is headset-friendly browse (admin flag), **not Quest-only** — PSVR2/SteamVR use a desktop browser on the PC; Quest friends use the headset browser/PWA. Thin / headset seats have **no** install pipeline. See [controllers-and-vr.md](controllers-and-vr.md) · [headset-vr.md](../strategy/headset-vr.md).

