---
name: ship-ready
description: >-
  Commits and always pushes GameTheca work using repo conventions. Use ONLY when
  the user explicitly says commit, ship, push, or open a PR — never on your own
  initiative and never as the tail end of an implementation task. Includes the
  docs-sync gate, conventional commits, and the mandatory push.
---

# Ship ready

Run this **only** when the user explicitly asks to commit / push / PR / ship. Never commit unprompted, and never treat "finish this feature" as permission to commit.

## Preflight

1. `git status` · `git diff` · `git log -5 --oneline`
2. Confirm **docs-sync** is done, or do it now. A code-only commit that moved env, UI, API, or ops behavior is not ready.
3. **Test-before-ship gate:** if the user said ship *after testing* or *after code completion*, do not commit until `verify-slice` evidence exists for the touched paths. If code is still in flight, report **Ship deferred** with what remains — do not partial-ship a broken change unless the user overrides.
4. **README media:** if this ship includes member/admin UI, confirm the live README slots are current (`docs/assets/readme/screenshot-*.png`, `hero-banner.png`). If the UI drifted and capture never ran, refresh via `scripts/capture_docs_media.py` **before** committing. Do not commit restored mock JPGs.
5. No secrets (`.env`, tokens, keys); never stage `docs/_private/`.
6. Conventional commit: `feat|fix|chore|docs|refactor|test(scope): …`
7. Author via `-c` flags only, never `git config`.
8. **Prompt trees:** if `.cursor/skills`, `.cursor/agents`, or `.claude/` counterparts changed, run `python scripts/sync_prompt_trees.py` (or `--check` and fail on drift). Edit `.cursor/` only; the script mirrors into `.claude/`.

## Commit

The repo default branch is `main`. If you are on it, branch first unless the user asked to commit directly to `main`.

```bash
git -c user.name="cephyrix_zyth" -c user.email="cephyrix_zyth@users.noreply.github.com" add -A
```

Review `git status` and unstage secrets or `docs/_private/` before committing. Then commit with a heredoc so the body survives:

```bash
git -c user.name="cephyrix_zyth" -c user.email="cephyrix_zyth@users.noreply.github.com" commit -F - <<'EOF'
feat: short why

Optional body.
EOF
```

Never `git config`; never `--no-verify` unless the user demands it; never amend unless the user asks.

## Push (always)

**Hard rule:** after a successful commit from this skill, **always** push to the tracked remote (create upstream with `-u` if needed). Do not leave ship commits local-only.

```bash
git push -u origin HEAD
```

Open a PR with `gh pr create` only if the user asked for one. Never auto-merge; never force-push to `main`.

If the push fails (auth or network), report the error and the local commit hash — do not describe the ship as complete.

## Output

```
### Ship
**Commit:** <hash> <subject>
**Remote:** pushed | failed (<reason>) — local <hash>
**PR:** <url or n/a>
**Docs touched:** …
```

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
