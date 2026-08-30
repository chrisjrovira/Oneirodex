# Release checklist (Oneirodex)

Use before tagging a release (example: **v0.1.0**).

## Version bump

- [ ] Root [`VERSION`](../../VERSION) matches intended semver
- [ ] [`CHANGELOG.md`](../../CHANGELOG.md) has a dated section for this release
- [ ] `clients/desktop/package.json`, `src-tauri/tauri.conf.json`, `Cargo.toml`
- [ ] `frontend/member-app`, `frontend/ops-glance`, `frontend/api-client` package versions
- [ ] `docker-compose.yml` image tag (`APP_IMAGE`, preferred Hub `chrisjrovira/oneirodex:X.Y.Z`; local default `oneirodex:1.0.0-beta`)
- [ ] Root `README.md` and `docs/README.md` version references

## CI (PR gate)

GitHub Actions [`.github/workflows/ci-tests.yml`](../../.github/workflows/ci-tests.yml) runs on PRs and pushes to `main` / `master` / `feature/**` (and similar):

- **Pytest core** (Python 3.12 + Postgres service): health probes, ASGI static, ops summary/routes, security suite, RBAC unit — not the full `tests/` tree.
- **Member-app vitest** (`frontend/member-app`): `npm ci` + `npm test -- --run`.
- **Desktop vitest** (`clients/desktop`): fast slice — `keychain` / `config-store` / `connection-ux`.

Full pytest remains **local / release** (see [local-postgres-pytest.md](local-postgres-pytest.md)). Confirm the core CI job is green before tagging; still run a broader local slice below.

Before image publish: rebuild SPA `static/dist` and grep against the private banned list — [scrub-shipped-bundles.md](scrub-shipped-bundles.md) (SCRUB-7).

## Verify

```bash
pytest tests/test_ops_followons.py tests/test_hardlinks_ai_vr_layouts.py tests/test_q1_foundation_unit.py -q
```

- [ ] CI `ci-tests` workflow green on the release PR / commit
- [ ] Docker build: `docker compose build`
- [ ] Fresh `.env` from `.env.docker.example` starts (`SECRET_KEY` set)

## Publish

- [ ] Commit + push release branch / PR to `main`
- [ ] Git tag `vX.Y.Z` and GitHub Release notes from CHANGELOG
- [ ] Push Docker image tags `:X.Y.Z` and `:latest` (when publishing images)
- [ ] Unraid / docs note if env vars changed
