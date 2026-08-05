# Emulator BIOS / firmware (operator-supplied)

**Audience:** Operator · **Stance:** LOCKED

## What GameTheca does and does not do

GameTheca **never downloads, bundles, or ships console BIOS**. Those files are
proprietary console firmware — Sony, Sega, Nintendo, Panasonic, SNK and friends
still own them. The application only ever:

1. **describes** what each libretro core asks for (`BIOS_REQUIREMENTS`), and
2. **reports** which of those files are present on your firmware volume.

Filling the gaps is the operator's job, from a source you are entitled to use —
a dump of hardware you own, or a firmware set you already hold. The public image
stays upload-only, and `.gitignore` blocks `bios/`, `**/bios/*.bin`,
`**/bios/*.rom` and `gametheca/static/library/bios/` so firmware cannot reach the
public repository even by accident.

## Where files go

| Deployment | Location |
|---|---|
| Docker / Unraid | the volume mounted at `EMULATOR_BIOS_PATH` |
| Bare metal (default) | `gametheca/static/library/bios/` |

Drop files in flat — no per-system subfolders. Names are matched
case-insensitively, so `SCPH5501.BIN` and `scph5501.bin` both count.

## Checking coverage

**Admin → Emulation → Firmware** lists every system that needs firmware and what
is missing, e.g. *"PC Engine CD — missing `syscard3.pce`"*. The same data is on
`GET /api/emulator-bios`:

- `platforms[]` — per-system view: `required`, `present`, `missing`, `ready`,
  `blocking`
- `cores[]` — the older per-core view, kept for existing callers
- `files[]` — what is actually on the volume

`blocking: true` means that system genuinely cannot boot without the file.
Optional accuracy files (for example `gba_bios.bin`, which mGBA replaces with its
HLE fallback) are reported as missing but never marked blocking, so the panel
does not cry wolf.

## Systems that need firmware

Cores read these names; region variants are interchangeable — **any one** present
is usually enough.

| System | Files |
|---|---|
| PlayStation | `scph5500.bin` · `scph5501.bin` · `scph5502.bin` |
| PlayStation 2 | `scph39001.bin` · `scph70012.bin` |
| Saturn | `saturn_bios.bin` |
| Sega CD | `bios_CD_U.bin` · `bios_CD_E.bin` · `bios_CD_J.bin` |
| Dreamcast | `dc_boot.bin` · `dc_flash.bin` |
| 3DO | `panafz1.bin` · `panafz10.bin` |
| Neo Geo CD | `neocd_f.rom` · `neocd_sf.rom` · `neocd_st.rom` · `neocd_z.rom` · `front-sp1.bin` |
| PC Engine CD / SuperGrafx | `syscard3.pce` |
| Commodore Amiga | `kick34005.A500` · `kick40068.A1200` · `kick33180.A500` |
| Nintendo DS | `bios7.bin` · `bios9.bin` · `firmware.bin` |
| Game Boy Advance *(optional)* | `gba_bios.bin` |
| Atari Lynx | `lynxboot.img` |
| Atari 7800 *(optional)* | `7800 BIOS (U).rom` |
| ColecoVision | `colecovision.rom` |
| Intellivision | `exec.bin` · `grom.bin` |
| Magnavox Odyssey 2 | `o2rom.bin` |
| Amstrad GX4000 | `cpc6128.rom` |

Neo Geo AES cart sets expect `neogeo.zip` alongside the ROMs rather than on the
firmware volume — it is a MAME/FBNeo parent set, not a BIOS file.

## Upload guardrails

Uploads are treated as untrusted: extension allowlist, and a size cap
(`EMULATOR_BIOS_MAX_BYTES`, default 64 MB) so a stray disk image cannot fill the
volume.
