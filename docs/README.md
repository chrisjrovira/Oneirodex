# GameTheca documentation

**Product version:** 1.0.0-beta — see root [CHANGELOG.md](../CHANGELOG.md) and [VERSION](../VERSION).

Hub for product, ops, and developer docs. Naming: **GameTheca** (package `gametheca/`, Docker `chrisjrovira/gametheca`).

Root [README.md](../README.md) includes badges, feature tour, screenshots (`docs/assets/readme/`), quick start, and troubleshooting.

**Docs sync:** every code change must update the relevant docs — project skill `.cursor/skills/docs-sync/` (mirrored under `.claude/skills/docs-sync/`), required by `CLAUDE.md`.

## Start here

| Audience | Go to |
|---|---|
| End users | [user/getting-started.md](user/getting-started.md) · [faq.md](user/faq.md) · [troubleshooting.md](user/troubleshooting.md) · [browser-play.md](user/browser-play.md) · [desktop-companion.md](user/desktop-companion.md) · [controllers-and-vr.md](user/controllers-and-vr.md) · [translation-patches.md](user/translation-patches.md) · [free-games.md](user/free-games.md) · [social-and-voice.md](user/social-and-voice.md) · [library-and-systems.md](user/library-and-systems.md) · [preferences-themes.md](user/preferences-themes.md) · [downloads.md](user/downloads.md) |
| Operators / native install | [runbooks/install-native.md](runbooks/install-native.md) — Linux · macOS · Windows installers, service units, upgrade |
| Operators / scan locations | [runbooks/remote-scan-locations.md](runbooks/remote-scan-locations.md) — `GT_LIBRARY_ROOTS`: NAS shares and extra disks, not just the server's own disk |
| Operators / Unraid | [runbooks/unraid-deploy.md](runbooks/unraid-deploy.md) |
| Operators / Docker Compose | [runbooks/docker-compose-deploy.md](runbooks/docker-compose-deploy.md) — optional `--profile livekit` · `--profile clamav` |
| Operators / observability (optional) | [runbooks/observability-profile.md](runbooks/observability-profile.md) — Prometheus stub; Admin Ops is default |
| Operators / LiveKit voice | [runbooks/livekit-unraid.md](runbooks/livekit-unraid.md) |
| Operators / WebRetro cores | [runbooks/webretro-cores.md](runbooks/webretro-cores.md) · [admin/webretro-core-clauses.md](admin/webretro-core-clauses.md) (non-commercial clauses — not counsel) |
| Operators / emulator BIOS | [runbooks/emulator-bios.md](runbooks/emulator-bios.md) — operator-supplied firmware, filenames only |
| Operators / ROM reference sets | [runbooks/reference-sets.md](runbooks/reference-sets.md) |
| Operators / login rate limit (proxy) | [runbooks/login-rate-limit-proxy.md](runbooks/login-rate-limit-proxy.md) |
| Operators / break-glass | [runbooks/container-wont-start.md](runbooks/container-wont-start.md) |
| Operators / security posture | [strategy/security.md](strategy/security.md) · [strategy/security-legal-playbook.md](strategy/security-legal-playbook.md) — audit findings, what shipped, and `CSP_ENFORCE` (on by default) |
| Operators / release scrub (SCRUB-7) | [runbooks/scrub-shipped-bundles.md](runbooks/scrub-shipped-bundles.md) · [strategy/external-facing-scrub.md](strategy/external-facing-scrub.md) |
| Maintainers / disk hygiene | [runbooks/workspace-disk-hygiene.md](runbooks/workspace-disk-hygiene.md) — safe cache deletes vs WebRetro / `.git` |
| Maintainers / desktop installers | [runbooks/local-installers.md](runbooks/local-installers.md) — build Windows · macOS · Linux bundles without GitHub Actions; a `.dmg` still needs a Mac |
| Admins | [admin/libraries-and-scans.md](admin/libraries-and-scans.md) · [members-and-invites.md](admin/members-and-invites.md) (invites without email · local accounts) · [privacy-data-handling.md](admin/privacy-data-handling.md) (what the host stores · child ACL · optional outbound) · [webretro-core-clauses.md](admin/webretro-core-clauses.md) (snes9x / genesis_plus_gx quotes — **not counsel**) · [settings-modules.md](admin/settings-modules.md) · [discover-sections.md](admin/discover-sections.md) (storefront shelves · layouts · timed events) · [theme-fonts-and-images.md](admin/theme-fonts-and-images.md) (fonts · batch artwork) · [ops-summary.md](admin/ops-summary.md) · [support-inbox.md](admin/support-inbox.md) · [troubleshooting.md](admin/troubleshooting.md) · [themes-reset.md](admin/themes-reset.md) |
| Support triage (maintainers) | [dev/issue-assess-agent.md](dev/issue-assess-agent.md) · [dev/agent-skills.md](dev/agent-skills.md) · [dev/ui-debt-log.md](dev/ui-debt-log.md) |
| Reviewing the bundled W31 commit | [dev/w31-commit-attribution.md](dev/w31-commit-attribution.md) — which of `c6fd7bf7`'s 236 files are the security audit and which are the UI pass |
| OIDC / Authentik SSO | [runbooks/oidc-sso.md](runbooks/oidc-sso.md), [runbooks/oidc-authentik-unraid.md](runbooks/oidc-authentik-unraid.md) |
| Product / roadmap | [strategy/README.md](strategy/README.md) · [strategy/progress.md](strategy/progress.md) · [strategy/roadmap-w22-plus.md](strategy/roadmap-w22-plus.md) · [strategy/v1-readiness.md](strategy/v1-readiness.md) · [strategy/v1-gamemaster-signoff.md](strategy/v1-gamemaster-signoff.md) · [strategy/thin-client.md](strategy/thin-client.md) (post-1.0) · [strategy/challenge-bypass.md](strategy/challenge-bypass.md) (BYO solvers · 1.0) · [strategy/native-challenge-solver.md](strategy/native-challenge-solver.md) · [strategy/native-rtc.md](strategy/native-rtc.md) · [strategy/native-malware-scan.md](strategy/native-malware-scan.md) (nice-to-have post-1.0) · [strategy/cover-art-studio.md](strategy/cover-art-studio.md) (ART-1…3 · 1.0) · [strategy/gow-remote-play.md](strategy/gow-remote-play.md) (GOW-1/2 shipped) · [strategy/ambient-lighting.md](strategy/ambient-lighting.md) (LIGHT-1/2 shipped) · [strategy/cloud-tco-ballpark.md](strategy/cloud-tco-ballpark.md) (Unraid vs cloud cost) · [strategy/emulation-coverage.md](strategy/emulation-coverage.md) |
| Product / recent waves | [strategy/carryover-w28.md](strategy/carryover-w28.md) — **start here for what is open** · [strategy/roadmap-w26-ux-overhaul.md](strategy/roadmap-w26-ux-overhaul.md) (W26 UX backlog + FEAT-D) · [strategy/roadmap-w27-ux-feedback.md](strategy/roadmap-w27-ux-feedback.md) (W27) · [strategy/social-spaces-and-storefront.md](strategy/social-spaces-and-storefront.md) (W23/W25 design) |
| Is everything done? | [strategy/request-reconciliation-2026-08-15.md](strategy/request-reconciliation-2026-08-15.md) — every ask across past conversations, checked against the registers rather than against recaps |
| Past reviews & dispatches (archived) | [strategy/archive/](strategy/archive/README.md) — dated point-in-time reports: PM dispatch · GitHub scrub · full-program review · gap review · code review. Kept for provenance; **not** current guidance |
| UI refresh plan (two-bar chrome) | [strategy/ui-refresh-2026-08-06.md](strategy/ui-refresh-2026-08-06.md) — Option B approved; UIR-1…6 shipped in W26, UIR-7 tracked in [carryover-w28.md](strategy/carryover-w28.md) |
| Scope policy | [strategy/scope.md](strategy/scope.md) — unscheduled is not refused; decisions live in the private vault |
| Docs inventory | [strategy/docs-map.md](strategy/docs-map.md) |
| API | [openapi/openapi.json](openapi/openapi.json) |
| How-to videos | [media/video/howto/](media/video/howto/README.md) — one worked example per section (members + admins) |
| README media | [assets/readme/](assets/readme/) · capture recipe [CAPTURE.md](assets/readme/CAPTURE.md) |

## Layout

```
docs/
  README.md                 ← you are here
  strategy/                 ← product direction & execution
    archive/                ← dated point-in-time reports, kept for provenance
  user/                     ← end-user guides + FAQ
  admin/                    ← admin guides
  runbooks/                 ← deploy & incident procedures
  openapi/                  ← HTTP contract
  assets/readme/            ← root README icons & screenshots
  dev/                      ← engineering notes / Cursor agent workflow
  superpowers/              ← design specs, plans, handoffs
```

## Naming

| Surface | Value |
|---|---|
| Product | GameTheca |
| Version | 1.0.0-beta |
| GitHub | chrisjrovira/gametheca |
| App / DB containers | gametheca-app · gametheca-db |
| Optional voice | gametheca-livekit (`--profile livekit`) |
| Python package | gametheca |
| Default accent | `#2fd67b` (Style B+C glass) |
