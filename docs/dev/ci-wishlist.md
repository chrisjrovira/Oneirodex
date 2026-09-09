# CI wishlist

Changes the modernization tracks need in `.github/workflows/**`, applied by the
CI owner (Track D). Backend and frontend tracks do not edit the workflows
directly — they append a line here.

- [A0.4] Add a step to the `pytest-core` job: `python scripts/print_lint.py`
  (runs alongside `python scripts/api_envelope_lint.py`; no DB needed; fails
  only when a file's `print()` count exceeds its recorded baseline).
  ✅ applied (`pytest-core` job, step `Run print() ratchet`, immediately after
  `Run API envelope lint`).
- [A0.6] Switch the `pytest-core` job from the hand-listed test files to
  `pytest -m "not integration" --cov=oneirodex --cov-report=term-missing --cov-fail-under=20`.
  `pytest-cov` is pinned in `requirements-dev.txt`. The `integration` marker is
  declared in `pytest.ini`; heavy/thread/live-service modules carry a
  module-level `pytestmark = pytest.mark.integration`. The set of `integration`
  files is deliberately minimal — before flipping, diff `pytest -m "not
  integration" --collect-only -q` against the current hand list so nothing that
  was gated silently stops being gated. `--cov-fail-under` is a low
  current-reality floor, not a target; raise it as coverage climbs.
  ✅ applied (partial — `--cov=oneirodex --cov-report=term-missing` added to the
  existing hand-list run in `pytest-core`; **no full marker flip**). Collect-only
  measured on the worktree: `-m "not integration"` selects **4164 tests, only 10
  deselected** — a single file (`tests/test_background_workers.py`) carries the
  `integration` marker, so the marker set is essentially the whole `tests/` tree,
  not a core subset, and is not plausibly runnable inside the 20-min gate (nor
  does it respect the "needs Unraid-like fixtures / library paths" caveat in this
  workflow's header). Kept the hand-list and appended 9 previously-ungated
  ops/health/asgi files (`test_ops_path_problems`, `test_utils_ops_issues`,
  `test_utils_ops_network`, `test_library_health_pulse`, `test_health_igdb_provider`,
  `test_asgi_activity_sse`, `test_api_tokens_health_events`, `test_ops_followons`,
  `test_library_batch_ops`). `--cov-fail-under` omitted for now — set it once CI
  reports real coverage for this subset.
  **Update (A3.1 marker pass):** the `integration` marker now covers **32 files**
  (`test_background_workers` + 31 tagged in wave A3.1: the scan pipeline, external
  metadata/store provider adapters — IGDB / Steam / SteamGridDB / SMTP — and the
  worker/heartbeat/watch/LiveKit/cover-art-render modules). `-m "not integration"`
  now selects **3699 / 4174** (475 deselected, up from 10). None of the tagged
  files are in the `pytest-core` hand list, so nothing that was gated stopped
  being gated. A flip is now **closer to feasible** but still not done: 3699
  tests is far more than the current hand list (~1k) and this suite's cost is
  dominated by the per-test `app` fixture rebuilding Flask on the NAS, so a
  timing pass on CI hardware (empty Postgres, no NAS latency) is the remaining
  gate before switching `pytest-core` to the marker. Tag more modules from that
  timing data if the wall time is still over budget.
- [B0.2] Add a `lint` job on Node 22: run `npm ci` at the repo root, then
  `npm run lint && npm run format:check`. This runs ESLint (flat config at
  `eslint.config.js`) and Prettier `--check` over `frontend/**`. The repo root
  now has its own `package.json` / `package-lock.json` holding the shared
  eslint + prettier toolchain, so the job needs a root `npm ci` (not a per-app
  one).
  ✅ applied (new job `lint` / "Lint & format": root `npm ci`, then steps
  `Run ESLint` = `npm run lint` and `Run Prettier check` = `npm run format:check`;
  no `working-directory` override so it runs at the repo root).
- [B0.2] Desktop lint/format wiring is still owed: `clients/desktop` needs the
  Prettier baseline pass, `lint` / `format:check` scripts delegating to the
  repo root, and `clients/desktop/**/*.ts` added to `eslint.config.js`. This is
  the Desktop track's to land — it sits outside the frontend track's file
  scope.
  ✅ applied (wave C3.7-client). Prettier baseline landed as
  `chore(fmt): prettier baseline for clients/desktop` over `clients/desktop/src`
  + the tsconfig / vite / vitest configs. `lint` / `format:check` scripts added
  to `clients/desktop/package.json` (`npm --prefix ../.. run …`, same shape as
  `frontend/api-client`). `eslint.config.js` gains an appended
  `clients/desktop/**/*.{ts,tsx}` block (typescript-eslint recommended, mirrors
  the `frontend/api-client` block) and a `*.{test,spec}.ts` vitest-globals
  block; the global `ignores` entry `clients/**` was narrowed to
  `clients/quest/**` + `clients/desktop/src-tauri/**` so the desktop TS is
  actually reached. `npx eslint clients/desktop frontend/api-client` is clean
  (a stale `no-unused-vars` import in `apply_patch.ts` and a `prefer-const`
  error in `config-store.ts` fixed in the fmt commit). No new workflow job —
  the existing repo-root `lint` job (`npm run lint` = `eslint .`) now covers
  `clients/desktop/**/*.ts` via the config change; also bumped the two
  remaining `node-version: '20'` in `desktop-build.yml` and
  `setup_20.x` / "Node 20+" in `scripts/build-installers.sh` to `22`.
- [B0.3] Add `npm run typecheck` to each existing per-SPA vitest job
  (`member-app-vitest`, `admin-app-vitest`, and the new `ops-glance-vitest`
  job). Each SPA gains a `tsconfig.json` (extends repo-root
  `tsconfig.base.json`) and a `typecheck` script; `npm run build` also changes
  to `tsc --noEmit && vite build`.
  ✅ applied (`Typecheck` = `npm run typecheck` step added to `member-app-vitest`,
  `admin-app-vitest`, and `ops-glance-vitest`, after each job's `Run vitest`).
- [B0.3] `tsc` is NOT in the per-SPA `package.json` — it resolves from the
  repo-root `package.json` (`typescript` pinned there). So any CI job that runs
  `npm run typecheck` or `npm run build` for an SPA needs a repo-root
  `npm ci` step first (the same one the `lint` job needs). Alternative: add
  `typescript` to each SPA's own `devDependencies` and regenerate its
  `package-lock.json`.
  ✅ applied (step `Install repo-root toolchain (tsc)` = `npm ci` with an explicit
  `working-directory: .` added ahead of the per-app `npm ci` in all three SPA
  vitest jobs — those jobs set `defaults.run.working-directory` to the app dir,
  so the root install needs the override. Also covers `ops-glance`'s existing
  `Build ops-glance bundle` = `npm run build` step, which runs `tsc --noEmit`.)
- [A3.1] Add an `alembic` CI job: fresh Postgres service, `pip install -r
  requirements-dev.txt`, then `python -m alembic upgrade head` followed by
  `python -m alembic check`. The baseline is wired so `alembic check` is
  **clean** (a named `include_object` allow-list in `alembic/env.py` covers the
  ~20 pre-Alembic indexes not declared on the models (`oneirodex/models/`) —
  catalogued in
  `docs/dev/alembic-baseline-notes.md`), so this job can **fail hard** on any
  new diff. `TEST_DATABASE_URL` must contain `test` (conftest guard) — e.g.
  `postgresql://postgres:postgres@localhost:5432/oneirodextest`; `alembic`
  reads it via the same resolution the app uses. Runs independently of
  `pytest-core` (no app fixtures needed).
  ✅ applied (CI reconcile wave #2 — new job `alembic-check` / "Alembic (upgrade
  + check)". Mirrors `pytest-core`'s `postgres:16` service block + `env`
  (`TEST_DATABASE_URL` on `oneirodextest`, `SECRET_KEY`, `FLASK_ENV: testing`),
  Python 3.12, `pip install -r requirements-dev.txt`, then step `Alembic upgrade
  head` = `python -m alembic upgrade head` and step `Alembic check (fail hard on
  any diff)` = `python -m alembic check` — no `continue-on-error`, so a diff
  fails the gate. Comment points at `docs/dev/alembic-baseline-notes.md`.
  Verified on a scratch Postgres DB: `upgrade head` applied the baseline,
  `alembic check` → "No new upgrade operations detected.")
- [B1.1] npm workspaces landed on `chore/modz-fe-w1`. The repo root
  (`package.json` `workspaces` array) is now the single install point and
  `package-lock.json` at the root is the **only** lockfile — the per-app
  `frontend/member-app/package-lock.json`, `frontend/admin-app/...`,
  `frontend/ops-glance/...`, `frontend/api-client/...` and
  `clients/desktop/package-lock.json` are deleted. Every `ci-tests.yml` job that
  still names a per-app lockfile or runs a per-app `npm ci` needs updating:
  - `member-app-vitest`, `admin-app-vitest`, `ops-glance-vitest`: each has
    `actions/setup-node` with `cache-dependency-path: frontend/<app>/package-lock.json`
    (now gone) and two install steps — `Install repo-root toolchain (tsc)`
    (`npm ci`, `working-directory: .`) followed by `Install dependencies`
    (`npm ci` in the app dir, no override). Change: set
    `cache-dependency-path: package-lock.json`, keep the single root
    `npm ci` (`working-directory: .` — it now installs the whole workspace
    graph including the app), and **delete the second per-app `npm ci` step**.
    The `Run vitest` / `Typecheck` / `Build ops-glance bundle` steps keep their
    `defaults.run.working-directory: frontend/<app>` and run unchanged (or
    switch to `npm run <script> --workspace=<app>` from the root — either
    works). The `working-directory: .` steps that already exist
    (`Run classic theme JS harnesses`, `Run CSS token lint`) are unaffected.
  - `api-client-vitest`: `cache-dependency-path: frontend/api-client/package-lock.json`
    → `package-lock.json`; the `Install dependencies` step (`npm ci` under
    `defaults.run.working-directory: frontend/api-client`) must become a root
    `npm ci` (add `working-directory: .`). `Typecheck` (`npm run build`) and
    `Run vitest` (`npm test`) then run from the app dir as now, or via
    `--workspace=@oneirodex/api-client` from the root.
  - `desktop-vitest`: `cache-dependency-path: clients/desktop/package-lock.json`
    → `package-lock.json`; `Install dependencies` (`npm ci` under
    `defaults.run.working-directory: clients/desktop`) → root `npm ci`
    (`working-directory: .`). The `@oneirodex/api-client` dep is now `"*"`
    (workspace resolution) instead of a `file:` link, so the root install is
    what wires it. `Run fast desktop vitest slice` (`npx vitest run …`) runs
    unchanged from the app dir.
  - `lint` job: `cache-dependency-path: package-lock.json` and the plain
    `npm ci` are already correct — the root lock is now the only one. No change
    beyond confirming it still resolves (it will; same file, now workspace-aware).
  - Note for whoever applies this on a Windows/NAS checkout: npm workspace
    installs reify workspace packages as symlinks/junctions into
    `node_modules/`, which fail with `EPERM` on the SMB-mounted `Z:` worktree
    (both `fs.symlink` and junction). CI runners (Linux) and the Docker
    `frontend-build` stage (alpine) are unaffected. Local verification of this
    wave must run on a Linux checkout or in CI.
  - Optional follow-up (not required): the Docker `frontend-build` stage now
    runs one root `npm ci`, which also installs `clients/desktop`'s
    `@tauri-apps/cli` (a throwaway cost — that stage is discarded, only
    `oneirodex/static/dist/*` is copied forward). If build time there matters,
    scope it with
    `npm ci --workspace=member-app --workspace=admin-app --workspace=ops-glance --include-workspace-root`.
  ✅ applied (CI reconcile wave #2). Every JS job now caches on the repo-root
  `package-lock.json` and installs via a single `Install workspace (repo-root
  npm ci)` step with `working-directory: .`:
  - `member-app-vitest`, `admin-app-vitest`, `ops-glance-vitest`: the
    D-reconcile-1 `Install repo-root toolchain (tsc)` step is renamed to
    `Install workspace (repo-root npm ci)` (it now reifies the whole workspace
    graph); the redundant per-app `Install dependencies` `npm ci` step is
    deleted. `Run vitest` / `Typecheck` / `Build ops-glance bundle` keep
    `defaults.run.working-directory: frontend/<app>` and run unchanged (npm
    resolves up to the workspace root). The `working-directory: .` steps
    (`Run classic theme JS harnesses`, `Run CSS token lint`) are untouched.
  - `api-client-vitest`, `desktop-vitest`: the per-app `Install dependencies`
    `npm ci` becomes a root `Install workspace (repo-root npm ci)`
    (`working-directory: .`). `Typecheck` (`npm run build`), `Run vitest`
    (`npm test`) and `Run fast desktop vitest slice` (`npx vitest run <files>`)
    run unchanged from their app dir; the root install wires
    `clients/desktop`'s `"@oneirodex/api-client": "*"` workspace dep.
  - `lint` job: already `cache-dependency-path: package-lock.json` + root
    `npm ci` — confirmed, no change.
- [B1.2] `frontend/shared` (`@oneirodex/ui`) is now a real testable workspace:
  it has a `test` script (`vitest run`) and `vitest.config.js` (jsdom +
  `src/testSetup.js`), and the consolidated contract tests live in
  `frontend/shared/src/*.test.*` (`csrf`, `envelopeError`, `pageStatus`,
  `confirmDialog`, `toastStack`, `libraryScanNotify`, `loadingStatusText` — 8
  files / 55 tests as of this wave). No CI job runs them yet, so add one:
  `shared-vitest` (Node 22), `cache-dependency-path: package-lock.json`, one
  `Install workspace (repo-root npm ci)` step (`working-directory: .`), then
  `npm test --workspace=frontend/shared`. Its devDeps (`vitest`, `jsdom`,
  `@testing-library/react` + `jest-dom`, `@vitejs/plugin-react`, `react` /
  `react-dom`) are already in the root lock — the same versions the SPAs pin —
  so the root `npm ci` covers it. These tests are pure-logic + jsdom (no Flask,
  no DB), so the job is fast and can fail hard. The moved tests are no longer
  run by `member-app-vitest` / `admin-app-vitest`, so without this job the
  coverage drops.
