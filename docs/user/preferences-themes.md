# Preferences & themes

> 🎬 Watch: [themes, icons & fonts](../media/video/howto/howto-preferences.webm) — [all how-to videos](../media/video/howto/README.md)

## Open preferences

From the member SPA **Account** drawer (under TopNav) → **Preferences**, or Ctrl/Cmd+K → Preferences. The modal uses sectioned aurora chrome (`gt-prefs-modal`: Library · Look & density · Game language) — dense sections, **no heavy cards**. Changes save to your user profile and usually reload the page.

Preferences is three folding sections — **Library**, **Look & density** and **Game
language**. Fold the ones you are not using and it stays folded next time; the panel
opens fully expanded until you change that.

## Color theme presets

- Pick a preset from the **room-card picker** in Preferences — grouped into **Decade rooms** (the place you started: 1980s wood den, 1990s teen bedroom, late-90s carpet den, 2000s media centre, arcade floor, computer desk), **Colour cabinets** (Arcade Neon, Hot Cabinet, … plus Default), and **Installed** (uploads). The underlying `<select>` is visually hidden. Preferences is the only theme picker; if you are an admin, the Themes admin page handles installing and resetting themes, not choosing one.
- A theme is a **room**, not a solid colour. Member and admin chrome share wallpaper, window, posters, floor and lamp with the browser-play rooms (`html[data-era]`). Colour cabinets still sit in an era room rather than a flat slab.
- **Default (system)** is the built-in theme id `default` (saved explicitly — not `None`). It uses the 1980s wood-den scenery with the green glass accent.
- Default brand accent is green **`#2fd67b`** (Style B+C glass). Colour cabinets (Aurora, Ember, Violet, Forest, Ocean, Rose, Mono, Sunset, Ice) plus six decade rooms recolour accent, surfaces, glass/CRT, typography, spacing, radius, paired icon geometry, **and** the era room (`GENERATOR_VERSION` 17). Ask an admin to **Reset Default Themes** after that bump or presets stay on the previous generator and miss `gt-era.css`.
- Picking a room card also selects that preset’s paired icon pack (still changeable before Save). The live preview repaints the accent **and** switches the room scenery before you save.
- The chosen theme applies on the **next page load** — every stylesheet, the brand mark, the tile chrome, the **stock avatars**, and **backup/placeholder covers** follow it. Untitled games get a Pillow placeholder painted in the active decade room (cached per theme). The seven avatars Oneirodex ships are recoloured into each preset's palette. An avatar you uploaded yourself is your picture and is never recoloured.
- If cards do nothing, accents look wrong, rooms stay flat, or presets still look accent-only, the library volume may have stale theme files — ask an admin to **Reset Default Themes** after a rebuild.

> **Fixed:** themes used to appear not to save at all — the page came back with
> the previous theme's colours however many times you picked a new one. The
> preference was saving correctly; the stylesheet links were being cached per
> server process, so a restart was the only thing that ever changed them. See
> [troubleshooting](troubleshooting.md#a-new-theme-doesnt-appear-after-reload).

## Icon packs (independent of color)

- Preferences → **Icon pack**: Outline, Filled, Duotone, Pixel, Soft, Mono block.
- Outline is the default stroke set. The other five packs draw their own SVGs for every CORE glyph (primary rail, settings, More-menu set, plus user / menu / more / play). Preferences chips still preview the five primary-rail glyphs.
- Packs use `currentColor`, so they work with **any** color theme (e.g. Aurora + Pixel).
- A preset can also set the icon *silhouette* — stroke weight, corner style, and whether glyphs are outlined or solid. A glyph drawn as a solid shape (the Favorites heart, the play triangle) stays visible under the outline presets rather than being erased by them.
- Details: [icon-themes.md](../strategy/icon-themes.md).

## Fonts

- Preferences → **Font** picks the typeface used across the UI, independently of
  your color theme and icon pack.
- Faces are chosen to evoke an era rather than imitate a brand: an 8-bit pixel
  face, a compact handheld face, an arcade face, a 32-bit/disc face, and a CRT
  terminal face — plus **System UI**, the default, which uses your own device's
  fonts.
- Emulator and library surfaces can pick an era-appropriate face per system
  automatically (a Game Boy title gets the compact pixel face, a PS1 title the
  disc-era one).

- **Every listed face ships with Oneirodex.** The open-licence (OFL 1.1) faces
  are bundled in the release and copied into place on every server start — no
  download, no admin step, and nothing to do on an air-gapped install. If the
  picker ever shows *not installed*, that is a genuine file problem on the
  server, not the normal state.

> **What is *not* bundled:** console manufacturers' own typefaces. Those are
> trademarked and not licensed for redistribution. The bundled faces evoke each
> era rather than imitating a brand. An admin can still drop a licensed font in
> and have it offered alongside — [theme-fonts-and-images.md](../admin/theme-fonts-and-images.md).

## Tile size

- Preference: continuous **0–100% slider** (TopNav) — legacy S/M/L/XL values still load and map onto the scale.
- Affects Library / Favorites / similar grids; denser gaps on smaller sizes; grid re-measures with a short debounce so dragging feels smooth instead of snapping between sizes.
- **Everything on a tile scales with it** — the corner controls (menu, favourite, play status), the badges, the platform chip and the Preview pill all derive their size from the tile, so a 120% tile and a 30% tile read the same way rather than one being all chrome.
- Hovering a tile lifts it **15%** at every tile size. The lift is a transform, so the grid does not reflow around it.

## Items per page

- Preference: **items per page** for Library / similar browse grids.
- Allowed values: **20 / 50 / 100 / 200 / 250 / 300 / 400 / 500 / 1000** (API allowlist; other values are rejected).

## Preferred game language

- Preference: **Preferred game language** (BCP-47, default `en-US`).
- Separate from UI locale (`en` / `es`). Used for ROM language chips and translation-patch prompts on game details.
- Details: [translation-patches.md](translation-patches.md).

## Tips

- A theme or icon-pack change takes effect on a normal reload. Hard-refreshing used to be necessary and no longer is — if it makes a difference for you, that is worth reporting rather than repeating.
- Admin theme install is separate from your personal preset — see [themes-reset.md](../admin/themes-reset.md).
- If account/prefs chrome looks stale after deploy (`gt-account.css` / `modal-components` on the library volume), ask an admin for **Reset Default Themes**.
- Icon packs install on app boot; they are not wiped by Reset Default Themes.
- **Loading icons (admin):** household spinner mode — rotate catalogue or lock to one id (Admin → Themes → Loading icons). Members/SPA read `GET /api/loading-icon`. Motifs appear on Auto Scan browse + `PageStatus` loads. Details: [icon-themes.md](../strategy/icon-themes.md).
- Social / voice / Report issue: [social-and-voice.md](social-and-voice.md) · [faq.md](faq.md).
