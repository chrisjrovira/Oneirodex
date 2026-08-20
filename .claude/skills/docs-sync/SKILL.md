---
name: docs-sync
description: >-
  Keeps GameTheca documentation in sync with every code change. Use whenever
  implementing features, fixing bugs, changing APIs/env flags, shipping UI,
  editing routes, or finishing a wave — before declaring work done. Covers
  README, docs-map, progress, user/admin guides, FAQ, troubleshooting,
  runbooks, HelpPage, and strategy docs.
---

# Docs sync (every code change)

**Hard rule:** Do not mark a coding task complete until the checklist below is applied, or explicitly marked N/A with a reason.

Read [checklist.md](checklist.md) for the inventory map. Prefer **updating an existing** doc over adding a new file unless `docs/strategy/docs-map.md` lists **Create**.

## Workflow (required)

1. **Diff the change** — note user-visible behavior, admin ops, env flags, APIs, routes, security, deploy steps.
2. **Touch the minimum set** from the matrix (skip rows that truly do not apply):

| If you changed… | Update… |
|---|---|
| Feature / wave / status | `docs/strategy/progress.md`; `docs/strategy/docs-map.md` if the inventory shifts |
| Member UX / nav / pages | `docs/user/*`, `docs/user/faq.md`, HelpPage copy if in-app links go stale |
| Admin UX / settings / integrations | `docs/admin/*` |
| Env / Compose / Unraid | `.env.example`, `README.md`, `docs/runbooks/*` |
| Optional sidecar (LiveKit, OIDC, arr) | Dedicated runbook + docs-map status + settings-modules |
| Support / triage | `docs/dev/issue-assess-agent.md`, `docs/dev/agent-skills.md`, and the skill itself if the workflow changed |
| Security posture | `docs/strategy/security.md`, FAQ/troubleshooting security notes |
| Competitive claims | Private vault (`docs/_private/`) + `docs/strategy/external-facing-scrub.md` |
| Social / A/V | `docs/strategy/social-av.md` (+ `social.md` pointer) |
| Break-glass ops | `docs/runbooks/container-wont-start.md` or a new runbook; link it from `docs/README.md` |
| Troubleshooting symptoms | `docs/user/troubleshooting.md` and/or `docs/admin/troubleshooting.md` |
| Agent skills / agents / locks | `docs/dev/agent-skills.md`, `docs/dev/agent-locks.md` |

3. **Progress board** — `docs/strategy/progress.md` is the program board: Ship TLDR · Done · Next · Blocked. Keep it true in the same turn as the change. No empty placeholders, no "all features built" claims that outrun the code.
4. **README live media** — if member/admin UI changed:
   - Re-run `python scripts/capture_docs_media.py` against a running instance, or copy the freshest `docs/media/screenshots/` into the `docs/assets/readme/` slots.
   - Canonical README slots: `hero-banner.png`, `screenshot-library.png`, `screenshot-systems.png`, `screenshot-chat.png`.
   - Never restore illustrative mock JPGs; never invent screenshots with image generators.
   - Checklist: [docs/assets/readme/CAPTURE.md](../../../docs/assets/readme/CAPTURE.md).
5. **Scrub stale claims** — search `docs/`, `README.md`, HelpPage, and admin guides for removed product names and retired promises.
6. **Index** — if you add a doc, link it from `docs/README.md` and `docs/strategy/docs-map.md`.
7. **Stop condition** — the reply includes a one-line **Docs touched:** list (or `Docs: N/A — <reason>`) and **Capture:** refreshed | skipped (why) | needed.

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

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
