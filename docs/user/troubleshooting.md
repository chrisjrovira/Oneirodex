# Troubleshooting (members)

Quick checks before pinging an admin.

## Blank / broken UI

| Symptom | Likely cause | What to try |
|---|---|---|
| Unstyled Discover/Library | Missing frontend build | Admin rebuilds image / `member-app` dist |
| Spin forever / Discover stuck on Loading while nav works | Old image without ASGI SSE fix, or companion SSE holding the only worker | Ask admin to rebuild from current tree (not restart alone) — [admin troubleshooting](../admin/troubleshooting.md#spa-navigates-but-pagesadmin-hang-discover-stuck-on-loading). Clear site data if Friends dock was stuck open. |
| Spin forever (API 401/500) | Auth / server error | Hard refresh; re-login; admin check `/readyz` + logs |
| Theme didn’t apply | Server predates the constant-folding fix | Fixed — see [below](#a-new-theme-doesnt-appear-after-reload). On an older build only a server restart applied a theme change. |
| Font pref changed nothing | Server predates the `fonts.css` fix | Fixed — see [below](#the-font-preference-had-no-effect). On an older build no font choice, including the default, ever reached the page. |
| Can’t find a page | Nav clutter | **Ctrl+K** / ⌘K command palette — [faq.md](faq.md) |
| Chat cramped on phone | Old frontend build | Admin rebuild `member-app` (Chat slide-out stacks ≤900px) |
| Huge tiles on phone | Pref L/XL before density polish | Rebuild; tiles clamp automatically under 900px |
| Some store links on details look like plain text | Logo assets not shipped yet for that store | Expected for itch · Humble · EA · Ubisoft · Xbox · PSN · Amazon · wikia/fandom · unknown — link still works; Steam/GOG/Epic/IGDB/YouTube/Wikipedia/official have marks |

### A new theme doesn't appear after reload

**Fixed.** Picking a theme saved the preference and changed nothing you could
see: the page came back with the previous theme's colours, and only a server
restart ever applied one. Re-picking, hard refreshing and clearing the cache all
made no difference, because none of them were the problem.

Every template asks for its stylesheets with a *literal* path, and Jinja
evaluates a filter applied to a literal once, at template-compile time, then
caches the compiled template for the life of the server process. The first
page rendered after a restart therefore baked its theme's URLs into every later
render. The `<html data-theme>` attribute is a variable, never folded, which is
why the page correctly *announced* the new theme while wearing the old one.

If you are on a build from before this fix, a server restart is the workaround.

### The font preference had no effect

**Fixed.** Preferences → **Font** saved your choice and the picker listed every
face, but nothing on any page ever changed — including back to the default.

The stylesheet that declares the font families, `/api/theme/fonts.css`, failed
on every request with a server error. So the `@font-face` rules were never
delivered and `--gt-font-family` was never set: the browser fell through to its
own defaults no matter what was chosen. It affected everyone equally, signed in
or out, which is why it did not look preference-shaped.

There is no workaround on a build from before this fix — the fix is a server
update.

## Downloads

| Symptom | Likely cause | What to try |
|---|---|---|
| Download 404 | Path missing on games volume | Admin verify library path / scan |
| Empty or tiny zip | Folder empty / wrong root | Admin Library Doctor / re-scan |
| Forbidden | ACL / child role | Ask admin for library access |

## Play in browser (WebRetro)

| Symptom | Likely cause | What to try |
|---|---|---|
| Core won’t start | Unsupported system / missing BIOS | See admin emulator profiles; some systems are companion-only. Confirm required BIOS names under Admin → emulator BIOS — [browser-play.md](browser-play.md#bios--firmware-filenames-only) |
| Save missing | Cloud save flag / encrypt | Re-try; admin check emulator saves settings |
| Play fails / blank after Start (zip/7z/rar/gz) | Archive has no playable ROM, wrong member, or missing unrar/py7zr | Prefer one ROM per archive; use `.zip` with a known ROM ext; single-file `game.nes.gz` is OK — not `.tar.gz`. Check `/api/downloadrom/<uuid>` JSON (`error`, `code`, optional `hint`) |
| PS1 (or other `.cue`-based disc) never starts / stuck loading ROM | Large cue+bin download still in flight, or BIOS missing | Disc sets download as a bundled `play.zip` (cue + bin/img together) and can take a while on slower storage/network — let it finish. Confirm SCPH/region BIOS via Admin upload **or** household private BIOS mount — [browser-play.md](browser-play.md#bios--firmware-filenames-only) · [PS1 zip note](browser-play.md#ps1-and-other-disccue-downloads-are-bundled-as-a-zip) |
| No browser Play button on a scanned `.gz` | Non-ROM gzip (e.g. `.tar.gz`) | Repack as `.zip` / raw ROM; Play is suppressed for unsupported archives |
| No sound on Start | Browser autoplay policy suspends audio until a page gesture | Click once into the play screen, then press Start |
| SNES game crackles / audio pitch shifts on busy scenes | WASM CPU pressure causing emulation slowdown | Pre-start gear → **Reduce Slowdown (Overclock)**; still choppy → use desktop companion for that title — [browser-play.md](browser-play.md#audiovideo-tuning--wasm-limits-snes-and-friends) |

## Social / voice

| Symptom | Likely cause | What to try |
|---|---|---|
| Friends pill missing | Old frontend build | Admin rebuild `member-app`; use **More → Friends** |
| Chat empty | No channels yet | Admin/librarian may need to create `#general` |
| Voice token fails | LiveKit off / misconfigured | Admin: `ENABLE_LIVEKIT` + [livekit-unraid.md](../runbooks/livekit-unraid.md) |
| Screenshare denied | Child account | Expected — camera/screenshare blocked for children |
| Looking for Discord webhooks | Not supported | Use chat / notifications / Report issue — [faq.md](faq.md) |

## Desktop companion

| Symptom | Likely cause | What to try |
|---|---|---|
| Connect fails 401/403 | Bad token / scopes / truncated paste | Account → API tokens: recreate with Desktop companion preset; paste full `gt_<prefix>_<secret>` (hyphens/`_` in the secret are normal — do not truncate after `-`). **Copy secret** copies the raw token only. On HTTP LAN, select the secret field + Ctrl+C if Copy fails. Server WARNING: `api_token_auth_failed reason=… prefix=…` |
| Download / Update greyed in companion | Offline heartbeat | Re-Connect; Play/Install/Uninstall still work — [desktop-companion.md](desktop-companion.md) |
| Friends window can’t install games | By design (least-privilege) | Use the main companion window |
| Update never appears | Local registry not merged | Re-Connect companion; see [desktop-companion.md](desktop-companion.md) |
| Leftover `.staging` folder | Interrupted update | Uninstall title in companion, or delete the staging folder |

## Report still needed?

Use **More → Report issue** with deploy (Unraid/Compose), URL, and trimmed logs — [faq.md](faq.md).
