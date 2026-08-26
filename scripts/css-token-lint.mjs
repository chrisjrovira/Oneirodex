#!/usr/bin/env node
/**
 * Design-token lint for GameTheca CSS.
 *
 * The design system in `gt-tokens.css` was not being used: the type scale had 9
 * call sites against 40+ ad-hoc font sizes, and the radius scale had 1. Nothing
 * stopped a new stylesheet from inventing `font-size: 0.78rem` next to an
 * existing `0.8rem`, so "inconsistent across pages" was the guaranteed outcome
 * rather than an accident.
 *
 * The rule this encodes is a single line:
 *
 *     *defining* a token may use a literal; *using* a value must go through one.
 *
 * So `--btn-primary: #2fd67b` is fine and `color: #2fd67b` is not. That keeps
 * the palette editable in one place without needing a per-file exemption list.
 *
 * Existing violations are recorded in `css-token-lint.baseline.json` and are not
 * errors — this is a ratchet, not a cleanup mandate. A file may never exceed its
 * recorded count, and a file with no record may have none at all. Fix as you
 * touch; `--update` re-records after a genuine reduction.
 *
 *   node scripts/css-token-lint.mjs            # check (exit 1 on regression)
 *   node scripts/css-token-lint.mjs --update   # re-record the baseline
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'css-token-lint.baseline.json')

/** Trees that must obey the token scales. */
const SCAN_ROOTS = [
  'gametheca/setup/default_theme/css',
  'frontend/member-app/src',
  'frontend/admin-app/src',
  'frontend/ops-glance/src',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '__pycache__', '.git'])

/**
 * Radius literals that carry meaning the scale cannot express. `50%` and the
 * pill value have tokens (`--gt-radius-circle` / `--gt-radius-pill`), so they
 * are still reported; `0` genuinely means "no radius" and is not a scale value.
 */
const ALLOWED_RADIUS_LITERALS = new Set(['0', 'inherit', 'initial', 'unset', 'revert'])

/** `font-size` values that are not a point on the type scale. */
const ALLOWED_FONT_SIZE_LITERALS = new Set(['inherit', 'initial', 'unset', 'revert', 'smaller', 'larger'])

const RULES = {
  'no-raw-color': 'hex literal outside a custom-property definition — use var(--gt-*)',
  'no-raw-radius': 'border-radius literal — use var(--gt-radius-*)',
  'no-raw-font-size': 'font-size literal — use var(--gt-font-*)',
  'no-raw-inline-style': 'literal in a JSX inline style — use var(--gt-*)',
}

/**
 * JSX inline styles were invisible to this lint (GT-B36).
 *
 * The rule this file encodes is that using a value must go through a token,
 * but for its whole life it only ever read .css files. A style object written
 * inline in a component was therefore a raw literal the ratchet could not see,
 * and the report kept saying none new while they accumulated. There were 19
 * across the two SPAs when this was added, almost all of them spacing.
 *
 * Only literal values count. A style built from data, where the value is an
 * identifier rather than a quoted literal, is not a design-token decision and
 * is skipped -- which is why the pattern below requires the quotes.
 *
 * Kept deliberately free of backticks and inline code samples: a richer version
 * of this comment made vitest fail to parse the module with a SyntaxError while
 * node and esbuild both accepted it, so something in vite transform pipeline
 * mis-lexes certain comment content in a file that also uses template literals.
 * Bisected to this comment, not to the code below it. Prose only here.
 */
const JSX_STYLE_BLOCK = new RegExp(String.raw`style=\{\{([\s\S]*?)\}\}`, 'g')
// Built with `new RegExp` rather than a literal on purpose. As a regex literal
// starting a line, vite's module lexer read the leading `/` as division and
// then took the `'` inside this character class as the start of a string,
// swallowing the rest of the file — so `vitest` failed to parse a module that
// node and esbuild both accepted. A constructed RegExp has no such ambiguity.
const JSX_STYLE_LITERAL = new RegExp(
  String.raw`(['"])\s*(#[0-9a-fA-F]{3,8}|\d*\.?\d+(?:px|rem|em)|rgba?\([^)]*\))\s*\1`,
  'g',
)

export function lintJsxInlineStyles(source, rel) {
  const findings = []
  for (const block of source.matchAll(JSX_STYLE_BLOCK)) {
    const body = block[1]
    for (const hit of body.matchAll(JSX_STYLE_LITERAL)) {
      findings.push({
        file: rel,
        line: source.slice(0, block.index).split('\n').length,
        rule: 'no-raw-inline-style',
        // `detail`, not `value` — the CSS rules above all report under this
        // key and the reporter reads it, so a different name here printed
        // "undefined" next to every inline-style finding.
        detail: hit[2],
      })
    }
  }
  return findings
}

/** Strip comments so `/* #fff *\/` and commented-out rules never count. */
function stripComments(css) {
  // Replace with equal-length whitespace to keep byte offsets (and line numbers) intact.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) if (text[i] === '\n') line += 1
  return line
}

/**
 * Walk declarations rather than raw text: a bare regex over the file would also
 * match `#id` selectors and hex inside `url(...)` data URIs.
 */
function* declarations(css) {
  const re = /([-a-zA-Z][-a-zA-Z0-9]*)\s*:\s*([^;{}]*)(?=[;}])/g
  let m
  while ((m = re.exec(css)) !== null) {
    yield { prop: m[1], value: m[2].trim(), index: m.index }
  }
}

