# What is missing, half-done, or subpar — 2026-08-05

Written after the W23/W25/W26 waves shipped and all docs/media were re-captured.
Three lists: **broken or half-built things we own**, **subpar UX**, and
**competitor features we do not have**. Ranked within each by cost-to-value.

Sources: [competitive-scan-2026-08-04.md](competitive-scan-2026-08-04.md) ·
[review-2026-08-03-findings.md](review-2026-08-03-findings.md) · direct code read.

---

## A. Ours, and not actually finished

### A1. The scraper cascade still stops at two sources — **highest priority**

This was asked for explicitly ("ensure all available scrapers are used when one
does not find it") and only half landed. The Steam *mapping* bug was fixed; the
*cascade* was not.

`gametheca/utils/secondary_scrapers.py::enrich_game_metadata` tries **Steam,
then RAWG**, and stops:

```python
steam_data = fetch_steam_data(game_name)
if rawg_api_key or missing_core_fields(metadata):
    rawg_data = fetch_rawg_data(...)
```

Meanwhile the module already implements `search_gog_games`, `search_epic_games`,
`search_itch_games`, `search_giantbomb_games`, plus MobyGames and TheGamesDB
elsewhere — all reachable from **manual** identify only. So a title Steam and
RAWG both miss stays bare even though we can already query five more sources.

**Fix:** turn the two-step into an ordered cascade that continues while
`missing_core_fields()` is true, with a per-source timeout and a cap. Sources
needing a key skip themselves when unset.

### A2. Test suite has one shared-state isolation defect

Documented but never fixed. Tests pass individually and fail in bulk (e.g.
`test_cover_art_studio` throws "Working outside of application context" only
when run with the wider suite). It is **one** fixture problem, not ~47 bugs —
proven by running against a fresh DB. Needs an autouse truncation fixture or
per-test rollback in `conftest.py`. Until then the suite cannot gate CI honestly.

### A3. Local capture instance 500s mid-run

`RuntimeError: CurrentThreadExecutor already quit or is broken` under Python
3.14 + asgiref when a request is aborted mid-flight. The capture script now
detects and skips rather than shipping error pixels, but the underlying bridge
failure is unfixed. Unclear whether it affects the Docker deploy (different
Python); worth confirming before it bites a real user.

### A4. Unverified modules

`ruffle_play` and `save_crypto` were flagged during the cleanup sweep and never
confirmed as reachable. Either wire them up or delete them.

### A5. In-player theming (D5) deliberately skipped

WebRetro is vendored, so themes stop at the player boundary. Fine as a decision,
but it means the play surface visibly ignores the user's theme.

---

## B. Subpar, not broken

| Area | Problem |
|---|---|
| **Library is the only page with a system backdrop** | Discover, Systems and Favorites still render flat. The backdrop component is generic — wiring it to those is small. |
| **Fonts stop at the SPA boundary** | `@font-face` is now served and applied, but the WebRetro player and generated cover art both ignore the choice. Cover art could use the era face per platform — the hint map already exists. |
| **No empty-state art** | A new install shows text-only empty states. We generate cover art; we could generate empty-state art from the same palette. |
| **Admin is still mostly Jinja** | Two SPAs plus Jinja admin means three UI idioms. `DataTable` helped; the rest is unmigrated. |
| **Sample library is 5 ROMs** | Every screenshot and video is honest but sparse. Not a product flaw, but it makes the project look emptier than it is. |

---

## C. Competitor features we do not have

Ranked by fit against what already exists, not by how often they appear.

### C1. Nested AND/OR filter builder + saved filters — *best fit, do first*
*(PlayDate, ZGameLib, gamelog)*
Our filters are flat chips. Saved filters would immediately feed **Discover
shelves**, which already accept a filter config — so one feature lands twice.
This is the single highest-leverage item on the list.

### C2. Session tracking + activity heatmap
*(DrNefarius, ZGameLib, burakbehlull)*
We record playtime totals but not **sessions**, so we cannot show a
GitHub-style habit heatmap, per-session notes, or idle-pause. The companion
already detects process start/stop — most of the hard part exists.

### C3. Persistent "not interested"
*(Floppy)*
`curated_for_you` has no negative signal, so a bad recommendation returns
forever. One table, one button, immediate quality win on a feature we just built.

### C4. Taste picker / randomiser
*(PlayDate "Pick 6", ZGameLib spin wheel)*
Cheap on top of `build_curated_for_you`, which already derives affinity from
favourites and genres. Good "I don't know what to play" surface.

### C5. Apprise notifications
*(Questarr, Floppy)*
One dependency, 100+ providers, replaces all bespoke notifier work. Fits the
existing BYO-sidecar pattern exactly.

### C6. Wikidata + RAWG as fallback metadata sources
*(5 projects)*
Wikidata needs **no API key** and is openly licensed — ideal default for
self-hosted. Directly reinforces **A1**.

### C7. Copy-level physical detail
*(RetroVault)*
Condition, CIB, cost, valuation. A real gap for collectors and orthogonal to
everything we have. Larger build; only worth it if collectors are a target user.

### C8. Public list pages with RSS/JSON
*(Floppy)*
Share a curated list outside the household. Needs a careful auth story — this is
the one item here that widens the attack surface.

### C9. Deal / subscription detection
*(Inderjit01)*
IsThereAnyDeal / PlatPrices. Pairs naturally with the storefront work.

---

## Suggested order

1. **A1 scraper cascade** — an explicit ask, half-done, and it degrades every import
2. **A2 test isolation** — everything else is riskier to ship without it
3. **C1 saved filters** — one build, two features (filters + shelves)
4. **C3 not-interested** + **C4 taste picker** — small, and they finish the storefront
5. **C2 session tracking** — bigger, but the companion already has the signal

Explicit non-goals unchanged: no media-tracker verticals (Floppy), no DRM store
download queues, no scraping of third-party ROM databases.
