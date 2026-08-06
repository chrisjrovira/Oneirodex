# Competitive scan — batch 4 (46 sources, 2026-08-06)

The human supplied 46 unique URLs (the raw list had duplicates: `repackarr`,
`topics/mod-manager`, and Sunshine twice via GitHub and app.lizardbyte.dev).

**21 were already reviewed** in earlier batches — PlayDate, gamelog, ZGameLib,
Inderjit01, Omnio, RetroVault, burakbehlull, Questarr, Floppy, ROMarr,
DrNefarius, MyGamesAnywhere, Playerr, repackarr, kagarr, Monarch, LunaBox,
Bakabase, gaseous-server, tonkatsu_box, leereilly/games, Sunshine.

**25 are new.** They broaden the field well beyond "game library manager" into
five clusters we had not deliberately compared against.

Running total across all four batches: **~69 products**.

---

## Cluster A — direct library managers (new detail)

### PlayDate Library Manager — *confirms and sharpens gap C1*

Fetched rather than assumed. Its filter system is
**"simple dropdowns or nested AND/OR groups with custom SQL"**, with **saved
filters** feeding **home-page shelves with configurable limits and sort orders**
— which is exactly the "one build, two features" argument already made for our
own saved filters. It also ships:

* **Pick 6** — two modes: random from unbeaten, or taste-profile picks weighted
  by tags, reviews, playtime, **staleness** and release date. Staleness is the
  interesting one; we do not use "how long since you touched this" as a signal.
* **Five completion states** — Never Played · Unfinished · Beaten · Completed ·
  **Won't Play**. We have four (`unplayed`, `unfinished`, `beaten`,
  `completed`). The missing one is **Won't Play / abandoned**, which is also the
  negative signal a recommender needs — it doubles as the "not interested"
  feature ranked as gap C3.
* Gamepad navigation on every page (we have Big Picture, not full nav).

**Adopt:** the fifth state, and staleness as a curation signal. Both are small
and both feed work already planned.

### gamearr — *library health*

"Radarr for games": Prowlarr → qBittorrent → organise, with IGDB metadata,
one-click **Steam/GOG OAuth import**, quality scoring that prefers GOG /
DRM-free, and **library health tools detecting duplicates and loose files**.

**Adopt: library health report.** See Cluster D.

### sharewarez — *our origin; checked for regressions*

Verified our fork did not lose anything: HowLongToBeat (238 refs), NFO indexing
(47), Attract Mode (98) are all still present, and the codebase is fully
scrubbed of the name (0 hits). Its Discord webhooks were removed **deliberately**
and stay removed.

---

## Cluster B — mod management (entirely new comparison)

r2modmanPlus (Thunderstore) · IronyModManager (Paradox, conflict resolution) ·
KKManager (Illusion titles) · arisen-studio (PS3 / X360) · GameBanana · ModDB ·
`topics/mod-manager`.

We have `game_mods_api` and `ENABLE_MOD_TRACKING`, but only *tracking*. What
these do that we do not:

| Capability | Who | Worth it? |
|---|---|---|
| **Profiles** — multiple named mod loadouts per game, switch between them | r2modman | **Yes.** The single most-copied idea in this cluster. |
| **Conflict detection / load-order resolution** | Irony | Later — needs per-game rule knowledge |
| **Install/uninstall from a catalogue** | all | **Careful.** Fine for open catalogues (Thunderstore, GameBanana API); *not* a download queue for anything else |
| **Console FTP push** (mods, saves, homebrew) | arisen-studio | Niche; PS3/360 RGH only |

**Recommend:** mod **profiles** on top of existing mod tracking. Decline
conflict resolution and console FTP for now.

---

## Cluster C — game servers & remote play

Pterodactyl · Pelican (its successor) · Moonlight · Sunshine.

We already have `game_servers` (15 refs) and `remote_play` settings plus
[gow-remote-play.md](gow-remote-play.md), so the *stance* exists. What the
panels do better is **lifecycle**: per-server resource limits, scheduled
tasks/restarts, backups, and a console/log stream. If household game servers
matter, that is the shape to copy — but it is a genuinely large surface and
Pterodactyl/Pelican exist precisely so you do not rebuild it.

**Recommend: integrate, don't rebuild.** A "link an existing Pelican/Pterodactyl
server" panel is far cheaper than becoming one, and matches our BYO-sidecar
pattern (LiveKit, ClamAV, TRAWL, A1111).

---

## Cluster D — file & disk hygiene (**best new idea in this batch**)

czkawka (duplicate/similar finder) · superfile · tinyfilemanager · xpipe ·
`topics/filemanager`.

Our duplicate detection is **match-level** — `utils/duplicate_check.py` answers
"is this same-IGDB hit a true duplicate folder?". There is **no disk-level**
notion of the same ROM stored twice under different names, or files sitting in
the library attached to nothing.

The important part: **we already have the machinery.** `utils/rom_hash.py`
computes crc32/md5/sha1 per ROM (and inner-archive digests) for DAT matching.
Finding byte-identical files across the library is a *query over data we already
produce*, not a new subsystem.

**Recommend — Library Health report:**

* byte-identical ROMs under different names, with reclaimable bytes
* files under the library root attached to no game ("loose files", gamearr)
* games whose `full_disk_path` no longer exists (we surface `path_missing`
  per-game; there is no roll-up)

This is cheap, uses existing hashing, and directly answers "why is my array
full". Full in-app file *management* (superfile/tinyfilemanager) is out of
scope — we have OpenPathModal and Library Doctor.

---

## Cluster E — analytics & niche

* **tracearr** — Tautulli-style monitoring for Plex/Jellyfin/Emby: session
  tracking, **activity heatmaps**, device health, bandwidth/transcode stats,
  geolocation, and **automation rules (stream limits, geo-restrictions)**.
  Reinforces gap C2 (session tracking + heatmap). The genuinely new idea is
  **rules that act** — e.g. cap concurrent downloads per member. Modest value
  for a household.
* **PCem** — cycle-accurate x86 emulation. Relevant only as *evidence for
  honesty*: PCem needs real BIOS ROMs and heavy CPU, which is exactly why our
  DOS/PC browser-play stance is "operator-vendored, not promised". No adoption.
* **renderpilot** — swaps DLSS/FSR/XeSS DLLs per game with SHA-256 rollback.
  Clever, but it patches game files and carries explicit **anti-cheat warnings**.
  **Decline** — incompatible with our "never write game binaries" rule (the same
  rule that made PC cheats notes-only).
* **metatana** — media (film/TV) metadata organiser. **Not applicable**; no game
  support. Its *MCP server* idea is the transferable part, if exposing the
  library to AI agents ever becomes a goal.
* **UntitledGameSystemManager**, **chark/game-management**, **dotVault-Manager**
  — could not review: dotVault returned **404**, the other two are early-stage.
  Recorded as unreviewed rather than guessed at.

---

## Net new recommendations, ranked

1. **Library Health report** (D) — reuses `rom_hash`; answers a real ops
   question; nothing else here is this cheap for this much value
2. **Fifth completion state "Won't Play"** (A) — one enum value that doubles as
   the "not interested" negative signal already ranked C3
3. **Mod profiles** (B) — the most-copied idea in mod management; we already
   track mods
4. **Staleness as a curation signal** (A) — feeds `build_curated_for_you`
5. **Link an existing Pelican/Pterodactyl server** (C) — integrate, never rebuild

**Declined:** renderpilot DLL swapping (writes game binaries), console FTP,
full file-manager UI, becoming a game-server panel, metatana (media-only).
