import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

/**
 * No component class may be defined in more than one stylesheet (GT-A4).
 *
 * `.gt-btn--ghost` was defined three times — HelpPage.css, NewsPage.css and
 * NotificationsPage.css — as near-identical copy-paste. That is not only
 * duplication: with `cssCodeSplit: true` those land in separate route chunks,
 * so which definition applied depended on which pages the user had already
 * visited. The same button could render differently depending on navigation
 * history, and PcCheatsPanel used the class while defining it nowhere, so it
 * inherited whatever happened to be loaded.
 *
 * `.gt-btn`, `--primary` and `--secondary` had the same problem across
 * glass.css and admin-app's styles.css, which defined `.gt-btn` twice in a
 * single file with different values.
 *
 * The guard is structural rather than visual because that is what actually
 * fails: two blocks can look identical today and drift next week.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '../../..')

/**
 * Scoped per tree, not repo-wide.
 *
 * Duplication *across* these trees is deliberate architecture and must not
 * fail: gt-bootstrap-bridge.css exists precisely to re-declare `.btn-*`, and
 * several Jinja stylesheets intentionally mirror a React component's classes so
 * the server-rendered version of a modal looks right before the SPA mounts
 * (.gt-scan-conflict__*, .ops-*). A repo-wide rule flags 155 of those.
 *
 * Within one tree there is no such excuse, and that is also where the damage
 * is: `cssCodeSplit` puts each page's CSS in its own chunk, so two definitions
 * in one app resolve by load order — i.e. by the user's navigation history.
 */
const SCAN_ROOTS = [
  'frontend/member-app/src',
  'frontend/admin-app/src',
  'frontend/ops-glance/src',
]

/**
 * The Jinja theme tree gets a ratchet instead of a hard rule.
 *
 * It carries 94 intra-tree duplicates: per-page admin stylesheets that each
 * redefine .card, .alert, .btn-circle and friends on top of the shared
 * admin-components.css. That is the same disease, but it predates the design
 * system by a long way and is not something a single change can unwind. A count
 * that may only fall keeps it from getting worse while the migration proceeds.
 */
const THEME_ROOT = 'gametheca/setup/default_theme/css'
const THEME_DUPLICATE_BUDGET = 85

/**
 * Files whose job *is* to redeclare selectors owned elsewhere.
 *
 * gt-bootstrap-bridge repoints Bootstrap's `.btn-*` at the GT scales, and
 * gt-density gives `.gt-btn` / `.card` / `.form-control` density-aware metrics
 * without either primitive file needing to know densities exist. gt-era loads
 * after member-app.css (base_empty.html) so decade rooms can show through
 * opaque shell fills — and so a handful of grid/chrome rules can beat the SPA
 * bundle without a rebuild. Counting those files conflates a deliberate
 * cascade layer with the thing this budget exists to catch — a per-page
 * stylesheet quietly reinventing a shared component.
 *
 * Excluding them is not a loophole: a layer that stopped overriding anything
 * would have no reason to exist, whereas admin_dashboard.css redefining `.card`
 * is a defect either way. Adding a file here is a claim that it is a layer, and
 * should be as hard to justify as adding to ALLOWED above.
 */
const OVERRIDE_LAYERS = [
  'gt-bootstrap-bridge.css',
  'gt-density.css',
  'gt-shell.css',
  'gt-era.css',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '__pycache__', '.git'])

/**
 * Classes that legitimately appear in more than one file, with the reason.
 *
 * Every entry here is a claim that the second definition is an intentional
 * override rather than a competing base. Do not add to this list to silence a
 * failure — move the rule into one owning stylesheet instead.
 */
const ALLOWED = new Map([
  ['.gt-chat-layout', 'mobile-density.css owns the responsive override'],
  ['.gt-help__sections', 'MorePage reuses the Help section grid'],
  ['.library-layout', 'systemBackdrop.css layers the backdrop onto the filter layout'],
])

function cssFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) cssFiles(full, out)
    else if (entry.endsWith('.css')) out.push(full)
  }
  return out
}

/** Class selectors that start a rule at column 0, i.e. base definitions. */
function definedClasses(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const names = new Set()
  for (const m of withoutComments.matchAll(/^(\.[a-zA-Z][a-zA-Z0-9_-]*)(?=[\s,{:])/gm)) {
    names.add(m[1])
  }
  return names
}

/** Map of class name -> files defining it, for one tree. */
function ownersIn(root) {
  const owners = new Map()
  for (const file of cssFiles(join(REPO_ROOT, root))) {
    const rel = relative(REPO_ROOT, file).split(sep).join('/')
    for (const name of definedClasses(readFileSync(file, 'utf8'))) {
      if (!owners.has(name)) owners.set(name, [])
      owners.get(name).push(rel)
    }
  }
  return owners
}

test.each(SCAN_ROOTS)('no class is defined in two stylesheets within %s', (root) => {
  const offenders = [...ownersIn(root).entries()]
    .filter(([name, files]) => files.length > 1 && !ALLOWED.has(name))
    .map(([name, files]) => `${name} defined in ${files.join(', ')}`)
    .sort()

  expect(offenders).toEqual([])
})

test('the Jinja theme tree does not gain new duplicate definitions', () => {
  const duplicated = [...ownersIn(THEME_ROOT).values()]
    .map((files) => files.filter((f) => !OVERRIDE_LAYERS.some((l) => f.endsWith(l))))
    .filter((files) => files.length > 1)

  // Strictly less-than-or-equal: if this drops, lower the budget in the same
  // commit so the ratchet keeps tightening.
  expect(duplicated.length).toBeLessThanOrEqual(THEME_DUPLICATE_BUDGET)
})

test('the allowlist has no stale entries', () => {
  const duplicated = new Set()
  for (const root of SCAN_ROOTS) {
    for (const [name, files] of ownersIn(root)) {
      if (files.length > 1) duplicated.add(name)
    }
  }

  // An allowlisted class that is no longer duplicated means the conflict was
  // resolved and the exemption should be deleted along with its rationale.
  const stale = [...ALLOWED.keys()].filter((name) => !duplicated.has(name))

  expect(stale).toEqual([])
})
