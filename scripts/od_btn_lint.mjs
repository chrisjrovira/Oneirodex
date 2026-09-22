#!/usr/bin/env node
/**
 * Raw-`<button className="od-btn…">` ratchet for the React SPAs.
 *
 * `@oneirodex/ui` exports `<Button>` so a call site names intent (`variant`,
 * `size`, `pill`) instead of spelling theme classes, and `buttonLanguage`
 * stays checkable in one place. A hundred sites were moved onto it in one
 * pass (v11 cycle, H-D.1); what is left is the dynamic-className tail and
 * anything new. This script records the per-file count of raw sites and
 * fails when a file gains one. Same model as any_lint / print_lint:
 *
 *   node scripts/od_btn_lint.mjs            # fail on any file above its baseline
 *   node scripts/od_btn_lint.mjs --update   # re-record after a genuine reduction
 *
 * Counted (non-test .tsx sources only): a `<button` opening tag whose
 * `className` — string literal, template literal or expression — mentions
 * the base class `od-btn` as a whole token. `<a className="od-btn">` links are
 * not buttons and are not counted; `.od-btn-bar` and a lone `od-btn--sm` on an
 * `.od-cbtn` are not the base class and are not counted either.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'od_btn_lint.baseline.json')

const SCAN_ROOTS = [
  'frontend/member-app/src',
  'frontend/admin-app/src',
  'frontend/ops-glance/src',
  'frontend/shared/src',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '.git'])

// A `<button` tag up to its `>`, then a className whose value carries the base
// class `od-btn` as a whole token. `od-btn--sm` on its own is not a hit: the
// `.od-cbtn` (context-bar) family borrows the size modifier without being a
// `.od-btn`, and those are not <Button> candidates.
const TAG_RE = /<button\b[^>]*?>/gs
const CLASS_RE = /className=(?:"[^"]*"|'[^']*'|\{[^}]*\})/s
const ODBTN_RE = /(?<![\w-])od-btn(?=["'`\s}$])/

function isSource(entry) {
  if (!entry.endsWith('.tsx')) return false
  if (entry.includes('.test.') || entry.includes('.spec.')) return false
  if (entry === 'Button.tsx') return false // the primitive's own <button>
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

export function lintSource(source) {
  let count = 0
  for (const tag of source.matchAll(TAG_RE)) {
    const cls = CLASS_RE.exec(tag[0])
    if (cls && ODBTN_RE.test(cls[0])) count++
  }
  return count
}

function toRelPath(full) {
  return relative(REPO_ROOT, full).split(sep).join('/')
}

export function runLint() {
  const counts = {}
  for (const root of SCAN_ROOTS) {
    for (const full of collect(join(REPO_ROOT, root))) {
      const n = lintSource(readFileSync(full, 'utf8'))
      if (n) counts[toRelPath(full)] = n
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
    const allowed = baseline[file] ?? 0
    if (count > allowed) regressions.push({ file, count, allowed })
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    const count = counts[file] ?? 0
    if (count < allowed) improvements.push({ file, count, allowed })
  }
  return { regressions, improvements }
}

function total(counts) {
  return Object.values(counts).reduce((n, c) => n + c, 0)
}

function main() {
  const update = process.argv.includes('--update')
  const counts = runLint()
  if (update) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n')
    console.log(
      `od-btn-lint: recorded ${total(counts)} raw <button className="od-btn"> sites across ${Object.keys(counts).length} files.`,
    )
    return
  }
  const baseline = readBaseline()
  const { regressions, improvements } = compareToBaseline(counts, baseline)
  if (regressions.length) {
    console.error(
      'od-btn-lint: raw od-btn <button> sites above baseline — use <Button> from @oneirodex/ui:',
    )
    for (const r of regressions) console.error(`  ${r.file}: ${r.count} (baseline ${r.allowed})`)
    process.exit(1)
  }
  const note = improvements.length
    ? `, ${improvements.length} file(s) below baseline.\n  Baseline can be tightened: node scripts/od_btn_lint.mjs --update`
    : ', none new.'
  console.log(`od-btn-lint: OK (${total(baseline)} known raw sites${note})`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
