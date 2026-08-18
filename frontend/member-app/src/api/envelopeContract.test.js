import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

/**
 * Guard: every api/ wrapper reports a failed response through the one helper.
 *
 * Each wrapper used to hand-roll this, and they had drifted into two broken
 * tiers — one that never read the body (so `PageStatus` showed a member
 * "announcements 500") and one that read `error` but dropped `error_code` and
 * `status`. Both are invisible in review because each file looks reasonable on
 * its own; only the set is wrong. So the set is what gets asserted.
 *
 * This counts rather than names, like the admin brand-mark guard: a new wrapper
 * is free to appear, it just has to use the helper.
 */

const API_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * Failure paths that legitimately do not read an envelope. Keep this list
 * short and reasoned — it is the escape hatch that could hollow out the guard.
 */
const EXEMPT = new Map([
  [
    'preferences.js',
    '/settings_panel renders HTML, so there is no envelope to parse',
  ],
  [
    'discover.js',
    'guards the content-type after an ok response, not a failed one',
  ],
])

function sourceFiles() {
  return fs
    .readdirSync(API_DIR)
    .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
    .filter((name) => name !== 'envelopeError.js' && name !== 'csrf.js')
}

describe('CSRF handling lives in one module', () => {
  /**
   * Fifteen modules used to carry their own copy, in nine variants differing in
   * how many fallbacks they tried. The short ones sent an empty token on any
   * page rendering the input field instead of the meta tag, and the 403 that
   * came back said nothing about why. Redefining it locally is the regression.
   */
  test.each(sourceFiles())('%s does not redefine the token lookup', (name) => {
    const source = fs.readFileSync(path.join(API_DIR, name), 'utf8')
    const local = source.match(
      /^(?:function|const)\s+(getCsrfToken|csrfToken|csrfHeaders)\b/gm,
    )
    expect(
      local ?? [],
      `import { csrfHeaders } from './csrf' instead — the shared chain is the `
        + `superset, so a local copy can only be narrower`,
    ).toEqual([])
  })

  test('nothing hand-builds the X-CSRFToken header', () => {
    const offenders = sourceFiles().filter((name) => {
      const source = fs.readFileSync(path.join(API_DIR, name), 'utf8')
      return /'X-CSRFToken'\s*:/.test(source)
    })
    expect(offenders, 'use csrfHeaders(extra) so window.CSRFUtils is honoured').toEqual([])
  })
})

describe('api wrappers report failures through the shared envelope helper', () => {
  test.each(sourceFiles())('%s', (name) => {
    const source = fs.readFileSync(path.join(API_DIR, name), 'utf8')
    const lines = source.split('\n')

    const offenders = []
    lines.forEach((line, index) => {
      if (!/throw new Error\(/.test(line)) {
        return
      }
      // Only failure-branch throws matter. A DOM guard or a content-type check
      // is not a response and has no envelope to report.
      const preceding = lines.slice(Math.max(0, index - 3), index).join('\n')
      if (/if \(!\w+\.ok\)/.test(preceding)) {
        offenders.push(`${name}:${index + 1} ${line.trim()}`)
      }
    })

    if (EXEMPT.has(name)) {
      return
    }
    expect(
      offenders,
      `use \`throw await errorFromResponse(response, '<label>')\` so the backend's `
        + `sentence and its error_code reach PageStatus`,
    ).toEqual([])
  })

  test.each(sourceFiles())('%s does not rebuild the message from data.error', (name) => {
    // The first version of this guard only looked for `throw new Error(` right
    // after an `if (!x.ok)`, which missed the same flattening one level down in
    // a helper — `tokens.js` had `readError()` doing exactly that, and it read
    // as tidy code. What identifies the bug is reaching for `data.error` to
    // build an Error, wherever that happens.
    const source = fs.readFileSync(path.join(API_DIR, name), 'utf8')
    const offenders = source
      .split('\n')
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => /new Error\(/.test(line) && /data\??\.\w*error/i.test(line))
      .map(({ line, number }) => `${name}:${number} ${line}`)

    expect(
      offenders,
      'let errorFromResponse() read the body — it keeps status and error_code too',
    ).toEqual([])
  })

  test('every wrapper that reports failures imports the helper', () => {
    const missing = sourceFiles().filter((name) => {
      const source = fs.readFileSync(path.join(API_DIR, name), 'utf8')
      if (!/errorFromResponse\(/.test(source)) {
        return false
      }
      return !/import \{ errorFromResponse \} from '\.\/envelopeError'/.test(source)
    })
    expect(missing).toEqual([])
  })

  test('a fallback label never embeds the status twice', () => {
    // The helpers append ` ${status}` themselves, so a label that already has it
    // renders "cheats list 500 500". Checking only `errorFromResponse(` missed
    // this when the label was passed through a module's own wrapper —
    // `cheats.js` did that at four sites. Interpolating the status into a
    // template literal is the tell, so match that instead of a callee name.
    const offenders = []
    for (const name of sourceFiles()) {
      const source = fs.readFileSync(path.join(API_DIR, name), 'utf8')
      source.split('\n').forEach((line, index) => {
        if (/`[^`]*\$\{\s*\w*\.?status\s*\}[^`]*`/.test(line)) {
          offenders.push(`${name}:${index + 1} ${line.trim()}`)
        }
      })
    }
    expect(
      offenders,
      'pass a bare label — errorFromResponse/errorFromBody add the status',
    ).toEqual([])
  })
})
