import { expect, test } from 'vitest'

import {
  compareToBaseline,
  lintCss,
  lintJsxInlineStyles,
  readBaseline,
  runLint,
} from '../../../scripts/css-token-lint.mjs'

/**
 * CI gate for the design-token ratchet.
 *
 * The lint itself is a standalone node script so it can be run by hand, but it
 * has to *fail a build* to be worth anything — the tokens it enforces already
 * existed and were being ignored, which is how the type scale ended up with 9
 * call sites against 40+ ad-hoc font sizes.
 *
 * It rides the member-app vitest job because that job already runs on every PR
 * and needs no workflow change. The lint's scope is the whole repo's CSS, not
 * just this app's.
 */

test('no new design-token violations against the baseline', () => {
  const { counts } = runLint()
  const { regressions } = compareToBaseline(counts, readBaseline())

  // Rendered as file/rule/count so a failure names the offending stylesheet
  // rather than just asserting a number went up.
  expect(
    regressions.map((r) => `${r.file} ${r.rule}: ${r.count} > ${r.allowed}`),
  ).toEqual([])
})

test('lint flags literals in declarations but not in token definitions', () => {
  const css = `
    :root { --od-accent: #2fd67b; --od-radius-sm: 6px; }
    .a { color: #2fd67b; }
    .b { color: var(--od-accent); }
    .c { border-radius: 7px; }
    .d { border-radius: var(--od-radius-sm); }
    .e { border-radius: 0; }
    .f { font-size: 0.81rem; }
    .g { font-size: var(--od-font-sm); }
  `

  const rules = lintCss(css, 'probe.css').map((f) => `${f.rule}:${f.detail}`)

  expect(rules).toEqual([
    'no-raw-color:color: #2fd67b',
    'no-raw-radius:border-radius: 7px',
    'no-raw-font-size:font-size: 0.81rem',
  ])
})

test('lint ignores hex inside comments and url() data URIs', () => {
  const css = `
    /* .old { color: #ff0000; } */
    .a { background: url("data:image/svg+xml,%3Csvg fill='%23ff0000'/%3E"); }
  `

  expect(lintCss(css, 'probe.css')).toEqual([])
})

/**
 * GT-B36. The rule this lint encodes is "*using* a value must go through a
 * token", but for its whole life it only read `.css` files — so
 * `style={{ marginTop: '1rem' }}` in a component was a literal it could not
 * see, and the report kept saying "none new" while they accumulated. There
 * were 19 across the two SPAs when this was added.
 */
test('lint sees literals in JSX inline styles', () => {
  const jsx = `
    <div style={{ marginTop: '1rem' }} />
    <div style={{ color: '#2fd67b' }} />
    <div style={{ padding: 'var(--od-space-4)' }} />
  `
  const rules = lintJsxInlineStyles(jsx, 'Example.jsx').map((f) => f.rule)

  // The two literals are caught; the tokenised one is not.
  expect(rules).toEqual(['no-raw-inline-style', 'no-raw-inline-style'])
})

test('a style built from data is not a token decision', () => {
  // `background: option.color` is the colour of a thing in the database, not a
  // design choice this lint has any business rejecting. Only quoted literals
  // count, which is what keeps data-driven styles out of the ratchet.
  const jsx = `<span style={{ background: option.color, width: computed }} />`

  expect(lintJsxInlineStyles(jsx, 'Example.jsx')).toEqual([])
})

test('inline-style findings report the offending value, not undefined', () => {
  // The CSS rules all report under `detail` and the reporter reads that key, so
  // a finding using a different name printed "undefined" beside every hit.
  const [finding] = lintJsxInlineStyles(`<div style={{ gap: '0.45rem' }} />`, 'Example.jsx')

  expect(finding.detail).toBe('0.45rem')
  expect(finding.file).toBe('Example.jsx')
})
