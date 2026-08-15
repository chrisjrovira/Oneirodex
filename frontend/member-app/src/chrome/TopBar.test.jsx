import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'

import { TopBar } from './TopBar'

/**
 * Bar one, reduced to page scope (GT-B2).
 *
 * The rail owns destinations now, so there is little structure left here worth
 * pinning — but the one control the bar still owns outright is the rail toggle,
 * and it had no coverage in either shell while quietly reporting the wrong
 * state.
 */

function renderTopBar(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <TopBar shellConfig={{ username: 'ada' }} {...props} />
    </MemoryRouter>,
  )
}

test('the rail toggle reports whether the rail is showing', () => {
  // The rail has three states and this one button drives all of them, so
  // `=== 'open'` was the wrong test: 'open' is the mobile drawer only, which
  // left aria-expanded permanently false on desktop — announcing a collapsed
  // rail while it sat there expanded with its labels showing. Shown is 'open'
  // or 'expanded'; 'collapsed' is the only state that is not.
  //
  // partials/topbar.html and its base.html handler have always had this right,
  // which is what made the divergence worth a test: one chrome, three
  // implementations, and the two React ones disagreed with the correct one.
  for (const [railState, expected] of [
    ['expanded', 'true'],
    ['open', 'true'],
    ['collapsed', 'false'],
  ]) {
    const { unmount } = renderTopBar({ railState })
    expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute(
      'aria-expanded',
      expected,
    )
    unmount()
  }
})

test('the toggle keeps one stable name across states', () => {
  // A disclosure button carries its state in aria-expanded, not in a name that
  // changes underneath the user — a control renaming itself mid-interaction is
  // what makes a rail toggle read as two different buttons.
  const { unmount } = renderTopBar({ railState: 'expanded' })
  expect(screen.getByRole('button', { name: 'Toggle navigation' })).toBeInTheDocument()
  unmount()

  renderTopBar({ railState: 'collapsed' })
  expect(screen.getByRole('button', { name: 'Toggle navigation' })).toBeInTheDocument()
})
