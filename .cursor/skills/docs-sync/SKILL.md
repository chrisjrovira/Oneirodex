---
name: docs-sync
description: >-
  Keeps GameTheca documentation in sync with the current change. Use when
  finishing a coding task, marking work done, or when the user asks to update
  docs. Covers README, docs-map, the living progress board, user/admin guides,
  FAQ, troubleshooting, runbooks, HelpPage, and strategy docs.
---

# Docs sync (every code change)

**Hard rule:** Do not mark a coding task complete until this checklist is applied, or explicitly marked N/A with a reason.

Read [checklist.md](checklist.md) for the inventory map. Prefer **updating an existing** doc over adding a new file unless `docs/strategy/docs-map.md` lists **Create**.

## Workflow (required)

1. **Diff the change** — note user-visible behavior, admin ops, env flags, APIs, routes, security, deploy steps.
2. **Touch the minimum set** from [checklist.md](checklist.md) (skip rows that truly do not apply).
3. **Progress board** — update the **living head** of `docs/strategy/progress.md` only: Ship TLDR · Done · Next · Blocked. Do not append wave diaries or paste QA PASS strings.
4. **docs-map** — change Status cells only when the inventory shifts. Status is `Have` / `Update` / `Create` plus one short freshness clause. Never concatenate test counts into Status.
5. **UI debt** — for UI work, update the **open table** in `docs/dev/ui-debt-log.md`. Do not append changelog novels.
6. **README live media** — if member/admin UI changed:
   - Re-run `python scripts/capture_docs_media.py` against a running **populated** instance, or copy the freshest `docs/media/screenshots/` into the `docs/assets/readme/` slots.
   - Canonical README slots: `hero-banner.png`, `screenshot-library.png`, `screenshot-systems.png`, `screenshot-chat.png`.
   - Never restore illustrative mock JPGs; never invent screenshots with image generators.
   - Checklist: [docs/assets/readme/CAPTURE.md](../../../docs/assets/readme/CAPTURE.md).
7. **Scrub stale claims** — search `docs/`, `README.md`, HelpPage, and admin guides for removed product names and retired promises.
8. **Index** — if you add a doc, link it from `docs/README.md` and `docs/strategy/docs-map.md`.
9. **Stop condition** — the reply includes a one-line **Docs touched:** list (or `Docs: N/A — <reason>`) and **Capture:** refreshed | skipped (why) | needed.

## Style

- Concise; tables over prose.
- Match `progress.md` — do not claim more than the code does.
- Do not invent screenshots; mark Capture needed in docs-map if the UI is new **and** capture cannot run this turn.
- Prefer the GameTheca product name; the package path stays `gametheca/`.

## Anti-patterns

- Shipping code-only changes that move env/UI/API behavior without docs.
- Shipping a README with stale mock JPG frames after the UI changed.
- Updating strategy docs without the user/admin/runbook page an operator actually reads.
- Creating a parallel "new guide" when a section of an existing guide fits.
- Dumping QA PASS strings into `docs-map.md` Status cells or appending wave tables to `progress.md`.
- Auto-loading `docs/strategy/archive/`, the superpowers archive, or the ui-debt changelog.

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
