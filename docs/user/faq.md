# FAQ (members)

## Navigation

**How do I jump around quickly?**  
**Ctrl+K** (⌘K on Mac) or the top-nav **Search** hint opens the command palette — pages, Preferences, Help, Admin.

## Sign-in & accounts

**I can’t log in.**  
Ask an admin to check your invite/whitelist and that the server is up (`/healthz` liveness · `/readyz` ready). SSO only works if Admin → Integrations has OIDC enabled *and* `OIDC_ENABLED=true`. After several failed passwords you may see “Too many login attempts” — wait a few minutes.

**Child account can’t see some games.**  
Parental ACL / library allowlists filter the library. That’s intentional.

## Library & downloads

**Library looks unstyled.**  
Missing `member-app.css` — admin must rebuild the Docker image / frontend dist.

**Download stuck or empty zip.**  
Confirm the game path exists on the games mount and you’re not a child blocked from that library. See [troubleshooting.md](troubleshooting.md).

**What do OUT / ~ badges mean?**  
Freshness: update available or heuristic “behind.” Open the game for details.

## Themes & icons

**Theme vs icon pack?**  
Color theme = palette/chrome. Icon pack = glyph style (outline, filled, …). Independent — [preferences-themes.md](preferences-themes.md).

**Why do some games show a GameTheca placeholder cover?**  
Titles without downloaded artwork use branded fallbacks (`default_cover.jpg`). Admins can generate custom placeholders in **Admin → Settings → Art studio** and attach them to games or set a site-wide fallback pack.

## Social & voice

**Where are friends?**  
Use the **Friends** pill (bottom-right), **More → Friends window**, or Big Picture **Y**. Pop out / desktop “Open friends window” parks `/social-companion` on another monitor — [social-and-voice.md](social-and-voice.md).

**Where is chat?**  
**More → Chat** (household channels + DMs). React with emoji; search messages from the top of the page. Optional BYO Stoat/Matrix link if the admin set Community chat.

**Voice doesn’t appear.**  
LiveKit is optional. If off, Activity shows “LiveKit is off.” Admins enable `ENABLE_LIVEKIT` + compose profile — [social-and-voice.md](social-and-voice.md).

**Play via Moonlight on game details?**  
Optional. When the admin enables remote play and registers a BYO Sunshine or Wolf host, game details show **Play via Moonlight** — it copies the host and app/PIN hints for your Moonlight client. GameTheca does not stream in the browser.

**Can I use Discord webhooks?**  
No. GameTheca does not integrate Discord (bots or webhooks). Use in-app notifications, chat, optional email for mentions/DMs, or optional LiveKit / BYO community link.

**Does GameTheca ship peer “we’re not Product X” catalogs?**  
No — public docs use GameTheca capability language only. Competitive intel stays in the private vault (`docs/_private/`, gitignored).

## Free games

**Where do free Steam/Epic/GOG offers show up?**  
**News → Free now.** Claim opens the store page (or launcher if that account is linked under Ownership). Details: [free-games.md](free-games.md).

**Will GameTheca add the game to my DRM library automatically?**  
No — claim on the store, then sync Ownership for badges. Local DRM-free library folders are separate.

## Reporting bugs

**How do I report an issue?**  
**More → Report issue**. That opens a ticket for admins and syncs to GitHub Issues when configured. You’ll get confirmation with a ticket id (and GitHub link if synced).

## Big Picture

Gamepad-friendly browse at **More → Big Picture**. Esc exits; Attract opens trailers. Full button map (Xbox + DualSense): [controllers-and-vr.md](controllers-and-vr.md).

## VR / headsets

`/vr` is headset-friendly browse (admin flag), **not Quest-only** — PSVR2/SteamVR use a desktop browser on the PC; Quest friends use the headset browser/PWA. See [controllers-and-vr.md](controllers-and-vr.md).

