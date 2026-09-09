# Release checklist (Oneirodex)

Use before tagging a release (example: **v0.1.0**).

## Version bump

- [ ] Root [`VERSION`](../../VERSION) matches intended semver
- [ ] [`CHANGELOG.md`](../../CHANGELOG.md) has a dated section for this release
- [ ] `clients/desktop/package.json`, `src-tauri/tauri.conf.json`, **`src-tauri/tauri.thin.conf.json`**, `Cargo.toml` **and `Cargo.lock`** (the lock records the crate's own version; a stale one breaks `--locked` builds)
- [ ] `frontend/member-app`, `frontend/ops-glance`, `frontend/api-client` package versions **and their lockfiles**
- [ ] Desktop `client_version` needs no edit — it is injected from `package.json` at build time (`__APP_VERSION__`)
- [ ] Leaving pre-release (`X.Y.Z-beta` → `X.Y.Z`)? Add `msi` and `rpm` back to `bundle.targets` in both Tauri configs — they are excluded only because pre-release versions break those two bundlers ([desktop-code-signing.md](desktop-code-signing.md))
- [ ] `docker-compose.yml` image tag (`APP_IMAGE`, preferred Hub `chrisjrovira/oneirodex:X.Y.Z`; local default `oneirodex:1.0.0-beta`)
- [ ] Root `README.md` and `docs/README.md` version references

## CI (PR gate)

GitHub Actions [`.github/workflows/ci-tests.yml`](../../.github/workflows/ci-tests.yml) runs on PRs and pushes to `main` / `master` / `feature/**` (and similar). Toolchain is pinned: Python **3.12** (`.python-version`) and Node **22** (`.nvmrc`, `engines: ">=22 <23"` in every `package.json`).

- **Pytest core** (Python 3.12 + Postgres service): health probes, ASGI static, ops summary/routes, security suite, RBAC unit — not the full `tests/` tree. Hand-listed subset (not the `-m "not integration"` marker — that set is currently the whole tree). Also runs `--cov=oneirodex --cov-report=term-missing` (report only, no `--cov-fail-under` yet), the API envelope lint, and the `print()` ratchet (`scripts/print_lint.py`).
- **Lint & format** (repo root, Node 22): root `npm ci`, then `npm run lint` (ESLint flat config `eslint.config.js`) + `npm run format:check` (Prettier over `frontend/**`).
- **Member-app vitest** (`frontend/member-app`): `npm ci` + `npm test -- --run` + `npm run typecheck`.
- **Admin-app vitest** (`frontend/admin-app`): `npm test -- --run` + `npm run typecheck`, plus classic theme JS harnesses and CSS token lint.
- **Ops-glance vitest** (`frontend/ops-glance`): `npm test -- --run` + `npm run typecheck` **and `npm run build`** — the glance ships in the Docker image, so a broken bundle fails the gate.
- **API client vitest** (`frontend/api-client`): typecheck (`npm run build`) + `npm test`.
- **Desktop vitest** (`clients/desktop`): fast slice — `keychain` / `config-store` / `connection-ux`.

The three SPA vitest jobs and `Lint & format` each run a repo-root `npm ci` for the shared `typescript` / `eslint` / `prettier` toolchain (pinned in the root `package.json`); the SPA jobs do it with an explicit `working-directory: .` ahead of their per-app `npm ci`.

Dependency bumps arrive weekly via Dependabot ([`.github/dependabot.yml`](../../.github/dependabot.yml)) — `pip`, `npm` per app, and `github-actions`, with minor/patch grouped into one PR per ecosystem.

Full pytest remains **local / release** (see [local-postgres-pytest.md](local-postgres-pytest.md)). Confirm the core CI job is green before tagging; still run a broader local slice below.

Before image publish: rebuild SPA `static/dist` and grep against the private banned list — [scrub-shipped-bundles.md](scrub-shipped-bundles.md) (SCRUB-7).

## Verify

```bash
pytest tests/test_ops_followons.py tests/test_hardlinks_ai_vr_layouts.py tests/test_q1_foundation_unit.py -q
```

- [ ] CI `ci-tests` workflow green on the release PR / commit
- [ ] CI `desktop-build` green — six unsigned artifacts (full + thin × Windows / macOS / Linux); the upload fails the job if bundling produced nothing
- [ ] Docker build: `docker compose build`
- [ ] Fresh `.env` from `.env.docker.example` starts (`SECRET_KEY` set)
- [ ] Schema: `python -m alembic upgrade head` runs clean on a fresh DB and `python -m alembic check` reports no new operations (allow-list in [`docs/dev/alembic-baseline-notes.md`](../dev/alembic-baseline-notes.md))

## Schema migrations (Alembic)

Since modernization wave A3.1 ([ADR 0004](../adr/0004-adopt-alembic.md)) the schema
is owned by Alembic. `oneirodex/updateschema.py` is **frozen** — new schema
change means `python -m alembic revision --autogenerate -m "..."`, reviewed by
hand, committed under `alembic/versions/`.

Operator upgrade path is unchanged in practice: pull image → `compose up` →
`init_manager` Phase 2 builds/updates the schema and, on the first boot after
this release, runs a one-time `alembic stamp head` for databases that predate
Alembic (logged as `Stamped existing schema at Alembic baseline`). No operator
action, no `alembic` command to run by hand. `/readyz` green as before.

## Publish

- [ ] Commit + push release branch / PR to `main`
- [ ] Git tag `vX.Y.Z` and GitHub Release notes from CHANGELOG
- [ ] Push Docker image tags `:X.Y.Z` and `:latest` (when publishing images)
- [ ] Unraid / docs note if env vars changed
