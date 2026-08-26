# ADR: Product name Oneirodex

**Date:** 2026-08-26  
**Status:** Accepted — **name chosen**; cutover **not started**  
**Owners:** `maintainer` · `agent-docs`

## Context

The public product string is **GameTheca**. The Python package, Docker image, GitHub repo, Compose/Unraid names, env prefix `GT_*`, and CSS `--gt-*` / `.gt-*` all follow that root. A rename was requested; twenty cosmic-horror-register options were checked against game libraries, launchers, ROM managers, *arr / Unraid-adjacent tools, Steam/itch, and exact GitHub / PyPI / npm slugs. **Oneirodex** was selected.

## Decision

**Public product name is Oneirodex.**

| | |
|---|---|
| Spelling | Oneirodex — one word, capital O. Not OneiroDex, not ONEIRODEX in UI |
| Say it | oh-NY-roh-dex |
| Slug | `oneirodex` |
| Sense | Catalog of dreams / household catalog against the vast. Coined from *oneiros* + dex. No Cthulhu / Arkham / Carcosa proper nouns |

Until an explicit rename wave:

- User-facing copy, Help, README, and operator docs keep saying **GameTheca**.
- Package path stays `gametheca/`. Docker, Compose, Unraid, and GitHub stay `gametheca` / `chrisjrovira/gametheca`.
- Env stays `GT_*`. CSS stays `--gt-*` / `.gt-*`. Do not invent `OD_*` aliases in this ADR.
- Danger-zone confirm stays `"RESET GAMETHECA"` until that wave changes it.

Do not mix Oneirodex into UI or docs prose except this ADR, [agent-locks.md](../dev/agent-locks.md), [progress.md](../strategy/progress.md), and [docs/README.md](../README.md) naming.

## Snapshot (2026-08-26, not counsel)

Related-space: no current product named Oneirodex in game libraries, launchers, ROM managers, or self-hosted media.

| Surface | Result |
|---|---|
| PyPI `oneirodex` | 404 |
| npm `oneirodex` | 404 |
| crates.io `oneirodex` | 404 |
| GitHub user `oneirodex` | 404 |
| Docker Hub user / library `oneirodex` | 404 |
| `oneirodex.com` / `.dev` / `.app` / `.net` / `.org` | RDAP 404 (treat as unregistered) |
| `oneirodex.io` | RDAP inconclusive (nic.io DNS fail; Identity Digital 404 may be the wrong TLD server) |

Adjacent, not the same mark:

- **Oneiro** — Steam indie title; C++ engine (`OneiroGames/Oneiro`); Oneiro N.A. Inc. / oneiro.io (unrelated industry).
- A blog used **ONEIRODEX™** as a fictional drug name. Not a shipped software product. Flag for trademark counsel later.

Web search found no USPTO / EUIPO hit for Oneirodex as a live software mark. That is **not** a clearance opinion.

## Cutover (only when asked)

1. **Public string** — UI, Help, README, user/admin docs, CHANGELOG going forward. Package and Docker unchanged.
2. **Ops identifiers** — image `chrisjrovira/oneirodex`, containers, Unraid template, GitHub repo. Keep redirects / dual names for existing installs.
3. **Code identifiers** — Python package, `GT_*` → new prefix, CSS `gt-` tokens. Longest and last.

Existing installs must keep working through (2) and (3). Do not rewrite git history for the old name.

## Consequences

| Pros | Cons |
|---|---|
| Unique in the related space; sayable; already means catalog | Full mechanical rename is a dedicated wave, not a drive-by |
| Avoids crowded Game* / Play* / *arr collisions | Adjacent *Oneiro* root exists; fictional ONEIRODEX™ exists in prose |
| Slug still free on GitHub / PyPI / npm / most domains (26 Aug 2026) | Unclaimed names go fast; `.io` not confirmed |

## Related

- [agent-locks.md](../dev/agent-locks.md) (cutover lock)
- [progress.md](../strategy/progress.md)
- [docs/README.md](../README.md) naming table
