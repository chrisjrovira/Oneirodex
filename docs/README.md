# GameTheca documentation

**Product version:** 0.1.0 — see root [CHANGELOG.md](../CHANGELOG.md) and [VERSION](../VERSION).

Hub for product, ops, and developer docs. All naming is **GameTheca** (package `gametheca/`, Docker `chrisjrovira/gametheca`).

## Start here

| Audience | Go to |
|---|---|
| End users | [user/getting-started.md](user/getting-started.md) · [library-and-systems.md](user/library-and-systems.md) · [preferences-themes.md](user/preferences-themes.md) · [downloads.md](user/downloads.md) |
| Operators / Unraid | [runbooks/unraid-deploy.md](runbooks/unraid-deploy.md) |
| Operators / Docker Compose | [runbooks/docker-compose-deploy.md](runbooks/docker-compose-deploy.md) |
| Operators / break-glass | [runbooks/container-wont-start.md](runbooks/container-wont-start.md) |
| Admins | [admin/libraries-and-scans.md](admin/libraries-and-scans.md) · [themes-reset.md](admin/themes-reset.md) · [settings-modules.md](admin/settings-modules.md) |
| OIDC / Authentik SSO | [runbooks/oidc-sso.md](runbooks/oidc-sso.md), [runbooks/oidc-authentik-unraid.md](runbooks/oidc-authentik-unraid.md) |
| Desktop code signing | [runbooks/desktop-code-signing.md](runbooks/desktop-code-signing.md) |
| Product / roadmap | [strategy/README.md](strategy/README.md) |
| Docs inventory | [strategy/docs-map.md](strategy/docs-map.md) |
| API consumers | [openapi/openapi.json](openapi/openapi.json) |
| UI tokens (B+C green) | [dev/ui-wave0-tokens.md](dev/ui-wave0-tokens.md) |
| Quest / VR PWA | [../clients/quest/README.md](../clients/quest/README.md) |

## Layout

```
docs/
  README.md                 ← you are here
  strategy/                 ← product direction & execution
  user/                     ← end-user guides
  admin/                    ← admin guides
  runbooks/                 ← deploy & incident procedures
  openapi/                  ← HTTP contract
  dev/                      ← engineering notes
  superpowers/              ← design specs, plans, handoffs
```

## Naming

| Surface | Value |
|---|---|
| Product | GameTheca |
| Version | 0.1.0 |
| GitHub | chrisjrovira/gametheca |
| Image | Local `gametheca:0.1.0` via Compose build (Hub publish optional) |
| App container | gametheca-app |
| DB container | gametheca-db |
| Python package | gametheca |
| Library mount (Docker) | /app/gametheca/static/library |
| Env init flag | GAMETHECA_INITIALIZATION_COMPLETE |
| Default accent | `#2fd67b` (Style B+C glass) |
