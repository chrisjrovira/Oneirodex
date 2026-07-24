# GameTheca strategy pack

Product direction for GameTheca as a **self-hosted, multi-user, DRM-free library & distribution platform**.

Read in this order:

| # | Doc | Purpose |
|---|---|---|
| 1 | [competitive.md](competitive.md) | Peer teardown & gaps vs GameVault / Drop / others |
| 2 | [roadmap.md](roadmap.md) | North star, quarters, milestones, non-goals |
| 3 | [features.md](features.md) | Implementation-ready feature plans (P0+) |
| 4 | [ui.md](ui.md) | UI rebuild waves, BadgeStack, GameActionBar |
| 5 | [progress.md](progress.md) | What shipped / what’s next |
| 6 | [docs-map.md](docs-map.md) | Documentation inventory & gaps |

## Stance (short)

- **In scope:** scan/recognition, freshness, ops health, API/tokens, playtime, collections, companion client lifecycle (Download · Install · Update · Uninstall), title-card badges, store **ownership sync** (register owned titles into a user’s personal library — no store downloads)  
- **Out of scope:** Hydra-style torrent/debrid acquisition; Heroic-style Epic/GOG/Amazon **DRM download/install** queues  
- **Optional later:** feature-flagged indexer module with clear BYO framing

## Related code

- Package: `gametheca/`
- Library UI: `frontend/library-grid/` (`BadgeStack`, `GameActionBar`)
- Runbooks: `docs/runbooks/`
