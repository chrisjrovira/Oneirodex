# ROM reference sets (No-Intro / Redump DAT)

GameTheca can report **set completeness** per library platform + region after you upload a DAT you obtained yourself. The app does **not** ship or download copyrighted DAT files.

Related: [library-and-systems.md](../user/library-and-systems.md)

## What it measures

For a given `LibraryPlatform` (e.g. `NES`) and region (`USA`, `EUR`, `JPN`, `WORLD`, `OTHER`):

```
owned / total · percent
```

**Match v1** compares normalized titles (and ROM path basenames) to DAT entry names. Region tags like `(USA)`, dump tags like `[!]`, and simple revisions are stripped before matching. **Match v2** also compares CRC/MD5/SHA1 when library files have been hashed (scan or admin rehash).

## Obtain a DAT

1. Get a No-Intro (cartridge) or Redump (optical) `.dat` from the project’s official channels.
2. Prefer the regional DAT that matches the set you care about (e.g. USA NES).
3. Do not redistribute DAT files via GameTheca images or git.

## Upload

Admin → Integrations → **ROM reference sets (DAT)** (`/admin/reference_sets`), or Settings hub card.

| Field | Notes |
|---|---|
| Library platform | Same enum as Systems (`NES`, `SNES`, …) |
| Region | `USA` / `EUR` / `JPN` / `WORLD` / `OTHER` |
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

```bash
curl -sS -b cookies.txt \
  "$BASE/api/set-completion?library_platform=NES&region=USA" | jq '.owned, .total, .missing_count'
```

## Honesty limits

- Title match can false-positive (shared names) or miss (IGDB-renamed library titles vs No-Intro names).
- **Hash match** (CRC/MD5/SHA1) wins when both the DAT entry and the library file have hashes. New scans hash single-file ROM paths automatically; use **Rehash platform** on the admin page (or `POST /api/reference-sets/rehash`) for existing libraries.
- **First-scan identify:** a **unique** hash hit against uploaded DATs for the library platform can auto-create a custom Game after IGDB miss (before TheGamesDB propose). Ambiguous hashes and title-only DAT names never auto-import.
- Hashes are of the on-disk file (or the single ROM-like file inside a folder). Archives / multi-disc folders may not match No-Intro inner-ROM CRCs until you dump/extract first.
- Home-brew / unlicensed / proto entries may appear in some DATs — filter upstream if you want “retail only.”
- PC Windows / store libraries are a poor fit; this feature targets ROM console libraries.

## Follow-ups

- Multi-region heatmap on Systems.
- Hash inside `.zip` to match No-Intro dump CRCs more often.

## Related: legal sample ROMs (not DAT)

For emulator smoke tests with **freely licensed** homebrew/test ROMs (never commercial dumps), see [samples/free-roms/](../../samples/free-roms/README.md) and `python scripts/fetch-free-roms.py`.
