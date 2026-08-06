# Competitive scan — 14 projects (2026-08-04)

Scanned at human request. Two *arr-style acquisition tools, one broad media tracker, and eleven
library/tracker apps. Recorded here as **capability intelligence**, not a to-do list — several of
these are deliberate non-goals for GameTheca.

| Project | Shape | Worth taking |
|---|---|---|
| **ROMarr** | ROM *arr | Release **scoring with reasons shown** · per-platform routing to different backends · remote path mapping · ROM Hub plugin sources (firmware, cores) |
| **Questarr** | Game *arr | **Apprise** (100+ notifiers) · Steam wishlist sync · preferred release groups · PCGamingWiki + NexusMods, trending mods · post-processing pipeline |
| **Floppy** | Media tracker | **Smart lists** + public list pages with RSS/JSON · recommendation rows with persistent "not interested" · recap stats w/ compare + date ranges · copy-level owned detail · TOTP · scheduled backups · MCP server |
| **Omnio** | Local hobby tracker | **Cross-library linking (game ↔ book/anime/music)** · 13 metadata sources · save-file backup · yearly wrapped · data-health audits + duplicate detection |
| **PlayDate** | Multi-store library | **Nested AND/OR filter builder + saved filters** · configurable shelves from saved filters · "Pick 6" random/taste picker · gamepad navigation |
| **RetroVault** | Physical collecting | **Copy-level condition/CIB/cost** · PriceCharting valuation w/ 30-day trend · P&L + flip calculator · **Field Mode** for buying trips · 130+ badges |
| **ZGameLib** | Windows library | Auto-scan Steam/Epic/GOG/Ubisoft · filter builder AND/OR · spin-wheel picker · BepInEx/MelonLoader mod loaders · theme creator · portable mode |
| **DrNefarius/GameTracker** | Session tracking | **Process detection w/ auto session record** · idle-pause · **GitHub-style activity heatmap** · session feedback notes/ratings · crash recovery of partial sessions |
| **Yamtrack** | Media tracker | Jellyfin/Plex/Emby passive tracking · periodic auto-import · calendar view |
| **GalipEfeOncu/GameTracker** | Web+desktop | Hybrid IGDB **+ RAWG** catalogue · short-lived JWT + rotating refresh · bilingual UI |
| **Inderjit01/GameTracker** | Backlog tracker | **PlatPrices / IsThereAnyDeal** deal + subscription detection · multi-store price tracking |
| **gamelog** | Web tracker | RAWG catalogue · saved custom filters · CSV in/out |
| **vglist** | Rails app | **Wikidata** as metadata source — no API key, openly licensed |
| **burakbehlull/game-tracker** | Desktop social | Playtime + achievements · friends/chat · community most-played |

---

## Where GameTheca already leads

Worth stating so we don't "adopt" things we do better:

* **Browser play** (WebRetro + per-core BIOS validation) — none of the fourteen emulate in-app.
* **Detection depth** — BE-DET-1…10: console peel gating, DAT hashing incl. inner archives, region
  and language persistence, multi-disc grouping, fandom alias soft-matching. The *arrs score
  *releases*; we identify *what a folder actually is*.
* **Household social** — spaces with text/voice channels, membership-scoped LiveKit rooms.
* **Firmware honesty** — per-system BIOS readiness that distinguishes blocking from optional.
* **Match honesty** — propose-first paths, `why_unmatched`, bad-match feedback.

## Gaps that recur across many of them

Ranked by how often they appear and how well they fit what we already have:

1. **Nested AND/OR filter builder with saved filters** (PlayDate, ZGameLib, gamelog) — our filters are
   flat chips. Saved filters would also feed Discover shelves, which already accept a filter config.
2. **Apprise notifications** (Questarr, Floppy) — one dependency, 100+ providers, replaces bespoke
   notifier work. Fits the existing BYO-sidecar pattern.
3. **Session tracking + activity heatmap** (DrNefarius, ZGameLib, burakbehlull) — we record playtime
   but not sessions, so we cannot show a habit heatmap or per-session notes.
4. **Taste-profile picker / randomiser** (PlayDate "Pick 6", ZGameLib spin wheel) — cheap on top of
   `build_curated_for_you`, which already derives affinity from favourites and genres.
5. **Persistent "not interested"** (Floppy) — our storefront has no negative signal, so a bad
   recommendation keeps coming back.
6. **Copy-level physical detail** (RetroVault) — condition, CIB, cost. A real gap for collectors, and
   orthogonal to everything we have.
7. **RAWG + Wikidata as fallback sources** (5 projects) — Wikidata needs no key and is openly
   licensed, which suits a self-hosted default.
8. **Public list pages with RSS/JSON** (Floppy) — sharing a curated list outside the household.
9. **Deal / subscription detection** (Inderjit01) — IsThereAnyDeal, PlatPrices.

## Explicit non-goals

* **Media tracking for its own sake** (Floppy, Yamtrack, Omnio breadth). Human 2026-08-04: everything
  *except* the media verticals. Related media appears only where it is **attached to a game** — see
  below.
* **Flip/resale tooling** (RetroVault P&L, eBay fee calculator) — GameTheca is a library, not a
  trading desk. Condition tracking yes; profit modelling no.
