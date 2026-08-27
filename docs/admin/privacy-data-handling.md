# Privacy & data handling (operator notes)

This is **not** a public privacy policy, **not** a terms-of-service, and **not** legal advice.
Oneirodex is self-hosted: the machine you run it on holds the data, and **you** decide what to tell
the household. Use this as a fact sheet to adapt, not as something to publish as if Oneirodex Inc.
were the controller.

The product used to serve WebRetro's upstream ToS / privacy / cookie pages from every deployment
(finding L3). Those files are gone so this host does not impersonate another site's operator.

Related: [members-and-invites.md](members-and-invites.md) · [settings-modules.md](settings-modules.md) ·
[../strategy/security.md](../strategy/security.md) ·
[webretro-core-clauses.md](webretro-core-clauses.md) (snes9x / genesis_plus_gx — not counsel)

## What stays on your server

| Kind | What | Notes |
|---|---|---|
| Accounts | Username, Argon2 password hash, role, optional email | Emailless accounts use an unroutable `.invalid` placeholder — [members-and-invites.md](members-and-invites.md) |
| Sessions | Signed session cookie + CSRF token | Same-origin. API tokens are **hashed** (SHA-256); the raw `gt_…` secret is shown once |
| Library | Game metadata, paths, artwork you stored | Paths point at disks you mounted (`DATA_FOLDER_GAMES`, `GT_LIBRARY_ROOTS`) |
| Playtime | Per-user totals and session heartbeats | `share_activity` (default on) controls whether others in the household see it |
| Presence | Online / away / in-game | Derived from play sessions and companion heartbeats, not a third-party tracker |
| Chat | Channel messages, reactions, attachments | Household Spaces only. **No Discord** |
| Store ownership | Steam ID; GOG refresh token; Epic device-auth JSON; synced title IDs | Register only — never a store download. Tokens are not returned by the ownership API after save |
| Notifications | In-app inbox + archive | Optional SMTP for mentions/DMs and a daily digest, each a member preference |
| Support reports | Title, body, optional logs, client/url hints | Stays local unless you configured GitHub issue sync |
| Companion devices | Heartbeat / last-seen | Desktop client stores its token in the OS credential store, not plaintext config |

There is no Oneirodex cloud account, no product analytics SaaS, and no Discord.

## What can leave the machine (only if you turn it on)

| Channel | When | What goes out |
|---|---|---|
| SMTP | You set a mailer | Invite links, optional social/digest mail — only to addresses you or members provided |
| Steam / GOG / Epic ownership | Member saves a Steam ID, GOG refresh token, or Epic device auth (or household env) | Store account ids and owned-title lists come back. Tokens stay on this host. Unofficial Galaxy / launcher APIs for GOG and Epic |
| News feeds | `GT_NEWS_FEEDS` (http/https only) | The **server** fetches those URLs; members can hide individual sources |
| OIDC | `OIDC_ENABLED` | Username / email / groups from *your* IdP (Authentik, etc.) |
| LiveKit | Voice profile | Room tokens for household voice; media goes to the LiveKit you deployed |
| GitHub support | `SUPPORT_GITHUB_*` | Report titles/bodies you chose to file upstream |
| WebRetro cores | First boot fetch | WASM cores from the operator-provisioned install path — [webretro-cores.md](../runbooks/webretro-cores.md) |

ROM files, BIOS, and artwork you pointed the library at never upload to a Oneirodex service — there isn't one.

## Child accounts

`child` is not a cosmetic label. On top of parental library allowlists:

- No `admin`, `write:library`, or `write:download` — on **session cookies and Bearer tokens**
- Cannot mint those scopes (including the Desktop companion preset)
- `GET /api/acquire/search` returns 403
- Companion download / install / update / uninstall / patch / mod-pack commands are denied

Thin-client tokens (browse / social) still work. Details: [security.md](../strategy/security.md) (S10).

## Backups and deletion

Postgres holds accounts, chat, playtime, and the catalog. Game files live on the library mounts.
Deleting a user cascades their progress, tokens, and chat authorship per schema `ON DELETE`.
There is no built-in "export my data" package — dump the database if a household member asks for a copy.

Admin → System danger-zone reset can wipe catalog / libraries / users / settings in-app; it **never
touches files on disk**.

## Adapting this for a real notice

If you need a notice for your jurisdiction, keep the facts above and add: who operates the host,
how long you keep backups, how a member asks you to delete an account, and whether any of the
optional outbound rows are actually enabled on *this* deploy. Do not paste WebRetro's or any other
vendor's policy onto your domain.
