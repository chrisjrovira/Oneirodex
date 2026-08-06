# What is missing, half-done, or subpar — 2026-08-05

Written after the W23/W25/W26 waves shipped and all docs/media were re-captured.
Three lists: **broken or half-built things we own**, **subpar UX**, and
**peer-derived gaps**. Ranked within each by cost-to-value.

Sources: private competitive vault (`docs/_private/`, see [competitive.md](competitive.md)) ·
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

### A2. Test suite has three harness defects (not one)

**Superseded 2026-08-06** — see
[code-review-2026-08-06.md](code-review-2026-08-06.md) §2.4. A full run
(126 failed / 2,965 passed / 17 errors) plus isolated re-runs showed the
"one shared-state isolation problem" reading was wrong: the largest share is
an unset `SERVER_NAME`, then fixtures whose bulk `delete(Game)` bypasses ORM
association cleanup, then genuine context leaks. None is a product defect,
but the suite still cannot gate CI.

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

## C. Peer-derived gaps

Held in the private vault per **SCRUB-2** — competitive intel does not ship in
public git. See `docs/_private/gap-review-2026-08-05-FULL.md` and
[competitive.md](competitive.md).

In product language, the ranked opportunities are:

1. **Nested AND/OR filter builder with saved filters** — our filters are flat
   chips. Saved filters would also feed Discover shelves, which already accept a
   filter config, so one build lands two features.
2. **Session tracking + activity heatmap** — we record playtime totals but not
   sessions, so no habit view and no per-session notes.
3. **Persistent "not interested"** — the storefront has no negative signal, so a
   bad recommendation returns forever.
4. **Taste picker / randomiser** — cheap on top of `build_curated_for_you`.
5. **Copy-level physical detail** — condition, CIB, cost for collectors.
6. **Wikidata as a metadata source** — no API key, openly licensed; feeds the
   multi-source cascade.
7. **Public list pages with RSS/JSON** — needs a careful auth story.
8. **Deal / subscription detection** — pairs with the storefront work.

## Suggested order

1. **A1 scraper cascade** — an explicit ask, half-done, and it degrades every import
2. **A2 test isolation** — everything else is riskier to ship without it
3. **C1 saved filters** — one build, two features (filters + shelves)
4. **C3 not-interested** + **C4 taste picker** — small, and they finish the storefront
5. **C2 session tracking** — bigger, but the companion already has the signal

Explicit non-goals unchanged: no media-tracker verticals, no DRM store
download queues, no scraping of third-party ROM databases.
