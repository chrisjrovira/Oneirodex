# How-to videos

Short screen recordings, one per section, each walking a **worked example**:
open the thing, use it, show the result. Recorded by
[`scripts/capture_howto_videos.py`](../../../../scripts/capture_howto_videos.py)
against a local capture instance — see
[CAPTURE.md](../../../assets/readme/CAPTURE.md) for the recipe.

No narration and no captions: these are silent walkthroughs meant to sit beside
the written guide, not replace it. The prose says *why*; the clip shows *where*.

## Members

| Video | Shows | Guide |
|---|---|---|
| `howto-library.webm` | Browsing the library, opening filters, resizing tiles, opening a title | [library-and-systems.md](../../../user/library-and-systems.md) |
| `howto-game-details.webm` | Reading a game page — details, versions, extras, screenshots | [library-and-systems.md](../../../user/library-and-systems.md) |
| `howto-discover.webm` | Discover as a storefront — curated, upcoming, shelves | [library-and-systems.md](../../../user/library-and-systems.md) |
| `howto-systems.webm` | Systems hub by console family, and set completion | [library-and-systems.md](../../../user/library-and-systems.md) |
| `howto-chat-spaces.webm` | Household rooms, spaces, and their channels | [social-and-voice.md](../../../user/social-and-voice.md) |
| `howto-preferences.webm` | Theme, icon pack and font | [preferences-themes.md](../../../user/preferences-themes.md) |
| `howto-command-palette.webm` | Ctrl/Cmd+K to get anywhere | [getting-started.md](../../../user/getting-started.md) |

## Admins

| Video | Shows | Guide |
|---|---|---|
| `howto-admin-libraries.webm` | Libraries and scan management | [libraries-and-scans.md](../../../admin/libraries-and-scans.md) |
| `howto-admin-discover.webm` | Arranging shelves, scheduling events | [discover-sections.md](../../../admin/discover-sections.md) |
| `howto-admin-ops.webm` | Ops health — services, queues, companions | [ops-summary.md](../../../admin/ops-summary.md) |

## What these clips honestly do not show

The capture instance is seeded with the five **legal free sample ROMs**, so:

- **Related media** — no sample title has any, so the popup is not demonstrated.
  The section only renders when a game actually has entries.
- **Screenshots / trailers** — the sample ROMs carry none, so the lightbox is
  not demonstrated.
- **Voice** — LiveKit is off in the capture env, so no voice session is joined.
- **Fonts** — the picker appears in `howto-preferences.webm`, but the font
  *files* are operator-supplied and not installed on the capture box, so
  switching faces does not visibly change the type. See
  [theme-fonts-and-images.md](../../../admin/theme-fonts-and-images.md).

These are gaps in the *sample data*, not in the product. They are listed here so
nobody re-records expecting different footage, and so no clip is ever staged
with invented content to fill them.

## Re-recording

```bash
python scripts/capture_howto_videos.py                    # all sections
python scripts/capture_howto_videos.py library discover   # just these
```

A section whose UI it cannot drive prints `skip: no affordance for …` and, if
login itself fails, writes **no file at all** rather than a broken recording.
