import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

import { railIconPaths } from './railIcons'

/**
 * No theme may render a glyph invisible.
 *
 * The icon system lets a colour preset own the icon *silhouette* through
 * `--gt-icon-fill` / `--gt-icon-fill-opacity`, and five of the nine presets use
 * that to get outline packs by setting fill-opacity to `0`. Those tokens are set
 * on the `<svg>` and inherit into every sub-path.
 *
 * That is fine for a stroked path and fatal for a solid one. A sub-path written
 * `fill="currentColor" stroke="none"` carries a `fill` attribute (which beats
 * the inherited `fill: none`) but no `fill-opacity` attribute — so it inherited
 * `0` and was painted at zero alpha with no stroke behind it. Favorites is a
 * single solid heart, so on those five themes it rendered as nothing at all;
 * 22 other rail glyphs lost a detail apiece.
 *
 * Two halves, and both have to hold:
 *
 *   1. `gt-primitives.css` re-asserts fill and fill-opacity on any sub-path that
 *      explicitly opts into `fill="currentColor"`. That is the actual fix.
 *   2. Every glyph is drawn with *something* the fix or the stroke can show —
 *      i.e. no glyph consists solely of sub-paths that are neither stroked nor
 *      explicitly filled.
 *
 * The first is asserted against the stylesheet because there is no browser here
 * to compute a style in; jsdom does not lay out or paint SVG.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const PRIMITIVES = join(
  HERE,
  '../../../../gametheca/setup/default_theme/css/gt-primitives.css',
)

test('the stylesheet re-asserts fill on explicitly solid sub-paths', () => {
  const css = readFileSync(PRIMITIVES, 'utf8')

  // The selector has to target the sub-path, not the svg: a declaration on the
  // element is what outranks a value inherited from its parent.
  const rule = css.match(
    /\.gt-icon\s*\[fill=['"]currentColor['"]\]\s*\{([^}]*)\}/,
  )

  expect(rule, 'gt-primitives.css must keep the solid-sub-path rule').toBeTruthy()
  expect(rule[1]).toMatch(/fill:\s*currentColor/)
  // fill-opacity is the half that actually broke; fill alone does not fix it.
  expect(rule[1]).toMatch(/fill-opacity:\s*1/)
})

/** Render a glyph's JSX children to a flat list of their props. */
function subPaths(node) {
  const kids = node?.props?.children
  const list = Array.isArray(kids) ? kids : [kids]
  return list.filter(Boolean).map((child) => child.props || {})
}

test('every rail glyph has at least one sub-path a theme cannot erase', () => {
  const invisible = []

  for (const [name, glyph] of Object.entries(railIconPaths)) {
    const parts = subPaths(glyph)
    // Survivable = drawn with a stroke (themes only change its width and joins,
    // never its colour), or explicitly solid (rule 1 above protects it).
    const survivable = parts.some(
      (part) => part.stroke !== 'none' || part.fill === 'currentColor',
    )
    if (!survivable) invisible.push(name)
  }

  expect(invisible).toEqual([])
})

test('Favorites is solid, which is exactly the case that regressed', () => {
  // Pinned deliberately. The heart is the one glyph with no stroked sub-path at
  // all, so it is the canary: if the protection above is ever dropped, this is
  // the icon that disappears first and the report will say "Favorites is gone".
  const parts = subPaths(railIconPaths.favorites)

  expect(parts).toHaveLength(1)
  expect(parts[0].fill).toBe('currentColor')
  expect(parts[0].stroke).toBe('none')
})
