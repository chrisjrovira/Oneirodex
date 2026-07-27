# Preferences & themes

## Open preferences

From the member SPA account / preferences control (preferences modal). Changes save to your user profile and usually reload the page.

## Color theme presets

- Pick a preset from the **swatch grid** (not name-only).
- **Default (system)** is the built-in theme id `default` (saved explicitly — not `None`).
- Default brand accent is green **`#2fd67b`** (Style B+C glass); other presets (Ocean, Forest, …) recolour accent and surfaces.
- If swatches do nothing or accents look wrong (old teal/orange), the library volume may have stale theme files — ask an admin to **Reset Default Themes** after a rebuild (`GENERATOR_VERSION` 6).

## Icon packs (independent of color)

- Preferences → **Icon pack**: Outline, Filled, Duotone, Pixel, Soft, Mono block.
- Packs only change glyph weight/style; they use `currentColor`, so they work with **any** color theme (e.g. Aurora + Pixel).
- Details: [icon-themes.md](../strategy/icon-themes.md).

## Tile size

- Preference: **tile size** S / M / L / XL.
- Affects Library / Favorites / similar grids; denser gaps on smaller sizes.

## Preferred game language

- Preference: **Preferred game language** (BCP-47, default `en-US`).
- Separate from UI locale (`en` / `es`). Used for ROM language chips and translation-patch prompts on game details.
- Details: [translation-patches.md](translation-patches.md).

## Tips

- Hard-refresh (Ctrl+F5) after a theme or icon-pack apply if CSS was just redeployed.
- Admin theme install is separate from your personal preset — see [themes-reset.md](../admin/themes-reset.md).
- Icon packs install on app boot; they are not wiped by Reset Default Themes.
- Social / voice / Report issue: [social-and-voice.md](social-and-voice.md) · [faq.md](faq.md).
