# Troubleshooting (members)

Quick checks before pinging an admin.

## Blank / broken UI

| Symptom | Likely cause | What to try |
|---|---|---|
| Unstyled Discover/Library | Missing frontend build | Admin rebuilds image / `member-app` dist |
| Spin forever / Discover stuck on Loading while nav works | Old image without ASGI SSE fix, or companion SSE holding the only worker | Ask admin to rebuild from current tree (not restart alone) — [admin troubleshooting](../admin/troubleshooting.md#spa-navigates-but-pagesadmin-hang-discover-stuck-on-loading). Clear site data if Friends dock was stuck open. |
| Spin forever (API 401/500) | Auth / server error | Hard refresh; re-login; admin check `/readyz` + logs |
| Theme didn’t apply | Cache / wrong preference | Preferences → re-pick theme; hard refresh |
| Can’t find a page | Nav clutter | **Ctrl+K** / ⌘K command palette — [faq.md](faq.md) |
| Chat cramped on phone | Old frontend build | Admin rebuild `member-app` (Chat stacks ≤900px) |
| Huge tiles on phone | Pref L/XL before density polish | Rebuild; tiles clamp automatically under 900px |
| Some store links on details look like plain text | Logo assets not shipped yet for that store | Expected for itch · Humble · EA · Ubisoft · Xbox · PSN · Amazon · wikia/fandom · unknown — link still works; Steam/GOG/Epic/IGDB/YouTube/Wikipedia/official have marks |

## Downloads

| Symptom | Likely cause | What to try |
|---|---|---|
| Download 404 | Path missing on games volume | Admin verify library path / scan |
| Empty or tiny zip | Folder empty / wrong root | Admin Library Doctor / re-scan |
| Forbidden | ACL / child role | Ask admin for library access |

## Play in browser (WebRetro)

| Symptom | Likely cause | What to try |
|---|---|---|
| Core won’t start | Unsupported system / missing BIOS | See admin emulator profiles; some systems are companion-only |
| Save missing | Cloud save flag / encrypt | Re-try; admin check emulator saves settings |

## Social / voice

| Symptom | Likely cause | What to try |
|---|---|---|
| Friends pill missing | Old frontend build | Admin rebuild `member-app`; use **More → Friends window** |
| Chat empty | No channels yet | Admin/librarian may need to create `#general` |
| Voice token fails | LiveKit off / misconfigured | Admin: `ENABLE_LIVEKIT` + [livekit-unraid.md](../runbooks/livekit-unraid.md) |
| Screenshare denied | Child account | Expected — camera/screenshare blocked for children |
| Looking for Discord webhooks | Not supported | Use chat / notifications / Report issue — [faq.md](faq.md) |

## Desktop companion

| Symptom | Likely cause | What to try |
|---|---|---|
| Connect fails 401/403 | Bad token / scopes | Recreate API token with `read:library` (+ `write:download`) |
| Download / Update greyed in companion | Offline heartbeat | Re-Connect; Play/Install/Uninstall still work — [desktop-companion.md](desktop-companion.md) |
| Friends window can’t install games | By design (least-privilege) | Use the main companion window |
| Update never appears | Local registry not merged | Re-Connect companion; see [desktop-companion.md](desktop-companion.md) |
| Leftover `.staging` folder | Interrupted update | Uninstall title in companion, or delete the staging folder |

## Report still needed?

Use **More → Report issue** with deploy (Unraid/Compose), URL, and trimmed logs — [faq.md](faq.md).
