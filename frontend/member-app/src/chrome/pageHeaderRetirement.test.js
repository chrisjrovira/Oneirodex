import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * UIR-3 guards, asserted against the shared stylesheet itself.
 *
 * The original plan said "strip od-page-header from 22 files". That was wrong:
 * 16 of 18 page headers also carry buttons, links or selects, so removing the
 * block would have deleted working controls. These tests exist so nobody
 * re-derives the wrong conclusion later and hides the whole header.
 */

// Anchored to this file, not cwd: vitest's cwd depends on where it was invoked.
const HERE = dirname(fileURLToPath(import.meta.url))
const CSS = readFileSync(
  join(HERE, '../../../../oneirodex/setup/default_theme/css/od-appbar.css'),
  'utf8',
)

describe('page header retirement', () => {
  it('is scoped to the v2 chrome marker, so the old layout is untouched', () => {
    const rules = CSS.split('\n').filter((l) => l.includes('.od-page-header'))
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule).toMatch(/\[data-chrome='v2'\]/)
    }
  })

  it('hides the heading and lede, not the header block itself', () => {
    expect(CSS).toMatch(/\.od-page-header > h1/)
    expect(CSS).toMatch(/\.od-page-header > \.od-more-page__lede/)
    // A bare `.od-page-header { display: none }` would take the actions with it.
    const bare = /\[data-chrome='v2'\] \.od-page-header \{[^}]*display:\s*none/
    expect(CSS).not.toMatch(bare)
  })

  it('only collapses a header that has no controls left in it', () => {
    // The :has() guard is what keeps action-bearing headers on screen.
    expect(CSS).toMatch(/:not\(:has\(button\)\)/)
    expect(CSS).toMatch(/:not\(:has\(a\)\)/)
    expect(CSS).toMatch(/:not\(:has\(select\)\)/)
  })

  it('removes the heading from the a11y tree rather than hiding it visually', () => {
    // An invisible-but-announced heading is worse than none: the real section
    // name now lives in the context bar.
    expect(CSS).not.toMatch(/\.od-page-header > h1[^{]*\{[^}]*visibility:\s*hidden/)
    expect(CSS).not.toMatch(/\.od-page-header > h1[^{]*\{[^}]*opacity:\s*0/)
  })
})