export function lintCss(css, relPath) {
  const clean = stripComments(css)
  const findings = []

  for (const { prop, value, index } of declarations(clean)) {
    // Defining a token is exactly where literals belong.
    if (prop.startsWith('--')) continue

    const at = () => ({ file: relPath, line: lineOf(clean, index) })

    // A hex literal anywhere in the value, including inside color-mix() etc.
    // Fallbacks such as `var(--gt-text, #f2f4f8)` still count: a fallback that
    // never matches the active theme is how a green leaks into a pink theme.
    const hexes = value.match(/#[0-9a-fA-F]{3,8}\b/g)
    if (hexes) {
      for (const hex of hexes) {
        findings.push({ ...at(), rule: 'no-raw-color', detail: `${prop}: ${hex}` })
      }
    }

    if (prop === 'border-radius' || prop.startsWith('border-') && prop.endsWith('-radius')) {
      const v = value.toLowerCase()
      if (!v.includes('var(') && !ALLOWED_RADIUS_LITERALS.has(v)) {
        findings.push({ ...at(), rule: 'no-raw-radius', detail: `${prop}: ${value}` })
      }
    }

    if (prop === 'font-size') {
      const v = value.toLowerCase()
      if (!v.includes('var(') && !ALLOWED_FONT_SIZE_LITERALS.has(v)) {
        findings.push({ ...at(), rule: 'no-raw-font-size', detail: `${prop}: ${value}` })
      }
    }
  }

  return findings
}

function collectCssFiles(dir, out = []) {  // also collects .jsx/.js — see below
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out // A frontend app may not be checked out in every environment.
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) collectCssFiles(full, out)
    // .jsx/.js join the walk so inline styles are linted too — see
    // lintJsxInlineStyles. Tests are excluded: a fixture may need a literal.
    else if (entry.endsWith('.css')) out.push(full)
    else if ((entry.endsWith('.jsx') || entry.endsWith('.js')) && !entry.includes('.test.')) out.push(full)
  }
  return out
}

/** Posix-style repo-relative path so the baseline is stable across platforms. */
function toRelPath(full) {
  return relative(REPO_ROOT, full).split(sep).join('/')
}

export function runLint() {
  const counts = {}
  const findings = []

  for (const root of SCAN_ROOTS) {
    for (const full of collectCssFiles(join(REPO_ROOT, root))) {
      const rel = toRelPath(full)
      const source = readFileSync(full, 'utf8')
      const fileFindings = rel.endsWith('.css')
        ? lintCss(source, rel)
        : lintJsxInlineStyles(source, rel)
      if (!fileFindings.length) continue
      findings.push(...fileFindings)
      counts[rel] = fileFindings.reduce((acc, f) => {
        acc[f.rule] = (acc[f.rule] || 0) + 1
        return acc
      }, {})
    }
  }

  return { counts, findings }
}

export function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Compare against the baseline.
 *
 * @returns {{regressions: Array, improvements: Array}} regressions fail the
 *   build; improvements only suggest re-recording.
 */
export function compareToBaseline(counts, baseline) {
  const regressions = []
  const improvements = []

  for (const [file, rules] of Object.entries(counts)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = baseline[file]?.[rule] ?? 0
      if (count > allowed) {
        regressions.push({ file, rule, count, allowed })
      }
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

function main() {
  const update = process.argv.includes('--update')
  const { counts, findings } = runLint()

  if (update) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
    const total = findings.length
    console.log(`css-token-lint: recorded ${total} existing violations across ${Object.keys(sorted).length} files.`)
    return
  }

  const baseline = readBaseline()
  const { regressions, improvements } = compareToBaseline(counts, baseline)

  if (regressions.length) {
    // Which specific line is the new one is not knowable from counts alone, so
    // list the file's violations and let the per-rule tally below name the delta.
    console.error('css-token-lint: files with new design-token violations\n')
    const byFile = new Map()
    for (const f of findings) {
      const allowed = baseline[f.file]?.[f.rule] ?? 0
      const count = counts[f.file]?.[f.rule] ?? 0
      if (count > allowed) {
        if (!byFile.has(f.file)) byFile.set(f.file, [])
        byFile.get(f.file).push(f)
      }
    }
    for (const [file, items] of byFile) {
      console.error(`  ${file}`)
      for (const item of items.slice(0, 10)) {
        console.error(`    ${item.line}:  ${item.rule}  ${item.detail}`)
      }
      if (items.length > 10) console.error(`    … ${items.length - 10} more`)
    }
    console.error('')
    for (const r of regressions) {
      console.error(`  ${r.file}  ${r.rule}: ${r.count} > ${r.allowed} allowed`)
    }
    console.error(`\n  ${RULES['no-raw-color']}`)
    console.error(`  ${RULES['no-raw-radius']}`)
    console.error(`  ${RULES['no-raw-font-size']}`)
    console.error(`  ${RULES['no-raw-inline-style']}`)
    process.exitCode = 1
    return
  }

  const total = findings.length
  if (improvements.length) {
    console.log(`css-token-lint: OK (${total} known violations, ${improvements.length} below baseline).`)
    console.log('  Baseline can be tightened: node scripts/css-token-lint.mjs --update')
  } else {
    console.log(`css-token-lint: OK (${total} known violations, none new).`)
  }
}

// Only run when invoked directly, so tests can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
