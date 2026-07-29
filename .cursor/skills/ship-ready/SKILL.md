---
name: ship-ready
description: >-
  Commits and always pushes GameTheca work using repo conventions. Use when
  the user says commit, ship, push, open PR, or ship to GitHub. Never commit
  unprompted. Includes docs-sync check, PM ship helper prompt, and conventional
  commits. Parent PM should Task Docs/QA first on wave closes.
disable-model-invocation: true
---

# Ship ready

Only when the user explicitly asks to commit / push / PR / ship.

## Who runs this

| Actor | Role |
|---|---|
| **PM / parent** | Preferred on wave closes — runs pre-ship Tasks then this skill |
| **Docs** | May ship docs-only when human said ship and canvas already synced |
| **Any seat** | Only if human said ship **and** change is solely that seat’s paths — still run Preflight |

Wrong-seat: do not ship another seat’s unreviewed product dump without PM/QA.

## Preflight

1. `git status` / `git diff` / `git log -5 --oneline`
2. Confirm **docs-sync** done (or Task `@agent-docs` / do it now)
3. **Wave close gate:** If this ship ends a multi-seat wave, require Docs report **Canvas: synced**. If missing → Task Docs first; do not pretend the wave closed.
4. **Test-before-ship gate:** When human says ship **after testing** / **after code completion**, do **not** commit until (a) implementer Tasks report complete and (b) QA/`verify-slice` evidence exists for touched paths. If code still in flight → report **Ship deferred** with remaining seats; do not partial-ship a broken wave unless human overrides.
5. **README media** — if this ship includes member/admin UI (or Docs was on the wave), confirm live README slots are current (`docs/assets/readme/screenshot-*.png`, `hero-banner.png`). If UI drifted and capture was not run, Task `@agent-docs` to refresh via `scripts/capture_docs_media.py` **before** commit. Do not commit restored mock JPGs.
6. Optional: Task `@agent-qa` for smoke if risky server/UI paths changed and no evidence yet
7. No secrets (`.env`, tokens, keys); never stage `docs/_private/`
8. Conventional commit: `feat|fix|chore|docs|refactor|test(scope): …`
9. Author via `-c` flags only (never `git config`): `cephyrix_zyth` / `cephyrix_zyth@users.noreply.github.com`

## PM ship helper prompt (copy-paste)

Use when the human says ship and a wave (or multi-seat work) is in flight:

```text
You are running GameTheca ship-ready. Follow .cursor/skills/ship-ready/SKILL.md
and honor agent-team / prompt-brief/defaults.md.

## Pre-ship
1. If human said “after testing / after code completion”: wait for implementers complete + QA evidence; else output Ship deferred.
2. If implementers just landed: Task @agent-qa for DoD smoke OR cite existing QA evidence.
3. Task @agent-docs to sync progress + rewrite program canvas (TLDR·Done·Next·Blocked·Team flow).
   Refuse to commit a wave close without Canvas: synced.
4. README capture if UI shipped this wave.
5. Then: git status / diff / log; stage safely; conventional commit with -c author flags.
6. Always git push -u origin HEAD after successful commit.
7. gh pr create only if human asked for a PR.
8. Output the ### Ship block.

Locked: no --no-verify unless human demands; no force-push to main; no secrets; no docs/_private.
```

## Commit (Windows PowerShell-safe)

```powershell
git -c user.name="cephyrix_zyth" -c user.email="cephyrix_zyth@users.noreply.github.com" add -A
# review status; unstage secrets / docs/_private if any
git -c user.name="cephyrix_zyth" -c user.email="cephyrix_zyth@users.noreply.github.com" commit -m @"
feat: short why

Optional body.
"@
```

Never `git config`; never `--no-verify` unless user demands; never amend unless user asks and amend rules allow.

## Push (always)

**Hard rule:** After a successful commit from this skill, **always** `git push` to the tracked remote (create upstream with `-u` if needed). Do not leave ship commits local-only.

```powershell
git push -u origin HEAD
# gh pr create only if user asked for a PR
```

If push fails (auth/network), report the error and the local commit hash — do not pretend the ship completed remotely.

## Output

```
### Ship
**Commit:** <hash> <subject>
**Remote:** pushed | failed (<reason>) — local <hash>
**Canvas:** synced | n/a (non-wave) | blocked
**PR:** <url or n/a>
**Docs touched:** …
```
