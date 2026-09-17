#!/usr/bin/env node
/**
 * Explicit-`any` ratchet for the TypeScript workspaces.
 *
 * Every SPA is `strict: true`, but strictness is only as real as the `any`
 * count: an `any` switches the checker off for everything it touches. The
 * member-app conversion (PR #77) got through `tsc` by annotating ~878 sites
 * `: any` and turning `@typescript-eslint/no-explicit-any` off; admin-app
 * (PR #74) has ~36. This script records the per-file count and fails when a
 * file gains one. Same model as css-token-lint / print_lint / get_json_lint:
 *
 *   node scripts/any_lint.mjs            # fail on any file above its baseline
 *   node scripts/any_lint.mjs --update   # re-record after a genuine reduction
 *
 * Counted (per line, non-test sources only):
 *   `: any` — a parameter, property, or variable annotation
 *   `<any>` — a generic argument (`useState<any>`, `request<any>`)
 *   `as any` — a cast
 *
 * Deliberately *not* counted: `unknown` (that is the fix), and `any` inside
 * comments or string literals on lines that carry no code use. The regex is
 * line-based on purpose — the point is a stable count that only moves down,
 * not a type-checker.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'any_lint.baseline.json')

const SCAN_ROOTS = [
  'frontend/member-app/src',
  'frontend/admin-app/src',
  'frontend/ops-glance/src',
  'frontend/shared/src',
  'frontend/api-client/src',
  'clients/desktop/src',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '__pycache__', '.git', 'src-tauri'])

// One pattern per shape so the report can say which kind grew.
const RULES = {
  'any-annotation': /:\s*any\b/g, // `: any` — the \b stops `: anything`
  'any-generic': /<\s*any\s*>/g,
  'any-cast': /\bas\s+any\b/g,
}

function isSource(entry) {
  if (!(entry.endsWith('.ts') || entry.endsWith('.tsx'))) return false
  if (entry.endsWith('.d.ts')) return false
  if (entry.includes('.test.') || entry.includes('.spec.')) return false
  return true
}

function collect(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out // a workspace may not be checked out everywhere
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) collect(full, out)
    else if (isSource(entry)) out.push(full)
  }
  return out
}

function stripComments(line) {
  // Good enough for a count: drop `// …` and one-line `/* … */`.
  return line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
}

export function lintSource(source) {
  const counts = {}
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const code = stripComments(lines[i])
    if (!code.includes('any')) continue
    for (const [rule, re] of Object.entries(RULES)) {
      re.lastIndex = 0
      const hits = code.match(re)
      if (hits) counts[rule] = (counts[rule] || 0) + hits.length
    }
  }
  return counts
}

function toRelPath(full) {
  return relative(REPO_ROOT, full).split(sep).join('/')
}

export function runLint() {
  const counts = {}
  for (const root of SCAN_ROOTS) {
    for (const full of collect(join(REPO_ROOT, root))) {
      const fileCounts = lintSource(readFileSync(full, 'utf8'))
      if (Object.keys(fileCounts).length) counts[toRelPath(full)] = fileCounts
    }
  }
  return counts
}

export function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export function compareToBaseline(counts, baseline) {
  const regressions = []
  const improvements = []
  for (const [file, rules] of Object.entries(counts)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = baseline[file]?.[rule] ?? 0
      if (count > allowed) regressions.push({ file, rule, count, allowed })
    }
  }
  for (const [file, rules] of Object.entries(baseline)) {
    for (const [rule, allowed] of Object.entries(rules)) {
      const count = counts[file]?.[rule] ?? 0
      if (count < allowed) improvements.push({ file, rule, count, allowed })
    }
  }
  return { regressions, improvements }
}

function total(counts) {
  let n = 0
  for (const rules of Object.values(counts)) for (const c of Object.values(rules)) n += c
  return n
}

function main() {
  const counts = runLint()

  if (process.argv.includes('--update')) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
    console.log(`any-lint: recorded ${total(sorted)} explicit any sites across ${Object.keys(sorted).length} files.`)
    return
  }

  const baseline = readBaseline()
  const { regressions, improvements } = compareToBaseline(counts, baseline)

  if (regressions.length) {
    console.error('any-lint: files with new explicit `any` sites\n')
    for (const r of regressions) {
      console.error(`  ${r.file}  ${r.rule}: ${r.count} > ${r.allowed} allowed`)
    }
    console.error('\n  Type it (`unknown` + a narrowing, or the real shape) instead of widening the baseline.')
    console.error('  A genuine reduction elsewhere re-records with: node scripts/any_lint.mjs --update')
    process.exitCode = 1
    return
  }

  const n = total(counts)
  if (improvements.length) {
    console.log(`any-lint: OK (${n} known any sites, ${improvements.length} file(s) below baseline).`)
    console.log('  Baseline can be tightened: node scripts/any_lint.mjs --update')
  } else {
    console.log(`any-lint: OK (${n} known any sites, none new).`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
