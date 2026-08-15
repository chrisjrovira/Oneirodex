import { expect, test } from 'vitest'

import {
  compareToBaseline,
  lintCss,
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
    :root { --gt-accent: #2fd67b; --gt-radius-sm: 6px; }
    .a { color: #2fd67b; }
    .b { color: var(--gt-accent); }
    .c { border-radius: 7px; }
    .d { border-radius: var(--gt-radius-sm); }
    .e { border-radius: 0; }
    .f { font-size: 0.81rem; }
    .g { font-size: var(--gt-font-sm); }
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
