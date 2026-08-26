# Capability inspiration (public)

**Date:** 2026-08-26  
**Status:** living backlog — INSP-* still open; browser **picture / rewind / FF / save-load chrome** shipped 2026-08-26 (not an INSP ticket)  
**Companion:** named peer catalog stays in `docs/_private/` (gitignored) — see [competitive.md](competitive.md) · [external-facing-scrub.md](external-facing-scrub.md)  
**Re-score sheet:** [competitor-rescore.md](competitor-rescore.md)

GameTheca-language opportunities pulled from a 2026-08-26 landscape pass (≥50 net-new services beyond integrations already named in-tree). This file does **not** rank us against other products. It records capabilities we should add, deepen, or explicitly leave unscheduled.

Locks unchanged: no Discord product surface · no DRM store download queues · no bundled torrent marketplace · Unraid/household first.

---

## Already covered — do not rebuild

| Capability | Where it lives |
|---|---|
| ES-DE / Pegasus export packs | `/api/export/esde` · `/api/export/pegasus` |
| Multi-source identify cascade | IGDB + Steam/GOG/Epic/itch/Giant Bomb/MobyGames/RAWG/TheGamesDB + HLTB |
| Browser play with honesty badges | WebRetro + `play_mode` / `play_blocker` |
| Cabinet rewind / FF / save-load / picture modes | Play bar + `gt-bridge.js` — CRT·Sharp·Soft; no shader packs |
| Desktop companion install/launch | `clients/desktop` |
| Torznab/Newznab registry + optional hubs | Arr settings · Prowlarr/Jackett |
| Moonlight-family remote play CTA | [gow-remote-play.md](gow-remote-play.md) |
| Hyperion + Home Assistant lighting | [ambient-lighting.md](ambient-lighting.md) |
| Native household chat + optional LiveKit | [social-av.md](social-av.md) |
| Playtime **sessions** (start/heartbeat/stop) | `PlaySession` — table exists; habit *view* does not |
| Ownership register (Steam/GOG/Epic live) | [store-metadata-identify.md](store-metadata-identify.md) |
| Inner-archive DAT unique-hash | BE-DET-6 |
| Region/language peel on ROMs | BE-DET-4 `rom_region` / `rom_languages` |
| IPS/BPS patch apply on companion | Flips |

---

## Still open from earlier reviews (not started)

These were already the ranked public opportunities in [gap-review-2026-08-05.md](archive/gap-review-2026-08-05.md) and [code-review-2026-08-06.md](archive/code-review-2026-08-06.md). The 2026-08-26 pass **reconfirmed** them; they are now ticketed as INSP-* so they cannot fall off the board.

| Old | Ticket | Notes |
|---|---|---|
| Nested AND/OR + saved filters | **INSP-3** | Also feeds Discover shelves |
| Session heatmap | **INSP-19** | `PlaySession` exists |
| Persistent “not interested” | **INSP-4** | Negative recommender signal |
| Taste picker / randomiser | **INSP-4b** | Cheap on `curated_for_you` |
| Copy-level physical detail | **INSP-18** | CIB / condition / cost |
| Wikidata source | **INSP-7b** | No API key |
| Public list RSS | **INSP-26** | Auth story required |
| Deal / subscription detection | **INSP-8** | Against ownership register |
| Achievements | **INSP-2** | Still the largest visible play gap |
| Disk-level Library Health | **INSP-23** | Hashes already computed |
| Fifth completion state | **INSP-21** | “Won't play” |
| Mod profile depth | **INSP-22** | Beyond URL paste |
| CRT shaders / run-ahead | **picture modes shipped 2026-08-26** | CRT · Sharp · Soft on the play bar (CSS + `video_smooth`). `.slangp` packs and run-ahead stay unscheduled — WASM cannot afford run-ahead; we do not vendor shader files |

---

## INSP tickets (ranked)

Priority is household value × fit to locks × cost. None of these is a 1.0 gate unless PM promotes it onto [progress.md](progress.md).

### P1 — take next

| ID | Capability | Why now | Likely seats |
|---|---|---|---|
| **INSP-1** | **Server save / state sync** with per-device isolation, conflict resolution, and companion + handheld clients | Highest-leverage gap vs every serious retro library. PC path can wrap an existing save-manifest tool instead of inventing path maps. | backend · desktop · android |
| **INSP-2** | **Achievement overlay** (community sets, hash-locked) with softcore vs hardcore honesty (hardcore disables saves/cheats) | Called out 2026-08-06 as the largest visible play gap; still zero code. | backend · play · ui |
| **INSP-3** | **Nested AND/OR filter builder + named saved filters** that Discover shelves can reuse | Flat chips only; one build lands library + storefront. Cookie-saved filters on classic library are not this. | ui · backend |
| **INSP-4** | Persistent **not interested / blocklist** on Discover + wishlist | Bad recommendations return forever. | ui · backend |
| **INSP-4b** | **Taste picker / surprise me** on top of `curated_for_you` | Small once INSP-4 exists. | ui |
| **INSP-5** | **Preferred dump / 1G1R** using existing `rom_region` / `rom_languages` | We peel region; we do not collapse clones to one preferred file. | backend · gm |
| **INSP-6** | **Household notification bus** — Apprise and/or ntfy/Gotify beside SMTP | Scan done, request filled, malware hit, server down. No Discord product webhook. | backend · ops |
| **INSP-7** | **Community ROM metadata** (hash + region art + manuals) as an opt-in Class D source | Arcade/obscure titles where IGDB is thin. Operator account. | backend |
| **INSP-7b** | **Wikidata** as no-key Stage-E fallback | Already recommended 2026-08-05. | backend |

