# README media assets

Everything the root [README.md](../../README.md) shows. Screenshots are
**live** Playwright captures of a stock install; the art is drawn from the
theme's own tokens and icons. Recipe and gates: [CAPTURE.md](CAPTURE.md).

| File | Use | Made by |
|---|---|---|
| `app-icon.png` · `oneirodex_mark.svg` | Product mark | `scripts/render-brand-assets.py` from the SVG geometry |
| `hero-banner.png` | Hero — Discover framed on the theme background with the wordmark | `render_readme_art.py` from `screenshot-discover.png` |
| `h-*.svg` | Section headers (accent bar · kicker · title) | `render_readme_art.py` |
| `card-*.svg` | Feature cards with the shared rail icons | `render_readme_art.py` |
| `poster-*.png` | How-to video tiles: poster frame + play badge + title strip | `render_readme_art.py` from `docs/media/video/howto/index.json` |
| `screenshot-*.png` · `command-palette.png` | The screens gallery | `capture_docs_media.py` |

## Sync rule

Every ship pass that touches member or admin UI re-runs capture, then the art
renderer, before the README goes out:

```bash
python scripts/serve_capture.py             # in one shell
python scripts/capture_docs_media.py        # stills (exit 3 = something skipped)
python scripts/capture_howto_videos.py      # narrated clips
python scripts/render_readme_art.py         # hero, headers, cards, posters
```

Retired: `hero-banner.jpg`, `screenshot-*.jpg` — illustrative previews from
before capture existed; do not wire them back in.
