---
name: docs-sync
description: >-
  Keeps GameTheca documentation in sync with every code change. Use whenever
  implementing features, fixing bugs, changing APIs/env flags, shipping UI,
  editing routes, or finishing a wave — before declaring work done. Covers
  canvas, README, docs-map, progress, user/admin guides, FAQ, troubleshooting,
  runbooks, HelpPage, and strategy docs.
---

# Docs sync (every code change)

**Hard rule:** Do not mark a coding task complete until the docs checklist below is applied or explicitly N/A with reason.

Read [checklist.md](checklist.md) for the inventory map. Prefer **update existing** docs over new files unless docs-map lists **Create**.

## Workflow (required)

1. **Diff the change** — note user-visible behavior, admin ops, env flags, APIs, routes, security, deploy steps.
2. **Touch the minimum set** from the matrix (skip rows that truly do not apply):

| If you changed… | Update… |
|---|---|
| Feature / wave / status | `docs/strategy/progress.md`, canvas `gametheca-program.canvas.tsx`, `docs/strategy/docs-map.md` if inventory shifts |
| Member UX / nav / pages | `docs/user/*`, `docs/user/faq.md`, HelpPage copy if in-app links stale |
| Admin UX / settings / integrations | `docs/admin/*`, remove Discord/webhook promises |
| Env / Compose / Unraid | `.env.example`, `README.md`, `docs/runbooks/*`, `docs/runbooks/docker-compose-deploy.md` / `unraid-deploy.md` |
| Optional sidecar (LiveKit, OIDC, arr) | Dedicated runbook + docs-map status + settings-modules |
| Support / triage | `docs/dev/issue-assess-agent.md`, `docs/dev/agent-skills.md`, skills if workflow changed |
| Security posture | `docs/strategy/security.md`, FAQ/troubleshooting security notes |
| Competitive claims | Private vault (`docs/_private/`) + [external-facing-scrub.md](../../docs/strategy/external-facing-scrub.md) when positioning changes |
| Social / A/V | `docs/strategy/social-av.md` (+ `social.md` pointer) |
| Break-glass ops | `docs/runbooks/container-wont-start.md` or new runbook; link from `docs/README.md` |
| Troubleshooting symptoms | `docs/user/troubleshooting.md` and/or `docs/admin/troubleshooting.md` |

3. **Canvas (required every docs-sync / every Docs seat turn)** — rewrite program board  
   `C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`  
   to current truth in the same turn: **Ship TLDR · Done · Next · Blocked · Team flow**. Not optional; not only when PM says “update canvas.” No empty placeholders. Import only `cursor/canvas`. End-of-turn must include **Canvas: synced**.
4. **README live media (Docs owns on every commit/ship pass)** — if member/admin UI changed **or** Docs is seated on the wave:
   - Re-run `python scripts/capture_docs_media.py` against a running instance (or copy freshest `docs/media/screenshots/` into `docs/assets/readme/` slots).
   - Canonical README slots: `hero-banner.png`, `screenshot-library.png`, `screenshot-systems.png`, `screenshot-chat.png`.
   - Never restore illustrative mock JPGs; never invent screenshots with image generators.
   - Checklist: [docs/assets/readme/CAPTURE.md](../../../docs/assets/readme/CAPTURE.md).
5. **Scrub stale claims** — search for removed product names (e.g. Discord webhooks) in `docs/`, `README.md`, HelpPage, admin guides.
6. **Index** — if you add a doc, link it from `docs/README.md` and `docs/strategy/docs-map.md`.
7. **Stop condition** — reply includes a one-line **Docs touched:** list (or `Docs: N/A — <reason>`), **Canvas: synced**, and **Capture:** refreshed | skipped (why) | needed.

## Style

- Concise; tables over prose.
- No fake “all features built” — match `progress.md`.
- Do not invent screenshots; mark Capture needed in docs-map if UI is new **and** capture cannot run this turn.
- Prefer GameTheca product name; package path stays `gametheca/`.

## Anti-patterns

- Shipping code-only PRs that change env/UI/API without docs.
- Shipping README with stale mock JPG frames after UI changed.
- Leaving Discord/Slack as supported notification paths.
- Updating strategy without user/admin/runbook when operators must act.
- Creating parallel “new guide” when an existing guide section fits.
