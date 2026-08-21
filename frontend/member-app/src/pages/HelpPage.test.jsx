import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { HelpPage } from './HelpPage'

test('starts with Getting started open and other sections collapsed', () => {
  render(
    <MemoryRouter>
      <HelpPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(screen.getByRole('button', { name: /Library & signals/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  // Report is a rail destination, not a Help control. Duplicating it here put
  // a second route to the same page on a page about finding things.
  expect(screen.queryByRole('link', { name: /Report/i })).toBeNull()
})

test('new chrome moves the fold controls into bar two and keeps all three', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('heading', { name: 'Help' })).toBeNull()
  expect(screen.queryByRole('link', { name: /Report/i })).toBeNull()

  // The topic strip moved into bar two — reaching the page's own navigation
  // should not require scrolling the page. Twelve topics was a strip you
  // scrolled rather than a switcher you read, so it groups to five; the topics
  // themselves still exist as sections, with their ids intact.
  for (const group of ['Start', 'Collection', 'Playing', 'Community', 'Support']) {
    expect(screen.getByRole('button', { name: group })).toBeInTheDocument()
  }
  // ...and the per-topic segments are gone from the switcher. Exact names,
  // because the topics still exist as section headings — the grouping shortened
  // the switcher, it did not delete a topic. `Patches` was a segment label and
  // is now only reachable as a section, so nothing answers to it exactly.
  expect(screen.queryByRole('button', { name: 'Patches' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Controllers' })).toBeNull()

  // Every topic is still on the page as its own foldable section.
  expect(screen.getByRole('button', { name: /Controllers/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /translation|patch/i })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Expand all' }))
  expect(screen.getByRole('button', { name: /Library & signals/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  await user.click(screen.getByRole('button', { name: 'Collapse all' }))
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})