* **Cracked-copy playtime framing** (burakbehlull) — off-stance.
* **Hosted AI recommendation calls** (gamelog, GalipEfeOncu use Gemini) — our curation stays on-box.

---

## Adopted now: related media on a game (human ask, 2026-08-04)

> *"build a section to show what of those media facets are available for any given game as a pop up in
> the content detail of the game before the screenshots and trailer"*

Closest prior art is **Omnio's cross-library linking** (anime adaptation ↔ manga, game tie-in ↔ book).
The distinction that keeps this out of non-goal territory: we are **not** building a media tracker.
A film only exists here because it is *the adaptation of this game*. Nothing is tracked, rated or
progressed — it is context on the game's page, with a link out.

Shape: `GameRelatedMedia` rows (kind = film · series · anime · book · comic · music · podcast),
each with a title, year, relation (adaptation / tie-in / soundtrack / novelisation / documentary),
optional external URL and cover. Surfaced as a **Related media** strip above screenshots and trailer,
opening a popup per item.

---

## Batch 3 — emulation platforms & frontends (supplied 2026-08-06)

Nine emulation distros / frontends. The human supplied these as a BIOS-pack
table and said **"ignore the bios parts"** — so they are reviewed here as
*products*, not as firmware sources. (Firmware stays operator-supplied per
[emulator-bios.md](../runbooks/emulator-bios.md).)

| Product | Category | What it does that we might want |
|---|---|---|
| **RetroArch / Lakka** | Reference libretro frontend / OS image | Shaders, run-ahead latency reduction, netplay, RetroAchievements, per-core overrides |
| **RetroPie** | Pi distro | EmulationStation UX, per-system config, Skyscraper scraping |
| **RetroDECK** | Steam Deck flatpak | ES-DE frontend, per-emulator presets, cloud sync |
| **Batocera** | Read-only OS image | Netplay, bezels/decorations, gamepad autoconfig, Kodi |
| **BizHawk** | Accuracy / TAS | Frame advance, Lua scripting, RAM watch/search, movie recording |
| **RomM** | **Self-hosted ROM library — closest direct competitor** | Web UI, EmulatorJS play, ES-DE / Pegasus export, platform folders |
| **Recalbox** | OS image | Similar to Batocera; strong first-run UX |
| **RetroBat** | Windows bundle | ES + RetroArch packaging for Windows |
| **EmuDeck** | Deck installer | Auto-configures emulators, Steam ROM Manager integration |

### Already covered — do not re-adopt

* **ES-DE and Pegasus export** — `GET /api/export/esde` · `GET /api/export/pegasus`
  already ship. RomM's headline interop feature is done.
* **Per-core BIOS validation** with blocking-vs-optional honesty — finer-grained
  than the flat "BIOS missing" these frontends surface.
* **In-browser play** — none of the nine plays in a browser tab; they are native
  frontends or bootable images. This stays our differentiator.

### Genuine gaps, ranked

1. **Shaders / CRT filters + run-ahead** — the vendored WebRetro RetroArch
   already supports both through config keys, and we already author that block
   (`extraConfig` in `static/vendor/webretro/assets/base.js`, where the audio
   fix landed). Exposing a CRT preset and a run-ahead frame count is wiring,
   not a subsystem, and it pairs with play rooms + theming. **Best value.**
2. **RetroAchievements** — zero references in our codebase; supported by all
   nine. The most visible thing we lack against them. Needs account linking and
   a hardcore-mode stance, so a real slice rather than a quick win.
3. **Netplay** — RetroArch supports it and we already have voice; the missing
   piece is a shared session. NAT traversal makes this the expensive one.
4. **Steam ROM Manager–style export** (EmuDeck) — small, Deck/desktop only.

### Declined

* **BizHawk's TAS surface** — frame advance, Lua scripting, RAM watch/search,
  movie recording. Accuracy-research tooling, not a household library feature.
* **Shipping OS images** (Lakka, Batocera, Recalbox, RetroBat) — GameTheca is a
  server, not a boot medium.

---

## Decisions backfilled 2026-08-06

An audit of this document against its own sections found two entries with **no
adopt/decline call**:

* **ROMarr** — never decided, despite being one of the first three repos
  supplied. Reviewed now:
  * **Remote path mapping — ADOPT (defect).** We take qBittorrent's
    `content_path` verbatim and stat it locally, so a split-container deploy
    (the normal Unraid case) makes the hardlink pipeline silently import
    nothing. See [code-review-2026-08-06.md](code-review-2026-08-06.md) §2.3.
  * **Release scoring with reasons shown — PARTIAL.** We score matches and
    expose `why_unmatched`; we do not show *why a score was what it was*.
    Worth folding into the proposal UI later.
  * **Per-platform routing to different backends — DEFER.** Real, but only
    matters with several download backends configured.
  * **ROM Hub plugin sources — DECLINE for now.** Overlaps our operator-supplied
    firmware/cores stance; revisit only if a registry appears that does not
    require us to host or endorse the content.
* **vglist** — Wikidata is already ranked gap #7; naming it here so it no longer
  reads as unreviewed. **ADOPT with the cascade** (no API key, openly licensed —
  a good fit for the multi-source cascade shipped 2026-08-05).

**Total reviewed across all three batches: 23 products.**
