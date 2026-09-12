# Contributing

Public product name is **Oneirodex**. Defaults that are already decided live in [docs/dev/agent-locks.md](docs/dev/agent-locks.md) — do not re-ask them.

## Repo layout

| Path | What |
|---|---|
| `oneirodex/` | Flask app |
| `frontend/member-app` | Household SPA |
| `frontend/admin-app` | Admin SPA |
| `frontend/ops-glance` | Ops widgets |
| `frontend/api-client` | `@oneirodex/api-client` |
| `frontend/shared` | `@oneirodex/ui` |
| `clients/desktop` | Tauri companion |
| `tests/` | pytest |
| `docs/` | [index](docs/README.md) |

## Commands

```bash
# Frontend (from a SPA directory, or via the repo-root workspace)
npm test -- --run          # vitest
npm run typecheck

# Python — DB name must contain `test`
python -m pytest tests/test_whatever.py
```

Full-tree pytest is **not** all-green today; CI `core` is the gate. See [test-harness-2026-09-10.md](docs/dev/test-harness-2026-09-10.md). Do not claim 4150 passing.

## API changes

- JSON replies: `api_ok` / `api_error`. Do not shrink the envelope keep-list.
- New JSON POST/PUT/PATCH bodies: `@validate_body` on a model in `oneirodex/schemas/` — [pydantic-adoption.md](docs/dev/pydantic-adoption.md). Never batch a file. Partial-success batch routes use `@validate_batch_body` (keeps `updated`/`skipped`/`errors`/`limit` on the 422). Do not wrap those with the flat 422 helper.
- SPA `src/api/` wrappers go through `createBrowserRequester` (member `client.ts`, admin `adminApi.ts`). Do not hand-roll `fetch` + CSRF. Vitest mocks need `content-type: application/json` and `.text()`.

## Identifiers

`ONEIRODEX_*` env only. Do not restore `GT_*` fallbacks. Do not invent `OD_*` env aliases. Token prefix on the wire stays `gt_`. `LEGACY_NAME` is read-only for old theme files.

## Scrub

No Class A / warez-adjacent brand names in diffs, docs, UI copy, or commit messages. Capability language for non-goals. [scrub-shipped-bundles.md](docs/runbooks/scrub-shipped-bundles.md).
