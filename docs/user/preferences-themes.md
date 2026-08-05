# Preferences & themes

> 🎬 Watch: [themes, icons & fonts](../media/video/howto/howto-preferences.webm) — [all how-to videos](../media/video/howto/README.md)

## Open preferences

From the member SPA **Account** drawer (under TopNav) → **Preferences**, or Ctrl/Cmd+K → Preferences. The modal uses sectioned aurora chrome (`gt-prefs-modal`: Library · Look & density · Game language) — dense sections, **no heavy cards**. Changes save to your user profile and usually reload the page.

## Color theme presets

- Pick a preset from the **swatch grid** (modal Preferences and full `/settings_panel`) — the underlying `<select>` is visually hidden (still keyboard/screen-reader reachable) for a slimmer picker.
- **Default (system)** is the built-in theme id `default` (saved explicitly — not `None`).
- Default brand accent is green **`#2fd67b`** (Style B+C glass); other presets (Aurora, Ember, Violet, Forest, Ocean, Rose, Mono, Sunset, Ice — **9** packs) recolour accent, surfaces, glass/CRT, typography, and paired icon geometry (`GENERATOR_VERSION` 10).
- Picking a colour swatch also selects that preset’s paired icon pack (still changeable before Save).
- If swatches do nothing, accents look wrong, or presets still look accent-only (pre–Wave 2d), the library volume may have stale theme files — ask an admin to **Reset Default Themes** after a rebuild.

## Icon packs (independent of color)

- Preferences → **Icon pack**: Outline, Filled, Duotone, Pixel, Soft, Mono block.
- Packs only change glyph weight/style; they use `currentColor`, so they work with **any** color theme (e.g. Aurora + Pixel).
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

> **If a font seems to do nothing:** the picker lists faces, but the font *files*
> are supplied by whoever runs your server — GameTheca cannot legally bundle
> console manufacturers' typefaces, and does not vendor the open-licence ones
> either. A face whose file is not installed falls back to a standard system
> font. Ask your admin to install it — [theme-fonts-and-images.md](../admin/theme-fonts-and-images.md).

## Tile size

- Preference: continuous **0–100% slider** (TopNav) — legacy S/M/L/XL values still load and map onto the scale.
- Affects Library / Favorites / similar grids; denser gaps on smaller sizes; grid re-measures with a short debounce so dragging feels smooth instead of snapping between sizes.

## Items per page

- Preference: **items per page** for Library / similar browse grids.
- Allowed values: **20 / 50 / 100 / 200 / 250 / 300 / 400 / 500 / 1000** (API allowlist; other values are rejected).

## Preferred game language

- Preference: **Preferred game language** (BCP-47, default `en-US`).
- Separate from UI locale (`en` / `es`). Used for ROM language chips and translation-patch prompts on game details.
- Details: [translation-patches.md](translation-patches.md).

## Tips

- Hard-refresh (Ctrl+F5) after a theme or icon-pack apply if CSS was just redeployed.
- Admin theme install is separate from your personal preset — see [themes-reset.md](../admin/themes-reset.md).
- If account/prefs chrome looks stale after deploy (`gt-account.css` / `modal-components` on the library volume), ask an admin for **Reset Default Themes**.
- Icon packs install on app boot; they are not wiped by Reset Default Themes.
- **Loading icons (admin):** household spinner mode — rotate catalogue or lock to one id (Admin → Themes → Loading icons). Members/SPA read `GET /api/loading-icon`. Motifs appear on Auto Scan browse + `PageStatus` loads. Details: [icon-themes.md](../strategy/icon-themes.md).
- Social / voice / Report issue: [social-and-voice.md](social-and-voice.md) · [faq.md](faq.md).
