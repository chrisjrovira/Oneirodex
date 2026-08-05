# Theme fonts & bulk artwork upload

Two admin surfaces that let you bring your own assets: **fonts** for theming and
**batch image upload** for artwork you have already prepared.

Related: [Preferences & themes](../user/preferences-themes.md) (what members see)
· [themes-reset.md](themes-reset.md) (after a deploy) · [libraries-and-scans.md](libraries-and-scans.md).

---

## Fonts

### What ships, and what does not

GameTheca does **not** bundle console manufacturers' typefaces. The real
Nintendo, Sega and Sony faces are trademarked and not licensed for
redistribution, so shipping them would put an infringing asset in every install.

What the font picker offers instead is a registry of **OFL / public-domain**
faces chosen to *evoke* each era:

| Id | Face | Era | Licence |
|---|---|---|---|
| `system-ui` | System UI (default) | modern | uses the reader's own system fonts |
| `press-start` | Press Start 2P | 8-bit | SIL OFL 1.1 |
| `silkscreen` | Silkscreen | compact pixel | SIL OFL 1.1 |
| `vt323` | VT323 | CRT terminal | SIL OFL 1.1 |
| `share-tech-mono` | Share Tech Mono | arcade cabinet | SIL OFL 1.1 |
| `orbitron` | Orbitron | 32-bit / disc era | SIL OFL 1.1 |

> ⚠️ **The font *files* are not vendored in this repo.** The registry describes
> the faces; the `.ttf` files are operator-supplied, exactly like WebRetro cores
> and reference DATs. Until you install them, every entry except `system-ui`
> falls through to its CSS fallback (`Courier New`, `Arial Black`, …) — so the
> picker will appear to "do nothing".
>
> The API reports this honestly: each entry carries `installed: true|false`, and
> `@font-face` rules are only emitted for files that actually exist.

### Installing the built-in faces

All five are on [Google Fonts](https://fonts.google.com/) under the Open Font
License. Download each family, then drop the `.ttf` into the fonts folder using
**exactly** the filename the registry expects:

```
PressStart2P-Regular.ttf
Silkscreen-Regular.ttf
VT323-Regular.ttf
ShareTechMono-Regular.ttf
Orbitron-Bold.ttf
```

Default location is `gametheca/static/library/fonts/`. Under Compose that lives
inside the volume mounted at `LIBRARY_HOST_PATH`, so the files survive a rebuild.

Restart is not required — the catalogue is read from disk per request.

### Uploading a font from the admin UI

`POST /admin/api/theme/fonts` (admin only, multipart field `file`).

Uploads are treated as untrusted, because the result is a file served back to
every member's browser:

- **Extension allowlist** — `.ttf`, `.otf`, `.woff`, `.woff2`
- **Size cap** — `FONT_MAX_BYTES`, default 8MB
- **Magic-byte check** — the leading bytes must match a real font container
  (`\x00\x01\x00\x00`, `true`, `ttcf`, `OTTO`, `wOFF`, `wOF2`). An extension on
  its own is not evidence.

Anything you upload appears in the picker alongside the built-ins, labelled
`(operator)`. If you hold a licence for a face closer to what you want, this is
the supported way to use it — no code change needed.

`DELETE /admin/api/theme/fonts/<filename>` removes an uploaded font. Built-in
filenames are **refused**, so a delete cannot leave the registry pointing at a
file you can no longer restore.

### Per-system faces

Emulator and library surfaces can pick an era-appropriate face automatically.
The mapping is by **era, not brand** — this is period flavour, not an imitation
of a logo:

| Era | Face | Example systems |
|---|---|---|
| 8-bit | Press Start 2P | NES, SNES, Master System, PC Engine |
| Compact pixel | Silkscreen | Game Boy / Color / Advance, Game Gear |
| Arcade | Share Tech Mono | Arcade, Neo Geo, Mega Drive, 32X |
| 32-bit / disc | Orbitron | PS1, PS2, Saturn, Dreamcast, N64, GameCube, 3DO |
| CRT terminal | VT323 | MS-DOS, Amiga, C64 |

Systems with no opinion fall back to `system-ui`.

### Config

| Variable | Purpose |
|---|---|
| `FONT_PATH` | Where fonts live. Empty = `static/library/fonts` (what Compose wants — already a persisted volume) |
| `FONT_MAX_BYTES` | Upload cap in bytes; default `8388608` (8MB) |

### API

| Method | Route | Who |
|---|---|---|
| `GET` | `/api/theme/fonts` | any signed-in member — catalogue + `installed` flags |
| `POST` | `/admin/api/theme/fonts` | admin — upload |
| `DELETE` | `/admin/api/theme/fonts/<filename>` | admin — remove an uploaded face |

---

## Batch artwork upload

`POST /admin/api/images/batch_upload` (admin only, multipart field `files`,
repeatable) uploads a folder of prepared artwork in one pass.

### Matching files to games

Each file is matched by **filename**:

| Filename pattern | Result |
|---|---|
| `<game_uuid>.png` | applied with the form-wide kind (default `cover`) |
| `<game_uuid>_<kind>.png` | applied with that kind |

You can also set `game_uuid` on the form to send every file to one game — useful
for uploading several screenshots at once.

Valid kinds: `cover`, `screenshot`, `box`, `cart`, `disc`, `logo`, `hero`,
`fanart`. Everything except `screenshot` is **singular** — uploading a new one
replaces the existing row rather than stacking duplicates.

### Limits and failure behaviour

- **Types** — `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- **Size** — 10MB per file
- **Per-file outcomes** — one bad file does not sink the batch. The response
  reports `stored`, `failed`, and a per-file `errors` array with the reason
  (`Unsupported image type`, `Empty file`, `Larger than the 10MB limit`,
  `No game matched this filename`).

Nothing is committed unless at least one file stored successfully.

### Typical use

1. Export art named after each game's UUID (copy UUIDs from the library table).
2. Suffix by kind where you want something other than the default: `…_hero.png`,
   `…_logo.png`.
3. Upload the folder; read the per-file report for anything that missed.

---

## Generated cover art (optional)

If you would rather generate art than source it, `ENABLE_AI_ARTWORK` points
GameTheca at **your own** A1111-compatible endpoint — see
[settings-modules.md](settings-modules.md#generated-cover-art). It is off by
default and nothing leaves your network.
