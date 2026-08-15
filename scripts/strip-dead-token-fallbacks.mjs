#!/usr/bin/env node
/**
 * Remove hardcoded fallbacks from `var(--gt-*, <literal>)` where the token is
 * always defined by gt-tokens.css.
 *
 * A fallback that can never fire is not harmless: it hardcodes the *default*
 * theme's identity at ~280 call sites, and it converts "this token is missing"
 * from a visible failure into a silent revert to green. Admin pages were
 * rendering in the default palette regardless of the selected theme for a
 * closely-related reason (a `:root` block in admin-app.css winning the cascade
 * over the theme), and dead fallbacks are exactly what makes that class of bug
 * hard to see.
 *
 * Tokens whose value is injected at runtime — per-platform backdrop tints, per
 * store colours, play-room accents — are genuinely undefined in CSS and their
 * fallbacks are load-bearing. Those are detected by "never defined in any
 * stylesheet" rather than hand-listed, so a new runtime token is safe by
 * default.
 *
 *   node scripts/strip-dead-token-fallbacks.mjs --dry-run
 *   node scripts/strip-dead-token-fallbacks.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_ROOTS = [
  'gametheca/setup/default_theme/css',
  'frontend/member-app/src',
  'frontend/admin-app/src',
  'frontend/ops-glance/src',
]

const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '__pycache__', '.git'])

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
    statSync(full).isDirectory() ? collect(full, out) : entry.endsWith('.css') && out.push(full)
  }
  return out
}

/** Index of every `--gt-*` custom property with a definition somewhere. */
function definedTokens(files) {
  const defined = new Set()
  for (const file of files) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const m of css.matchAll(/^\s*(--gt-[a-zA-Z0-9-]+)\s*:/gm)) defined.add(m[1])
  }
  return defined
}

/** Offset of the `)` matching the `(` at `open`. */
function matchParen(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1
    else if (text[i] === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** Index of the first comma not nested inside parentheses. */
function topLevelComma(text) {
  let depth = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1
    else if (text[i] === ')') depth -= 1
    else if (text[i] === ',' && depth === 0) return i
  }
  return -1
}

/**
 * Rewrite every `var()` in `text`, innermost included.
 *
 * Recursing through the fallback matters: `var(--gt-focus-ring, var(--gt-accent,
 * #2fd67b))` must keep its outer fallback (focus-ring may be absent) while
 * losing the inner one.
 */
export function stripFallbacks(text, safe, stats = { count: 0 }) {
  let out = ''
  let i = 0

  while (i < text.length) {
    const at = text.indexOf('var(', i)
    if (at === -1) {
      out += text.slice(i)
      break
    }

    out += text.slice(i, at)
    const open = at + 3
    const close = matchParen(text, open)
    if (close === -1) {
      out += text.slice(at)
      break
    }

    const inner = text.slice(open + 1, close)
    const comma = topLevelComma(inner)

    if (comma === -1) {
      out += `var(${inner})`
    } else {
      const name = inner.slice(0, comma).trim()
      const fallback = stripFallbacks(inner.slice(comma + 1).trim(), safe, stats)
      if (safe.has(name)) {
        out += `var(${name})`
        stats.count += 1
      } else {
        out += `var(${name}, ${fallback})`
      }
    }

    i = close + 1
  }

  return out
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const files = SCAN_ROOTS.flatMap((r) => collect(join(REPO_ROOT, r)))

  const defined = definedTokens(files)
  // Only strip tokens a stylesheet actually defines. Anything set at runtime
  // (inline style, JS) is absent here, so its fallback is preserved.
  const safe = defined

  let changedFiles = 0
  let stripped = 0

  for (const file of files) {
    const before = readFileSync(file, 'utf8')
    const stats = { count: 0 }
    const after = stripFallbacks(before, safe, stats)
    if (after === before) continue
    changedFiles += 1
    stripped += stats.count
    const rel = relative(REPO_ROOT, file).split(sep).join('/')
    console.log(`  ${stats.count.toString().padStart(4)}  ${rel}`)
    if (!dryRun) writeFileSync(file, after)
  }

  console.log(
    `\n${dryRun ? 'Would strip' : 'Stripped'} ${stripped} dead fallbacks across ${changedFiles} files.`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
