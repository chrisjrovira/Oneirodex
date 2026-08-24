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

test('the group strip leads the bar and the fold controls follow it', async () => {
  // The topic groups are the page's navigation, so they come first; Expand and
  // Collapse are the page's controls and follow.
  //
  // Expand before Collapse because they are opposite ends of one range.
  // They are adjacent: W28 separated them with a "Report an issue" link, which
  // was removed because Report is a rail destination and a second route to it
  // does not belong on Help. Asserting order rather than position, so the bar
  // can gain or lose a control without this breaking.
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  const bar = screen
    .getByRole('button', { name: 'Expand all' })
    .closest('.gt-contextbar')
  // Controls only — the open/total readout is a span and is not one of them.
  const labels = [...bar.querySelectorAll('button, a')].map((el) =>
    el.textContent.trim(),
  )
  expect(labels[0]).toBe('Start')
  expect(labels.indexOf('Expand all')).toBeLessThan(
    labels.indexOf('Collapse all'),
  )
  expect(labels[labels.length - 1]).toBe('Collapse all')
})

test('every section carries a theme tone and a glyph', async () => {
  // Twelve identical grey panels are found by re-reading every heading. The
  // tone must come from the token set, not from a hex picked in the page.
  const { container } = render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  const sections = container.querySelectorAll('.gt-help__section')
  expect(sections.length).toBeGreaterThan(0)
  const allowed = new Set(['accent', 'info', 'success', 'warning', 'danger'])
  for (const section of sections) {
    expect(allowed.has(section.getAttribute('data-tone'))).toBe(true)
    expect(section.querySelector('.gt-help__section-mark svg')).not.toBeNull()
  }
})
