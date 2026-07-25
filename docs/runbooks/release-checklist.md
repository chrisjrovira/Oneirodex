# Release checklist (GameTheca)

Use before tagging a release (example: **v0.1.0**).

## Version bump

- [ ] Root [`VERSION`](../../VERSION) matches intended semver
- [ ] [`CHANGELOG.md`](../../CHANGELOG.md) has a dated section for this release
- [ ] `clients/desktop/package.json`, `src-tauri/tauri.conf.json`, `Cargo.toml`
- [ ] `frontend/member-app`, `frontend/ops-glance`, `frontend/api-client` package versions
- [ ] `docker-compose.yml` image tag (`chrisjrovira/gametheca:X.Y.Z`)
- [ ] Root `README.md` and `docs/README.md` version references

## Verify

```bash
pytest tests/test_ops_followons.py tests/test_hardlinks_ai_vr_layouts.py tests/test_q1_foundation_unit.py -q
```

- [ ] Docker build: `docker compose build`
- [ ] Fresh `.env` from `.env.docker.example` starts (`SECRET_KEY` set)

## Publish

- [ ] Commit + push release branch / PR to `main`
- [ ] Git tag `vX.Y.Z` and GitHub Release notes from CHANGELOG
- [ ] Push Docker image tags `:X.Y.Z` and `:latest` (when publishing images)
- [ ] Unraid / docs note if env vars changed
