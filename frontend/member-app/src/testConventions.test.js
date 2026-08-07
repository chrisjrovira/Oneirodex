import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

/**
 * user-event must be imported at module scope, never inside a test body.
 *
 * A dynamic import inside a test charges vitest's first resolve+transform of
 * the module to *that test's* timeout instead of to collection. On a
 * network-mounted checkout under full-suite load that is the whole difference
 * between passing alone and timing out in the suite — SpaceRail and
 * ReportIssuePage failed exactly this way, and were "fixed" once by raising
 * the timeout to 90s, which did not help because the cause was elsewhere.
 *
 * This guard exists because I then wrote a new test the same way within hours
 * of fixing those two. A convention nobody can accidentally violate beats one
 * everybody has to remember.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)))

function testFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...testFiles(full))
    } else if (/\.test\.jsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

test('no test imports user-event inside a test body', () => {
  const offenders = testFiles(SRC).filter((file) =>
    /await import\(\s*['"]@testing-library\/user-event['"]\s*\)/.test(
      readFileSync(file, 'utf8'),
    ),
  )

  expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([])
})
