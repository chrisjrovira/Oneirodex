# README media assets

Product mark and **live** UI captures used by the root [README.md](../../README.md).

| File | Use | Source |
|---|---|---|
| `app-icon.png` | Centered README icon | Product icon |
| `gametheca_mark.svg` | Product controller mark | SVG mark |
| `hero-banner.png` | Hero strip | Playwright capture (`/library`) |
| `screenshot-library.png` | Library preview | `library-free-roms.png` capture |
| `screenshot-systems.png` | Systems preview | `systems-platforms.png` capture |
| `screenshot-chat.png` | Chat / Activity preview | **Blocked** — `/login` + `/library` 500 this pass; script writes slot when app healthy — [CAPTURE.md](CAPTURE.md) |

## Sync rule

README hero and screenshot slots must be **live Playwright captures**, not illustrative mock art. On every commit/ship pass that touches member or admin UI (or whenever Docs is on the wave), re-run:

```bash
python scripts/capture_docs_media.py
```

Or copy the freshest files from `docs/media/screenshots/` into the canonical readme slots above before ship.

Retired: `hero-banner.jpg`, `screenshot-*.jpg` (illustrative previews — do not wire back into README).

Full checklist: [CAPTURE.md](CAPTURE.md).
