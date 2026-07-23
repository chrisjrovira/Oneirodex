# GameTheca Product Rebrand — Phase A Design

**Date:** 2026-07-23  
**Scope:** User-visible strings, Docker/docs, greenfield defaults, darker default theme, logo assets.

## Goals

Rebrand the product from SharewareZ to **GameTheca** for humans and new installs, without renaming the Python package or breaking existing on-disk metadata.

## In scope (Phase A)

- Display names in HTML templates, help copy, Discord defaults, theme author/description
- Docker image/container names (`chrisjrovira/gametheca:latest`, `gametheca-app`, `gametheca-db`)
- Compose header comments; `.env.example` / `.env.docker.example` DB defaults (`gametheca` / `gamethecatest`) with a note that existing installs may still use `sharewarez`
- README clone URL → `https://github.com/chrisjrovira/gametheca.git`; remove axewater links
- Installer / start scripts user-facing messages; greenfield DB user/db → `gamethecauser` / `gametheca`
- Local metadata default filename → `gametheca.json`, with read fallback to `sharewarez.json`
- Proposal sidecar default → `gametheca.proposal.json`, with read/remove support for `sharewarez.proposal.json`
- Logo assets: `static/newstyle/gametheca_*.png` (+ compat copies of old filenames)
- Darker default theme: teal accent, deeper surfaces, dimmed body backdrop (`default_theme` 2.1.0)
- Micro edit gap: expose `aggregated_rating` and `first_release_date` on game identify/edit Details

## Out of scope (later phases)

- Renaming the `sharewarez/` Python package or import paths
- Changing `UPLOAD_FOLDER` filesystem paths (`./sharewarez/static/library`, `/app/sharewarez/static/library`)
- Migrating existing PostgreSQL database names automatically
- Full Expert metadata edit (store URLs, HLTB, NFO, GameURL rows)
- Store library import (Steam/Epic/GOG/Amazon owned libraries)
- Dedicated Audiotheca theme pack beyond default-var retune

## Compatibility notes

- Existing deployments keep working with old DB names and legacy sidecar filenames.
- New installs use GameTheca naming for DB and metadata defaults.
- After pull, use Admin → Themes → Reset Default Themes (or DEV_MODE) to refresh theme CSS on volume mounts.
