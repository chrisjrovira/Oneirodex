# GameTheca documentation

Hub for product, ops, and developer docs. All naming is **GameTheca** (package `gametheca/`, Docker `chrisjrovira/gametheca`).

## Start here

| Audience | Go to |
|---|---|
| Operators / Unraid | [runbooks/unraid-deploy.md](runbooks/unraid-deploy.md) |
| Operators / break-glass | [runbooks/container-wont-start.md](runbooks/container-wont-start.md) |
| Product / roadmap | [strategy/README.md](strategy/README.md) |
| API consumers | [openapi/openapi.json](openapi/openapi.json) |
| UI tokens (Wave 0) | [dev/ui-wave0-tokens.md](dev/ui-wave0-tokens.md) |

## Layout

```
docs/
  README.md                 ← you are here
  strategy/                 ← product direction & execution
  runbooks/                 ← deploy & incident procedures
  openapi/                  ← HTTP contract
  dev/                      ← engineering notes
```

## Naming

| Surface | Value |
|---|---|
| Product | GameTheca |
| GitHub | chrisjrovira/gametheca |
| Image | chrisjrovira/gametheca:latest |
| App container | gametheca-app |
| DB container | gametheca-db |
| Python package | gametheca |
| Library mount (Docker) | /app/gametheca/static/library |
| Env init flag | GAMETHECA_INITIALIZATION_COMPLETE |
