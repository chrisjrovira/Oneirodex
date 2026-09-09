# CI wishlist

Changes the modernization tracks need in `.github/workflows/**`, which the
frontend track (`chore/modz-frontend`) does not edit. Whoever owns CI picks
these up.

- [B0.2] Add a `lint` job on Node 22: run `npm ci` at the repo root, then
  `npm run lint && npm run format:check`. This runs ESLint (flat config at
  `eslint.config.js`) and Prettier `--check` over `frontend/**`. The repo root
  now has its own `package.json` / `package-lock.json` holding the shared
  eslint + prettier toolchain, so the job needs a root `npm ci` (not a per-app
  one).
- [B0.2] Desktop lint/format wiring is still owed: `clients/desktop` needs the
  Prettier baseline pass, `lint` / `format:check` scripts delegating to the
  repo root, and `clients/desktop/**/*.ts` added to `eslint.config.js`. This is
  the Desktop track's to land — it sits outside the frontend track's file
  scope.
- [B0.3] Add `npm run typecheck` to each existing per-SPA vitest job
  (`member-app-vitest`, `admin-app-vitest`, and an `ops-glance` job if one is
  added). Each SPA gains a `tsconfig.json` (extends repo-root
  `tsconfig.base.json`) and a `typecheck` script; `npm run build` also changes
  to `tsc --noEmit && vite build`.
- [B0.3] `tsc` is NOT in the per-SPA `package.json` — it resolves from the
  repo-root `package.json` (`typescript` pinned there). So any CI job that runs
  `npm run typecheck` or `npm run build` for an SPA needs a repo-root
  `npm ci` step first (the same one the `lint` job needs). Alternative: add
  `typescript` to each SPA's own `devDependencies` and regenerate its
  `package-lock.json`.
