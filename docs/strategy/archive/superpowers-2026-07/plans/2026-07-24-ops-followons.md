# Ops follow-ons Implementation Plan

> **For agentic workers:** Execute task-by-task. Commits only if user asks.

**Goal:** Ship Authentik local-optional UX, AI apply, arr→hardlink, desktop signing hooks, Quest PWA MVP.

**Architecture:** Feature-flagged extensions of existing OIDC / AI / hardlink / arr / VR modules. No new heavy frameworks.

**Tech Stack:** Flask, qBittorrent WebAPI, Ollama, Tauri 2, Web App Manifest.

## Global Constraints

- No secrets in git
- Hardlink/AI apply path-sandboxed
- Local login always available
- Default all new write flags **off**

## Tasks

- [ ] T1 Authentik/local-only copy + LAN runbook
- [ ] T2 AI auto-apply API + admin UI
- [ ] T3 arr→hardlink pipeline
- [ ] T4 Desktop signing docs + CI/Tauri
- [ ] T5 Quest `/vr` PWA
- [ ] T6 Tests + strategy docs
