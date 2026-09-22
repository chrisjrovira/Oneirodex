#!/usr/bin/env node
/**
 * Component-size ratchet for the React SPAs.
 *
 * Fourteen components sat between 640 and 1,283 lines for two programs
 * ("rename + type now, decompose later"). The v11 cycle (H-D.2) decomposed
 * them; this keeps them decomposed. A non-test `.tsx` under the scan roots
 * may not exceed THRESHOLD lines unless the baseline already allows it, and
 * a baselined file may not grow. Same model as any_lint / od_btn_lint:
 *
 *   node scripts/component_size_lint.mjs            # fail on any file above threshold / its baseline
 *   node scripts/component_size_lint.mjs --update   # re-record after a genuine reduction
 *
 * The count is physical lines, which is deliberately crude: the point is a
 * number that only moves down, not a complexity metric.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'component_size_lint.baseline.json')
export const THRESHOLD = 600

const SCAN_ROOTS = [
  'frontend/member-app/src',
  'frontend/admin-app/src',
  'frontend/ops-glance/src',
  'frontend/shared/src',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '.git'])

function isSource(entry) {
  if (!entry.endsWith('.tsx')) return false
  if (entry.includes('.test.') || entry.includes('.spec.')) return false
  return true
}

function collect(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
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

export function lineCount(source) {
  const n = source.split('\n').length
  return source.endsWith('\n') ? n - 1 : n
}

function toRelPath(full) {
  return relative(REPO_ROOT, full).split(sep).join('/')
}

export function runLint() {
  const counts = {}
  for (const root of SCAN_ROOTS) {
    for (const full of collect(join(REPO_ROOT, root))) {
      const n = lineCount(readFileSync(full, 'utf8'))
      if (n > THRESHOLD) counts[toRelPath(full)] = n
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
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? THRESHOLD
    if (count > allowed) regressions.push({ file, count, allowed })
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    const count = counts[file] ?? 0
    if (count < allowed) improvements.push({ file, count, allowed })
  }
  return { regressions, improvements }
}

function main() {
  const update = process.argv.includes('--update')
  const counts = runLint()
  if (update) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n')
    console.log(
      `component-size-lint: recorded ${Object.keys(counts).length} component(s) over ${THRESHOLD} lines.`,
    )
    return
  }
  const baseline = readBaseline()
  const { regressions, improvements } = compareToBaseline(counts, baseline)
  if (regressions.length) {
    console.error(
      `component-size-lint: components over ${THRESHOLD} lines (or above their baseline) — split by responsibility, see docs/superpowers/plans/2026-09-18-v11-cycle.md H-D.2:`,
    )
    for (const r of regressions) console.error(`  ${r.file}: ${r.count} (allowed ${r.allowed})`)
    process.exit(1)
  }
  const note = improvements.length
    ? `, ${improvements.length} file(s) below baseline.\n  Baseline can be tightened: node scripts/component_size_lint.mjs --update`
    : ', none new.'
  console.log(
    `component-size-lint: OK (${Object.keys(baseline).length} known file(s) over ${THRESHOLD}${note})`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
