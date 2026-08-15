import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

/**
 * Every import that escapes its app directory must be staged in the Dockerfile.
 *
 * The image builds each SPA in isolation — `COPY frontend/<app>/ .` and nothing
 * else — so an import reaching outside that directory resolves fine locally and
 * fails only inside `docker build`. That is the worst possible place to find
 * out: the whole test suite passes, both Vite builds pass, and the stack falls
 * over on deploy.
 *
 * It has happened twice. admin-app reaching for the theme's stageECandidates.js
 * is handled by an explicit COPY (see the comment above it in the Dockerfile),
 * and GT-B2's shared useRailState broke the member-app build exactly this way
 * before its own COPY was added.
 *
 * Test files are excluded on purpose: vitest never runs in the image, so a test
 * reaching into the repo is not a packaging concern.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../..')
const DOCKERFILE = join(REPO_ROOT, 'Dockerfile')

const APPS = ['frontend/member-app', 'frontend/admin-app', 'frontend/ops-glance']
const SKIP_DIRS = new Set(['node_modules', 'dist', '__pycache__', '.git'])

function sourceFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(jsx?|tsx?)$/.test(entry) && !/\.test\.|testSetup\./.test(entry)) out.push(full)
  }
  return out
}

/** Relative specifiers only — bare package names are npm's problem, not ours. */
function relativeImports(source) {
  const specs = []
  for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
    specs.push(m[1])
  }
  return specs
}

function escapingImports() {
  const escapes = []

  for (const app of APPS) {
    const appRoot = join(REPO_ROOT, app)
    for (const file of sourceFiles(appRoot)) {
      for (const spec of relativeImports(readFileSync(file, 'utf8'))) {
        const target = resolve(dirname(file), spec)
        if (target.startsWith(appRoot + sep)) continue
        escapes.push({
          app,
          from: relative(REPO_ROOT, file).split(sep).join('/'),
          target: relative(REPO_ROOT, target).split(sep).join('/'),
        })
      }
    }
  }

  return escapes
}

test('imports escaping an app directory are staged in the Dockerfile', () => {
  const dockerfile = readFileSync(DOCKERFILE, 'utf8')
  // COPY sources, as written. A staged path is a prefix match: `COPY
  // frontend/shared/ ...` covers frontend/shared/useRailState.js.
  const copied = [...dockerfile.matchAll(/^\s*COPY\s+(?!--from)(.+)$/gm)]
    .flatMap((m) => m[1].trim().split(/\s+/).slice(0, -1))
    .map((p) => p.replace(/\/$/, ''))

  const unstaged = escapingImports()
    .filter(({ target }) => !copied.some((c) => target === c || target.startsWith(`${c}/`)))
    .map(({ from, target }) => `${from} imports ${target}, which no COPY stages`)

  expect([...new Set(unstaged)]).toEqual([])
})

test('the guard actually sees the known escapes', () => {
  // A guard that silently matches nothing passes forever. These are the real
  // cross-directory imports; if both disappear, delete this test with them
  // rather than leaving it asserting a truth about nothing.
  const targets = escapingImports().map((e) => e.target)

  expect(targets.some((t) => t.startsWith('frontend/shared/'))).toBe(true)
})