### P2 — high value, slightly larger

| ID | Capability | Why | Seats |
|---|---|---|---|
| **INSP-8** | **Ownership-aware giveaways + historical-low prices** on Discover/News | Free-games feed today does not skip titles the household already owns; no price radar. Read-only deal APIs. Never checkout. | backend · ui |
| **INSP-9** | **Steam shortcuts export** (artwork + launch target) next to ES-DE/Pegasus | Third living-room frontend. Controller templates optional. | backend · desktop |
| **INSP-10** | **Virtual-display remote-play host** as a third BYO URL (beside Sunshine / Wolf) | Per-client resolution/HDR without a dummy plug. Settings row + Moonlight CTA unchanged. | ops · ui |
| **INSP-11** | **Linux/Deck compatibility chip** on PC tiles | Companion Linux seats; read-only community tier. | backend · ui |
| **INSP-12** | **Short-code / QR device pairing** for API tokens | Android/handheld onboarding without pasting a 44-char token. | backend · android |
| **INSP-13** | **Per-client emulator profiles** stored on the server | Restore RetroArch/core options after a reinstall; share a household default. | backend · desktop |
| **INSP-14** | **Runtime redistributable packs** (VC++ / .NET / DirectX) on companion install | DRM-free PC titles that currently launch then crash. | desktop |
| **INSP-15** | **OpenRGB + WLED** lighting providers | Many Unraid homes have strips without Hyperion. | backend · ops |
| **INSP-16** | **Game-server panel API** as SRV-3 (health + start/stop) | Smarter than a raw Docker socket. Operator BYO panel. | ops · backend |
| **INSP-17** | **Age-rating ingest** (BBFC/ELSPA-class tables) into child ACL | We have roles; we do not ingest content ratings. | backend · security |
| **INSP-18** | **Physical copy fields** — condition, CIB, paid price, notes | Collector households; does not block digital browse. | backend · ui |
| **INSP-19** | **Play heatmap + session notes** | `PlaySession` rows exist; Statistics has totals, not a habit calendar. | ui · backend |

### P3 — polish / post-1.0

| ID | Capability | Notes |
|---|---|---|
| **INSP-20** | Extra **patch formats** (UPS, xDelta, PPF) + in-browser apply for WebRetro | Companion Flips stays IPS/BPS. |
| **INSP-21** | Fifth play status **Won't play** | Doubles as INSP-4 signal if we want one enum. |
| **INSP-22** | **Catalogue-backed mods** (open mod APIs) | [game-servers-mods.md](game-servers-mods.md) already marks this unscheduled, not refused. |
| **INSP-23** | Disk-level **Library Health** (byte-identical ROMs, loose files, missing paths) | `rom_hash.py` already produces crc32/md5/sha1. |
| **INSP-24** | **DAT repair dry-run** in Library Doctor | Preview-only; apply stays flagged like hardlinks. |
| **INSP-25** | **Gamepad→keyboard profiles** attach on companion launch | For keyboard-only DRM-free titles. |
| **INSP-26** | **Public list pages + RSS/JSON** | Needs a deliberate auth story (token or household-signed feed). |
| **INSP-27** | Handheld **CFW sync client** (muOS / KNULLI / NextUI class) | Follows INSP-1 + INSP-12. |
| **INSP-28** | Wire or delete leftover **Flash in-browser** module | Gap A4 — `ruffle_play` unverified. |
| **INSP-29** | **Smart collections** auto-built from a saved filter | Falls out of INSP-3. |
| **INSP-30** | Optional **Open in external launcher** deep links | Register-only stores stay register-only; deep link is not a download queue. |

---

## Suggested sequence

```
INSP-3 + INSP-4     filters + not-interested (storefront actually learns)
INSP-6              notifications (ops + members feel the house)
INSP-1              save sync (the multi-device story)
INSP-2              achievements (visible play gap)
INSP-5 + INSP-7     dump preference + retro metadata
INSP-8 + INSP-11    Discover honesty (deals, Deck/Linux)
INSP-12 + INSP-27   device pairing → handheld
INSP-10 + INSP-15   remote-play host + extra lights
INSP-19             heatmap (cheap once people play)
```

Human picks which epic to sprint. PM does not treat this file as a 1.0 gate list.

---

## Out of this inspiration set

Unscheduled, not refused — same policy as [scope.md](scope.md):

- First-party acquire marketplace
- DRM store install pipelines
- A second chat stack
- Whole-OS retro distros as something we ship
- Public social-network clone
