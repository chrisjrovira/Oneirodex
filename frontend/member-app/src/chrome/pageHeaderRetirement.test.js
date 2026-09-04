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
    // An invisible-but-announced heading is worse than none. That reasoning
    // stands, but the second half of it did not hold for a long time: the
    // context bar rendered the section name as a <span>, so the trade was not
    // "invisible heading vs visible heading" but "invisible heading vs NO
    // heading anywhere" — `h1..h6` counted zero on 15 routes. The context bar
    // title is now a real <h1> (see the suite below), so the name genuinely
    // does live there as a heading and this assertion is safe again.
    expect(CSS).not.toMatch(/\.od-page-header > h1[^{]*\{[^}]*visibility:\s*hidden/)
    expect(CSS).not.toMatch(/\.od-page-header > h1[^{]*\{[^}]*opacity:\s*0/)
  })
})


/**
 * The other half of the bargain.
 *
 * Retiring the page h1 is only defensible if the name it replaced is exposed
 * as a heading somewhere else. It was not — the context bar used a <span>, so
 * the routes above had no heading at all. These guard the replacement.
 */
describe('the context bar title is the page heading', () => {
  const jsx = (name) => readFileSync(join(HERE, name), 'utf8')

  it('TopBar renders the section name as an h1, not a span', () => {
    const src = jsx('TopBar.jsx')
    expect(src).toMatch(/<h1 className="od-topbar__section">\{pageTitle\}<\/h1>/)
    expect(src).not.toMatch(/<span className="od-topbar__section">/)
  })

  it('ContextBar renders its portalled title as an h1 too', () => {
    const src = jsx('ContextBar.jsx')
    expect(src).toMatch(/<h1 className="od-topbar__section">\{title\}<\/h1>/)
    expect(src).not.toMatch(/<span className="od-topbar__section">/)
  })

  it('the heading is not gated on rail state', () => {
    // It used to render only when the rail was collapsed, which is what left
    // the expanded-rail case — the default — with no heading at all.
    const src = jsx('TopBar.jsx')
    expect(src).not.toMatch(/railState === 'collapsed' && pageTitle/)
  })
})


/**
 * Exactly one heading, never two.
 *
 * Once the bar's title became an h1, the few pages that render their own h1
 * outside `.od-page-header` (game details, Acquire, VR) had two visible h1s,
 * with the generic route name ahead of the real one. od-shell.css stands the
 * bar's copy down for those.
 */
describe('the bar heading stands down when the page owns one', () => {
  const SHELL = readFileSync(
    join(HERE, '../../../../oneirodex/setup/default_theme/css/od-shell.css'),
    'utf8',
  )

  it('suppresses the bar title when main has a heading of its own', () => {
    expect(SHELL).toMatch(/:has\(#main-content h1[^)]*\)[\s\S]{0,60}\.od-topbar__section/)
  })

  it('ignores headings the retirement rule already hid', () => {
    // Retired h1s are display:none but still in the DOM, so a bare
    // :has(#main-content h1) would match everywhere and strip the only
    // heading the other 15 routes have. The :not() is what prevents that.
    expect(SHELL).toMatch(/:not\(\.od-page-header > h1\)/)
  })
})
