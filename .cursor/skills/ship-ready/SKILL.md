---
name: ship-ready
description: >-
  Commits and optionally pushes GameTheca work using repo conventions. Use when
  the user says commit, ship, push, open PR, or ship to GitHub. Never commit
  unprompted. Includes docs-sync check and conventional commits.
disable-model-invocation: true
---

# Ship ready

Only when the user explicitly asks to commit / push / PR / ship.

## Preflight

1. `git status` / `git diff` / `git log -5 --oneline`
2. Confirm **docs-sync** done (or do it now)
3. **README media** — if this ship includes member/admin UI (or Docs was on the wave), confirm live README slots are current (`docs/assets/readme/screenshot-*.png`, `hero-banner.png`). If UI drifted and capture was not run, Task `@agent-docs` to refresh via `scripts/capture_docs_media.py` **before** commit. Do not commit restored mock JPGs.
4. No secrets (`.env`, tokens, keys)
5. Conventional commit: `feat|fix|chore|docs|refactor|test(scope): …`

## Commit (Windows PowerShell-safe)

```powershell
git -c user.name="cephyrix_zyth" -c user.email="cephyrix_zyth@users.noreply.github.com" add -A
# review status; unstage secrets if any
git -c user.name="cephyrix_zyth" -c user.email="cephyrix_zyth@users.noreply.github.com" commit -m @"
feat: short why

Optional body.
"@
```

Never `git config`; never `--no-verify` unless user demands; never amend unless user asks and amend rules allow.

## Push / PR

Only if user said push / ship to GitHub / open PR:

```powershell
git push -u origin HEAD
# gh pr create if asked and gh available
```

Return commit hash + PR URL.

## Output

```
### Ship
**Commit:** <hash> <subject>
**Remote:** pushed | local only
**PR:** <url or n/a>
```
