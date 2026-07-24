# Changelog

All notable changes to GameTheca are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-07-24

First milestone release on the `feature/roadmap-q1-foundation` track (GameTheca rebrand + competitive-gap close).

### Added

- GameTheca package cutover (`gametheca/`), Docker image `chrisjrovira/gametheca`
- Optional *arr module (Prowlarr/Jackett + qBittorrent) and **arr→hardlink** pipeline (triple-gated)
- Release calendar, quality profiles, GiantBomb/PCGW providers
- Detail-page layout editor (order/visibility)
- Ollama AI assist + gated **auto-apply** rename (`ENABLE_AI_AUTO_APPLY`)
- Hardlink preview/apply helpers
- VR / Quest **PWA** browse at `/vr`
- OIDC / Authentik SSO (optional; local username/password always works)
- Desktop companion (Tauri) + signing runbook/CI hooks
- Emulator save sync options, deeper en/es i18n, SVG playtime share cards
- Strategy docs, runbooks, OpenAPI artifact under `docs/`

### Changed

- Docker Compose now passes optional module flags (AI, VR, arr, OIDC, hardlinks)
- Setup and Integrations copy clarify that Authentik is optional for local installs

### Security / ops

- Hardlink and AI apply remain feature-flagged and path-sandboxed
- `SECRET_KEY` required; container refuses the placeholder

## [Unreleased]

- Live Authentik smoke (operator secrets)
- Windows code-signing certificate for distributed desktop builds
- Native Quest APK (PWA MVP ships in 0.1.0)

[0.1.0]: https://github.com/chrisjrovira/gametheca/releases/tag/v0.1.0
