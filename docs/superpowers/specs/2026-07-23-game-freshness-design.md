# Game Freshness (Local vs Store) — Design

**Date:** 2026-07-23  
**Status:** Approved (Approach 1) — implement now  
**Product:** GameTheca

## Decisions

| Topic | Choice |
|-------|--------|
| Local sensors | Folder name + NFO first, then filesystem (`version.txt`, exe ProductVersion when available) |
| Stores | Steam + GOG + Epic (best-effort) |
| UI | Details “Check updates” + library badges via optional bulk refresh |
| Status rules | Always show raw facts; badge Up to date / Behind / Unknown; allow labeled **heuristic Behind** |

## Architecture

1. **`GameFreshness` snapshot** (JSON + status columns on `Game`) persisted after each check.
2. **`utils/freshness/`** package: local sensors, store clients (Steam/GOG/Epic), compare, DLC diff.
3. **On-demand API** on game details; **admin bulk refresh** for badges.
4. **Library React badge** reads `freshness_status` from browse JSON.
5. **Docs** refreshed to GameTheca + this feature.

## Compatibility

- No store credentials required for v1 (public endpoints only).
- Missing App IDs / URLs → Unknown with facts that exist.
- Rate-limit via existing HTTP retry helper.
