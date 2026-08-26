# GameTheca

Self-hosted game library manager. Python (Flask under ASGI) backend + four React SPAs + a Tauri desktop client. Version 1.0.0-beta.

## Layout

| Path | What it is |
|---|---|
| `gametheca/` | Backend package. Routes split by surface: `routes_member.py`, `routes_admin_ext/`, `routes_apis/`. |
| `asgi.py` | ASGI entrypoint and app wiring. |
| `frontend/member-app` | Member SPA. |
| `frontend/admin-app` | Admin SPA. |
| `frontend/ops-glance` | Ops dashboard SPA. |
| `frontend/api-client` | `@gametheca/api-client` typed fetch client. |
| `clients/desktop` | Tauri companion. `clients/quest` is the VR client. |
| `docs/` | Start at [docs/README.md](docs/README.md). |

## Running tests

Postgres container: **`gametheca-review-db`**. Start it if down (`docker start gametheca-review-db`). Scoped pytest; `TEST_DATABASE_URL` must contain `test`. First-time setup: [docs/runbooks/local-postgres-pytest.md](docs/runbooks/local-postgres-pytest.md).

CI gates a **core subset** in [.github/workflows/ci-tests.yml](.github/workflows/ci-tests.yml) — passing CI is not the full suite.

Frontend: `cd frontend/member-app && npm test -- --run` scoped to one file. The full member-app suite is slow on a NAS checkout — background it and read the output file.

## Ratchets — do not regress

```bash
python scripts/api_envelope_lint.py
node scripts/css-token-lint.mjs
```

Semantics live in the glob rules when those files are in context: `.cursor/rules/api-envelope.mdc`, `.cursor/rules/spa-csrf-tokens.mdc`. `--update` only after a genuine reduction.

## Writing a route

Return JSON through `api_ok` / `api_error` from `gametheca/utils/api_response.py`. Pick `error_code` from `ERROR_CODES`. `detail` is passed to the browser as given — no secrets, tokens, raw `.env`, or filesystem paths.

## Conventions

- **Docs sync** is required. Procedure: `.cursor/skills/docs-sync/`. End with **Docs touched:**.
- **Locks:** [docs/dev/agent-locks.md](docs/dev/agent-locks.md). Skills/agents index: [docs/dev/agent-skills.md](docs/dev/agent-skills.md).
- Domain seats: `.cursor/agents/` (mirrored to `.claude/agents/`). Launch when a slice sits in that domain.
- **Never commit unprompted.** Commit only on ship language — then `.cursor/skills/ship-ready/` (always pushes).
- Windows code signing is out of scope ([docs/runbooks/desktop-code-signing.md](docs/runbooks/desktop-code-signing.md)).

## Gotchas

- `.env` at the repo root is live local config — never overwrite it. Templates are `.env.example`, `.env.docker.example`, `.env.unraid.example`, `.env.nas.example`.
- Servers run via `startweb.sh` / `startweb_windows.cmd`, not by invoking `asgi.py` directly.
