import { render, screen } from '@testing-library/react'
import { BuildTile } from './opsWidgets'

/**
 * The Build tile answers "is my deploy current?" (his ask, 2026-09-22).
 *
 * The cases that matter are the three unknowns — no payload, no build stamp,
 * and an unreadable schema — because each has a tempting wrong answer that
 * would be reassuring and false at exactly the moment an operator is checking.
 */

const CURRENT = {
  version: '1.0.0',
  commit: '0befa9b4',
  built_at: '2026-09-22T18:05:00Z',
  schema_revision: 'c3d4e5f6a7b8',
  schema_head: 'c3d4e5f6a7b8',
  migration_pending: false,
  generator_version: 41,
}

function toneOf(container: HTMLElement) {
  const root = container.querySelector('.od-ops-metric')
  return Array.from(root?.classList || []).find((c) => c.startsWith('od-ops-metric--'))
}

test('a current deploy reads as good, with the version and the stamp', () => {
  const { container } = render(<BuildTile build={CURRENT} />)

  expect(screen.getByText('1.0.0')).toBeTruthy()
  expect(screen.getByText(/0befa9b4/)).toBeTruthy()
  expect(screen.getByText(/up to date/)).toBeTruthy()
  expect(toneOf(container)).toBe('od-ops-metric--good')
})

test('a pending migration is the loud line, and names both revisions', () => {
  const { container } = render(
    <BuildTile build={{ ...CURRENT, schema_revision: 'b2c3d4e5f6a7', migration_pending: true }} />,
  )

  // Naming both is what makes it actionable: one hex string alone tells an
  // operator nothing they can check.
  expect(screen.getByText(/migration pending/)).toBeTruthy()
  expect(screen.getByText(/b2c3d4e5f6a7/)).toBeTruthy()
  expect(screen.getByText(/c3d4e5f6a7b8/)).toBeTruthy()
  expect(toneOf(container)).toBe('od-ops-metric--action')
})

test('an unknown schema is not dressed up as up to date', () => {
  const { container } = render(
    <BuildTile
      build={{ ...CURRENT, schema_revision: null, schema_head: null, migration_pending: null }}
    />,
  )

  expect(screen.getByText('schema unknown')).toBeTruthy()
  expect(screen.queryByText(/up to date/)).toBeNull()
  expect(toneOf(container)).toBe('od-ops-metric--na')
})

test('an image built by hand says it has no stamp rather than inventing one', () => {
  render(<BuildTile build={{ ...CURRENT, commit: null, built_at: null }} />)
  expect(screen.getByText('no build stamp')).toBeTruthy()
})

test('no build block at all reads n/a instead of rendering an empty tile', () => {
  const { container } = render(<BuildTile build={null} />)
  expect(screen.getByText('n/a')).toBeTruthy()
  expect(screen.getByText('build data unavailable')).toBeTruthy()
  expect(toneOf(container)).toBe('od-ops-metric--na')
})

test('the tile keeps the metric root class, or the board cannot lay it out', () => {
  // `.od-dash__body > .od-ops-metric` is what makes a widget fill its cell;
  // a different root element silently renders at the wrong size.
  const { container } = render(<BuildTile build={CURRENT} />)
  expect(container.firstElementChild?.classList.contains('od-ops-metric')).toBe(true)
})
