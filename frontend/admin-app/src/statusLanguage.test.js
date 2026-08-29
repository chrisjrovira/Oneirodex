import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * One status language for admin (GT-B33) — a ratchet, not a cleanup mandate.
 *
 * The member SPA has had a shared `PageStatus` since GT-A2. Admin never did, so
 * fifteen files grew their own answers to "this page is busy" / "this page
 * failed" — at least eight different shapes:
 *
 *   <p>Loading…</p>                              bare, unannounced
 *   <div role="alert" className="gt-admin-alert">
 *   <p className="gt-admin-lede" role="status">
 *   <div className="gt-error" role="alert">
 *   <p className="gt-adminpage-status" role="status">
 *   <div className="gt-admin-banner gt-admin-banner--warn" role="status">
 *   <p role="alert">{error}</p>
 *   <span role="status" aria-busy="true">
 *
 * The visual mismatch with the member app is the obvious cost. The quieter one
 * is accessibility: several of those announce a failure politely, or carry no
 * live region at all, and none of them surface the envelope's `error_code`.
 *
 * Same model as `scripts/api_envelope_lint.py` and `scripts/css-token-lint.mjs`:
 * baseline-counted per file, a file may never exceed its recorded count, and a
 * file with no record must have zero. Lower a number when you convert a site to
 * `PageStatus`; delete the row when a file reaches zero. Never raise one.
 *
 * **Zero is not the target for every file.** `role="status"` / `role="alert"` are
 * correct markup for several things `PageStatus` deliberately does not model,
 * and those are meant to stay:
 *
 *   - success/completion messages ("Saved", "N files added") — PageStatus has no
 *     success variant, and inventing one would make it a notification system
 *   - persistent configuration disclosure (StoragePage's five
 *     `gt-admin-banner` blocks: helpers off, apply gated, mount read-only) —
 *     page content, not a transient page state
 *   - inline progress on a single control ("Uploading…", "Refreshing…",
 *     "Scanning…") — scoped to one widget, not to the page
 *
 * What the ratchet is actually preventing is a *new* hand-rolled
 * loading/error/empty block for a page's data. Judge a rise on that, not on the
 * number alone.
 */

const HERE = dirname(fileURLToPath(import.meta.url))

/* Recorded 2026-08-25 after the GT-B33 conversion: 59 → 27 sites, 21 → 16
 * files, five files at zero. What remains is largely the deliberate categories
 * listed above rather than debt. */
const STATUS_BASELINE = {
  'ArtStudioPage.jsx': 1,
  'ArtworkPicker.jsx': 1,
  'DupeGlance.jsx': 1,
  'EmulatorFirmwarePanel.jsx': 2,
  'ImportLeafLibraries.jsx': 2,
  'InvitesPage.jsx': 1,
  'OpenPathModal.jsx': 1,
  'OpsPage.jsx': 1,
  'ProposeLeafLibraries.jsx': 2,
  'RemotePlayPage.jsx': 1,
  'ScanMatchSettingsPage.jsx': 3,
  'StockPicker.jsx': 1,
  'SystemMarksPanel.jsx': 1,
  'StoragePage.jsx': 5,
  'SystemResetPanel.jsx': 2,
  'pages.jsx': 2,
}

/** PageStatus is the shared implementation — it is meant to carry these roles. */
const EXEMPT = new Set(['PageStatus.jsx'])

const STATUS_ROLE = /role="(?:status|alert)"/g

function sourceFiles() {
  return readdirSync(HERE)
    .filter((name) => name.endsWith('.jsx'))
    .filter((name) => !name.includes('.test.'))
    .filter((name) => !EXEMPT.has(name))
}

function countStatusRoles(name) {
  const source = readFileSync(join(HERE, name), 'utf8')
  return (source.match(STATUS_ROLE) || []).length
}

describe('admin status language', () => {
  it('never exceeds the recorded per-file baseline', () => {
    const regressions = []
    for (const name of sourceFiles()) {
      const count = countStatusRoles(name)
      const allowed = STATUS_BASELINE[name] ?? 0
      if (count > allowed) {
        regressions.push(`${name}: ${count} hand-rolled status sites, baseline ${allowed}`)
      }
    }
    expect(regressions,
      `Use PageStatus from './PageStatus' instead of a new role="status"/role="alert" block.\n`
      + regressions.join('\n'),
    ).toEqual([])
  })

  it('has no baseline row that has outlived its violations', () => {
    // A stale row would silently permit a regression back up to its number,
    // which is how a ratchet quietly stops ratcheting.
    const stale = []
    for (const [name, allowed] of Object.entries(STATUS_BASELINE)) {
      const count = countStatusRoles(name)
      if (count < allowed) {
        stale.push(`${name}: baseline ${allowed}, actually ${count} — lower it`)
      }
    }
    expect(stale).toEqual([])
  })

  it('exposes the shared component the baseline is meant to drive toward', async () => {
    const module = await import('./PageStatus.jsx')
    expect(typeof module.PageStatus).toBe('function')
    expect(typeof module.resolveErrorMessage).toBe('function')
    expect(typeof module.resolveErrorDetail).toBe('function')
  })
})
