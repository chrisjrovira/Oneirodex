# ROM reference sets (No-Intro / Redump DAT)

Oneirodex can report **set completeness** per library platform + region after you upload a DAT you obtained yourself. The app does **not** ship or download copyrighted DAT files.

Related: [library-and-systems.md](../user/library-and-systems.md)

## What it measures

For a given `LibraryPlatform` (e.g. `NES`) and region (`USA`, `EUR`, `JPN`, `BRA`, `KOR`, `AUS`, `GBR`, `FRA`, `DEU`, `ESP`, `CHN`, `WORLD`, `OTHER`):

```
owned / total · percent
```

**Match v1** compares normalized titles (and ROM path basenames) to DAT entry names. Region tags like `(USA)`, dump tags like `[!]`, and simple revisions are stripped before matching. **Match v2** also compares CRC/MD5/SHA1 when library files have been hashed (scan or admin rehash).

## Obtain a DAT

1. Get a No-Intro (cartridge) or Redump (optical) `.dat` from the project’s official channels.
2. Prefer the regional DAT that matches the set you care about (e.g. USA NES).
3. Do not redistribute DAT files via Oneirodex images or git.

## Upload

Admin → Integrations → **ROM reference sets (DAT)** (`/admin/reference_sets`), or Settings hub card.

| Field | Notes |
|---|---|
| Library platform | Same enum as Systems (`NES`, `SNES`, …) |
| Region | `USA` `EUR` `JPN` `BRA` `KOR` `AUS` `GBR` `FRA` `DEU` `ESP` `CHN` `WORLD` `OTHER`. `PAL` still stores as `EUR`. France/Germany/Spain/UK are for a regional DAT you upload — they are not IGDB `release_dates.region` values. |
| Source | `nointro` / `redump` / `other` |
| File | XML `datafile` or ClrMamePro text `.dat` |

Uploading the same platform+region **replaces** the previous set.

**Systems hub heatmap:** with `include_completion=1`, `/api/library_platforms` returns preferred `set_completion` plus `set_completion_regions` (all uploaded regions). The Systems page shows color chips per region when more than one DAT is present.

API (admin):

```bash
curl -X POST -b cookies.txt \
  -F "library_platform=NES" -F "region=USA" -F "source=nointro" \
  -F "file=@Nintendo - Nintendo Entertainment System (USA).dat" \
  "$BASE/api/reference-sets"
```

## Member UX

- **Systems** tiles show `owned / total · percent (REGION)` when a set exists.
- **Missing** opens `/systems/completion?library_platform=NES&region=USA` with a wishlist button per missing title.
- **Catalog** opens `/systems/catalog?library_platform=NES` — IGDB regional title counts from a cache an admin refreshes (one platform per click) on this same page. Empty cache is not “zero games ever made.” Native PC libraries are refused. Identify also fills cache rows when IGDB returns `release_dates`.

```bash
curl -sS -b cookies.txt \
  "$BASE/api/set-completion?library_platform=NES&region=USA" | jq '.owned, .total, .missing_count'

curl -sS -b cookies.txt \
  "$BASE/api/licensed-catalog?library_platform=NES" | jq '.unique_titles, .empty, .by_region[:3]'
```

## Honesty limits

- Title match can false-positive (shared names) or miss (IGDB-renamed library titles vs No-Intro names).
- **Hash match** (CRC/MD5/SHA1) wins when both the DAT entry and the library file have hashes. New scans hash single-file ROM paths automatically; use **Rehash platform** on the admin page (or `POST /api/reference-sets/rehash`) for existing libraries.
- **First-scan identify:** a **unique** hash hit against uploaded DATs for the library platform can auto-create a custom Game after IGDB miss (before TheGamesDB propose). Ambiguous hashes and title-only DAT names never auto-import.
- Hashes prefer the on-disk file (or the single ROM-like file inside a folder). For **zip/7z/rar**, when the outer archive digest misses DAT, Oneirodex may open the archive and hash **inner** primary dump candidate(s) (`DAT_HASH_INNER_ARCHIVE`, default ON; set `0` to disable). Exactly one unique DAT title identifies; zero or multiple distinct titles → skip (no invent). Multi-disc / cue+bin / overcrowded set archives stay skip-safe.
- Home-brew / unlicensed / proto entries may appear in some DATs — filter upstream if you want “retail only.”
- PC Windows / store libraries are a poor fit; this feature targets ROM console libraries.
- **Licensed catalog** is a separate IGDB cache (main games, `category = 0`). It does not paste Wikipedia totals into the product. Refresh is offered for every `LibraryPlatform` with a confirmed IGDB `platforms.id` except native PC. CreatiVision, Adventure Vision, Studio II, Action Max, Daphne, and Pinball have no confirmed id — they stay off that dropdown. Identify filters the same map (Game Boy Color is IGDB 22). Pico is IGDB **339**.

## Follow-ups

- Multi-region heatmap on Systems.
- Full Ops upload matrix prose (per-leaf DAT sets) — Docs/Ops after live Unraid upload.

## Related: legal sample ROMs (not DAT)

For emulator smoke tests with **freely licensed** homebrew/test ROMs (never commercial dumps), see [samples/free-roms/](../../samples/free-roms/README.md) and `python scripts/fetch-free-roms.py`.
