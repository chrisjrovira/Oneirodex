# External-facing scrub — competitor & warez-adjacent names

**Date:** 2026-07-27  
**Status:** SCRUB-1…4,6–9 **executed** (2026-07-27); SCRUB-5 history rewrite **deferred** (fix-forward). SCRUB-6 includes PR template + Issues bug/`config.yml` templates.  
**Owner:** PM → Docs + Backend + Desktop + QA  
**Goal:** Competitive intelligence and Class A brand names stay **private to the team**. They must **not** ship in git (public remotes), Docker images, desktop/thin binaries, member/admin SPA bundles, Help, README, CHANGELOG, or GitHub Issues/PR templates.

**Related:** [external-facing-scrub.md](external-facing-scrub.md) (private vault policy) · [docs-map.md](docs-map.md) · [thin-client.md](thin-client.md)

---

## Policy classes

| Class | Examples (illustrative) | Rule |
|---|---|---|
| **A — Warez / shady brand names** | Banned Class A tokens (e.g. the brand formerly cited in Wave 2 rebrand handoffs) | **Purge from git tree.** Never reintroduce. Prefer deleting the sentence over euphemism. |
| **B — Competitive intel** | Full peer catalogs, steal/ignore matrices, “stronger than X” roadmaps | **Not in public git.** Move to private vault (local-only path or private repo). Strategy in git speaks only in **GameTheca product language**. |
| **C — Named rivals in marketing/stance** | Peer product names used only to say “we’re not them” in README, user/admin guides, Help, desktop README | **Rewrite** as capability non-goals without product names: e.g. “no bundled torrent marketplace”, “no DRM store download queues”, “no Discord webhooks”. |
| **D — Integration / format brands (KEEP)** | Playnite **import**, ES-DE / Pegasus **export**, Prowlarr/Jackett/qBittorrent **connectors**, Steam/GOG/Epic **ownership register**, LiveKit, Authentik/OIDC | **Allowed** — these are shipped features or BYO tools operators configure. Do not strip APIs or user docs for Class D. |
| **D2 — Admin Acquire presets (KEEP, admin-only)** | Curated Torznab/Newznab **preset display names** in Admin → Arr / `indexer_presets.json` / Arr admin UI | **Allowed in admin surfaces only** — operators enable presets and supply their own API keys/URLs. Still **ban** those display names from README, Help marketing, CHANGELOG headlines, member SPA marketing copy, and CI artifacts. |
| **E — agent private** | Agent transcripts and scratch outside the repo | Not uploaded with product; still scrub if someone pastes into Issues/PRs. |

**Locked product non-goals (keep the rules, drop rival names in external streams):**

- No Discord bots/webhooks  
- No torrent **marketplace** storefront / magnet scrapers that bypass Torznab (native registry + optional admin presets + BYO hubs are OK)  
- No DRM store download/install queues (ownership register-only OK)  
- No romhacking.net scraping  
- OIDC stays opt-in  

---

## Known hits (seed inventory — Jul 27)

| Location | Class | Action |
|---|---|---|
| `docs/superpowers/**` (Class A token in ≥3 files) | A | Delete or rewrite lines (SCRUB-1) |
| `docs/strategy/competitive.md` (50+ peer catalog) | B | **Done (stub)** — full catalog in `docs/_private/` only |
| `docs/strategy/roadmap.md`, `features.md`, `ui.md`, `social-av.md`, strategy `README.md`, `v1-readiness.md`, `thin-client.md` | B/C | Neutralize named rivals; keep product intent (SCRUB-3) |
| `clients/desktop/README.md`, `.claude/skills/**`, `.claude/agents/**`, `docs/dev/agent-skills.md` | C | Neutralize non-goal wording (SCRUB-3) |
| `docs/superpowers/specs|plans/**` | B/C | Neutralized Class A examples → `[Repack]` / scene-tag language (SCRUB-4 polish) |
| Playnite / Pegasus / ES-DE / Prowlarr code + user docs | D | **No purge** |
| Git history / remote | A/B | Optional history rewrite only if human approves (SCRUB-5) |
| GitHub: Issues, PR bodies, Discussions, Actions logs | A/B/C | Human + SCRUB-6 checklist |
| Built artifacts: `static/dist/**`, Docker image layers, `.exe` | C | Ensure no competitor strings in shipped UI copy (SCRUB-7) |

