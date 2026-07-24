# Close remaining competitive gaps — design

**Date:** 2026-07-24  
**Status:** Approved (user: lets work on all the gaps)  
**Branch:** `feature/roadmap-q1-foundation`

## In scope (this wave)

| Gap | Approach |
|---|---|
| *arr connectors | Behind `ENABLE_ARR_MODULE`: Prowlarr/Jackett search + qBittorrent add-url stubs (HTTP clients, admin config) |
| Release calendar | IGDB upcoming releases endpoint + `/calendar` member page |
| GiantBomb / PCGW | Provider plugins (API key / scrape-safe PCGW summary link enrichment) |
| Deeper i18n | Expand catalogs; locale on library-grid via `data-locale` + string map |
| 7z ROM archives | Optional `py7zr` extract path |
| Encrypted saves | Fernet at-rest for emulator save blobs |
| Quality profiles | GlobalSettings JSON preferred groups / size band / blocklist |
| Stats share card | SVG playtime card endpoint for a user/game |

## Out of scope / operator

- Live Authentik smoke, desktop code signing/AV  
- VR/Quest client, hardlink NAS helpers, Ollama AI, full custom layouts  
- Hydra/Heroic acquisition paths  
