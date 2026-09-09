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
  added). Each SPA gains a `tsconfig.json` and a `typecheck` script in B0.3;
  `npm run build` also changes to `tsc --noEmit && vite build`, so the build
  step in those jobs already covers typecheck once B0.3 lands — an explicit
  `typecheck` step is only needed for jobs that do not run `build`.
