import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

/**
 * One button language across the member app.
 *
 * "The buttons should follow our library button style — still looks like the
 * old style" was reported separately against Collections, Wishlist, Trailers,
 * Updates and Favorites. Five reports, one cause, and it was never the page:
 *
 *   1. `.gt-btn` and `.gt-cbtn` were two different geometries. Fixed at the
 *      root — both now resolve to the same shape in the theme CSS, so a page
 *      cannot look "old" by picking the wrong one. Nothing here guards that;
 *      the stylesheet does.
 *
 *   2. A `<button>` with no class at all. This is what actually shipped the
 *      mismatched controls: Wishlist's resolve/cancel row, Ownership's connect
 *      and sync actions, every "Retry" in an error state. A bare button gets
 *      the user agent's chrome — grey, system font, square — which is exactly
 *      what "the old style" describes, and no amount of theme work reaches it.
 *
 * So the rule is the narrow one that catches the real defect: **every
 * `<button>` we render carries a `className`**. It says nothing about *which*
 * class, because that is a design call per control; it only stops a button from
 * opting out of the design system entirely.
 *
 * Zero, not a baseline. The tree was taken to zero in the same pass that added
 * this, and a button without a class has no legitimate use here — if one ever
 * needs bespoke styling it still gets a name, and the name is what the
 * stylesheet targets. Naming it is also what stops the *other* half of this
 * defect: a stylesheet reaching for a bare `button` descendant selector, which
 * is how Help's accordion and Collections' picker were styled and why neither
 * could be found by searching for its class.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

/** Opening `<button` tags, with everything up to the closing `>`. */
const BUTTON_TAG = /<button(?![a-zA-Z])((?:[^>]|\n)*?)>/g

const SKIP_DIRS = new Set(['node_modules', 'dist', '__snapshots__'])

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out)
      continue
    }
    // Tests render throwaway markup to assert against; they are not shipped UI.
    if (!/\.jsx?$/.test(entry) || /\.test\.jsx?$/.test(entry)) continue
    out.push(full)
  }
  return out
}

/** @returns {string[]} `path:line` for every `<button>` with no className. */
export function unclassedButtons(root = HERE) {
  const found = []
  for (const file of sourceFiles(root)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(BUTTON_TAG)) {
      if (match[1].includes('className')) continue
      const line = source.slice(0, match.index).split('\n').length
      found.push(`${relative(root, file).split('\\').join('/')}:${line}`)
    }
  }
  return found
}

test('every rendered button carries a class', () => {
  // Listed rather than counted so a failure names the file and line to fix.
  expect(unclassedButtons()).toEqual([])
})

test('the check sees an unclassed button and ignores a classed one', () => {
  const probe = [
    '<button type="button" onClick={x}>A</button>',
    '<button className="gt-cbtn">B</button>',
    // Multi-line form, which is how most of the real offenders were written.
    '<button\n  type="button"\n  disabled={busy}\n>C</button>',
  ].join('\n')

  const hits = [...probe.matchAll(BUTTON_TAG)].filter(
    (match) => !match[1].includes('className'),
  )

  expect(hits).toHaveLength(2)
})
