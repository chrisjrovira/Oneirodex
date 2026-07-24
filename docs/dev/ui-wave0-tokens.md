# UI Wave 0 — design tokens (GameTheca)

These CSS variables are the shared foundation for web + future desktop client.
Import after theme base.css or use as a reference when migrating React islands.

```css
:root {
  --gt-font-display: "Segoe UI Soft", "Trebuchet MS", sans-serif;
  --gt-font-body: "IBM Plex Sans", "Segoe UI", sans-serif;
  --gt-space-1: 4px;
  --gt-space-2: 8px;
  --gt-space-3: 12px;
  --gt-space-4: 16px;
  --gt-space-6: 24px;
  --gt-radius-sm: 6px;
  --gt-radius-md: 10px;
  --gt-accent: var(--btn-primary, #14b8a6);
  --gt-surface: var(--bg-dark-40, rgba(18, 22, 28, 0.92));
  --gt-text: var(--text-light, #e0e0e0);
  --gt-muted: var(--text-muted, #adb5bd);
}
```

## Command palette (planned)

- Shortcut: Ctrl/Cmd+K
- Sources: games search (`/api/search`), admin jumps
- Ship as React island under `frontend/command-palette/` in Wave 0.1

## Checklist

- [x] Document tokens
- [ ] Shared package `frontend/design-system`
- [ ] Command palette island
- [ ] Wire into `base.html`
