# GameTheca documentation

**Product version:** 0.1.0 — see root [CHANGELOG.md](../CHANGELOG.md) and [VERSION](../VERSION).

Hub for product, ops, and developer docs. All naming is **GameTheca** (package `gametheca/`, Docker `chrisjrovira/gametheca`).

## Start here

| Audience | Go to |
|---|---|
| Operators / Unraid | [runbooks/unraid-deploy.md](runbooks/unraid-deploy.md) |
| Operators / Docker Compose | [runbooks/docker-compose-deploy.md](runbooks/docker-compose-deploy.md) (if present) / root README |
| Operators / break-glass | [runbooks/container-wont-start.md](runbooks/container-wont-start.md) |
| OIDC / Authentik SSO | [runbooks/oidc-sso.md](runbooks/oidc-sso.md), [runbooks/oidc-authentik-unraid.md](runbooks/oidc-authentik-unraid.md) |
| Desktop code signing | [runbooks/desktop-code-signing.md](runbooks/desktop-code-signing.md) |
| Product / roadmap | [strategy/README.md](strategy/README.md) |
| API consumers | [openapi/openapi.json](openapi/openapi.json) |
| UI tokens (Wave 0) | [dev/ui-wave0-tokens.md](dev/ui-wave0-tokens.md) |
| Quest / VR PWA | [../clients/quest/README.md](../clients/quest/README.md) |

## Layout

```
docs/
  README.md                 ← you are here
  strategy/                 ← product direction & execution
  runbooks/                 ← deploy & incident procedures
  openapi/                  ← HTTP contract
  dev/                      ← engineering notes
  superpowers/              ← design specs & implementation plans
```

## Naming

| Surface | Value |
|---|---|
| Product | GameTheca |
| Version | 0.1.0 |
| GitHub | chrisjrovira/gametheca |
| Image | `chrisjrovira/gametheca:0.1.0` / `:latest` |
| App container | gametheca-app |
| DB container | gametheca-db |
| Python package | gametheca |
| Library mount (Docker) | /app/gametheca/static/library |
| Env init flag | GAMETHECA_INITIALIZATION_COMPLETE |
