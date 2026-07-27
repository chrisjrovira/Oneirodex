# UI Wave 0 — design tokens (GameTheca)

These CSS variables are the shared foundation for web + future desktop client.
Tracked source: `gametheca/setup/default_theme/css/gt-tokens.css` (presets regenerated at **`GENERATOR_VERSION` 6**).

Import after theme base.css or use as a reference when migrating React islands / admin SPA.

```css
:root {
  --gt-bg: #0b0d10;
  --gt-surface: #141820;
  --gt-surface-2: #1c2230;
  --gt-text: #f2f4f8;
  --gt-text-muted: #c4ccd8;
  --gt-accent: #2fd67b;
  --gt-accent-contrast: #0b0d10;
  --gt-success: #4ade80;
  --gt-danger: #ff6b6b;
  --gt-warning: #ffc94a;
  --gt-info: #5ac8fa;
  --gt-border: rgba(255, 255, 255, 0.12);
  --gt-focus-ring: color-mix(in srgb, var(--gt-accent) 70%, white);
  --gt-tile-min: 180px;
  --gt-tile-gap: 10px;
  --gt-crt-opacity: 0.03;
  /* Style B glass launcher chrome */
  --gt-glass-bg: rgba(20, 24, 32, 0.72);
  --gt-glass-border: rgba(255, 255, 255, 0.14);
  --gt-glass-blur: 12px;
  --gt-platform-accent: var(--gt-accent);
  --gt-platform-motion: none;
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