---

## Backlog tickets

| id | priority | owner | outcome | DoD |
|---|---|---|---|---|
| **SCRUB-1** | ~~P0~~ | Docs | Purge Class A from tree | **Done** |
| **SCRUB-2** | ~~P0~~ | Docs / PM | Competitive catalog leaves public git | **Done** — stub + `docs/_private/` |
| **SCRUB-3** | ~~P0~~ | Docs | External docs/skills Class C wording | **Done** |
| **SCRUB-4** | ~~P1~~ | Docs | Superpowers specs sanitized | **Done** |
| **SCRUB-5** | P2 | Human | History rewrite | **Deferred** — fix-forward only (no `filter-repo` unless reopened) |
| **SCRUB-6** | P1 | Docs + Human | GitHub surface | **Done** — PR/Issue templates + [github-scrub-2026-07-27.md](archive/github-scrub-2026-07-27.md) (0 Class A hits) |
| **SCRUB-7** | P0 | QA + UI | Shipped UI clean | **Done** for source; rebuild `static/dist` on next image — see [scrub-shipped-bundles.md](../runbooks/scrub-shipped-bundles.md) |
| **SCRUB-8** | P1 | Backend | Comments + WAREZ→GAMES | **Done** — `DATA_FOLDER_GAMES` + deprecated alias |
| **SCRUB-9** | P1 | Docs | Prevention | **Done** — gitignore, docs-sync, banned-tokens in `_private`; the always-on scrub rule now lives in [../dev/agent-locks.md](../dev/agent-locks.md) |

---

## Sequencing

```text
SCRUB-1 (Class A purge)  ──►  SCRUB-2 (move competitive.md)
         │                         │
         └────────► SCRUB-3 (rewrite public stance) ──► SCRUB-7 (bundle grep)
                              │
                              ├─ SCRUB-4 (superpowers archive)
                              ├─ SCRUB-8 (code comments)
                              └─ SCRUB-9 (prevention)
SCRUB-5 / SCRUB-6 ── human-gated, parallel after 1–3
```

**Conflict:** Internal strategy still needs “what we won’t build.” **Resolution:** keep non-goals in **capability language** in-repo; keep named peer matrices **only** in the private vault.

**Conflict:** Playnite/Pegasus sound like “competitors.” **Resolution:** Class D — they are **integrations**, not intel. Keep.

---

## Private vault (recommended)

Suggested local (gitignored) layout:

```text
docs/_private/                 # gitignored
  competitive-catalog.md       # moved from docs/strategy/competitive.md
  peer-notes/
```

Add to `.gitignore`:

```gitignore
# Team-only competitive intel — never push
docs/_private/
```

Update docs-sync: “Competitive claims → private vault only; never peer catalogs in public tree.”

---

## Verification commands (DoD helpers)

Maintain the banned-token list in `docs/_private/banned-tokens.txt` (gitignored) — **do not paste Class A/B tokens into public docs**.

```bash
# Class A — must be empty in tracked tree (read tokens from private list)
# rg -i -f docs/_private/banned-tokens.txt . --glob '!docs/_private/**'

# Class B — public competitive.md is stub-only (no peer catalog table)

# Spot-check external streams for leftover teardown phrasing (use private patterns file)
# rg -i -f docs/_private/teardown-name-patterns.txt README.md docs/user docs/admin \
#   frontend/member-app/src/pages/HelpPage.jsx clients/desktop/README.md
```

Tune patterns carefully so Class D “Pegasus” / “Playnite” / “Prowlarr” are not false-failed.

---

## Out of scope for this scrub

- Removing BYO *arr/debrid connector docs  
- Removing Playnite import or ES-DE/Pegasus export features  
- Rewriting git history without explicit human approval (SCRUB-5) — **deferred: fix-forward only unless PM reopens**  
- Thin client / 1.0 feature work  
