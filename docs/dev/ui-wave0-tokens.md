# UI Wave 0 — design tokens (Oneirodex)

These CSS variables are the shared foundation for web + future desktop client.
Tracked source: `oneirodex/setup/default_theme/css/od-tokens.css` (presets regenerated at **`GENERATOR_VERSION` 10**).

Import after theme base.css or use as a reference when migrating React islands / admin SPA.

```css
:root {
  --od-bg: #0b0d10;
  --od-surface: #141820;
  --od-surface-2: #1c2230;
  --od-text: #f2f4f8;
  --od-text-muted: #c4ccd8;
  --od-accent: #2fd67b;
  --od-accent-contrast: #0b0d10;
  --od-success: #4ade80;
  --od-danger: #ff6b6b;
  --od-warning: #ffc94a;
  --od-info: #5ac8fa;
  --od-family-nintendo: #e60012;
  --od-family-sony: #0070d1;
  --od-family-xbox: #2fd67b;
  --od-family-sega: #1a66ff;
  --od-family-atari: #f5a623;
  --od-border: rgba(255, 255, 255, 0.12);
  --od-focus-ring: color-mix(in srgb, var(--od-accent) 70%, white);
  --od-tile-min: 180px;
  --od-tile-gap: 10px;
  --od-crt-opacity: 0.03;
  /* Style B glass launcher chrome */
  --od-glass-bg: rgba(20, 24, 32, 0.72);
  --od-glass-border: rgba(255, 255, 255, 0.14);
  --od-glass-blur: 12px;
  --od-platform-accent: var(--od-accent);
  --od-platform-motion: none;
  --font-ui: "Segoe UI", "Helvetica Neue", sans-serif;
  --font-display: "Arial Black", "Segoe UI", sans-serif;
}
```

Member SPA also ships `frontend/member-app` chrome (`glass.css`, TopNav). Built **`member-app.css`** must be linked in the SPA shell.

## Command palette (planned)

- Shortcut: Ctrl/Cmd+K
- Sources: games search (`/api/search`), admin jumps
- Ship as React island under `frontend/command-palette/` in Wave 0.1

## Checklist

- [x] Document tokens (default accent `#2fd67b` + glass)
- [ ] Shared package `frontend/design-system`
- [ ] Command palette island
- [x] Wire tokens into theme pipeline / member SPA
- [ ] Wire into React admin SPA (`frontend/admin-app`)
