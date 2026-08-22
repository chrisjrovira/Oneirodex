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
  expect(screen.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', '/report')
})

test('new chrome moves the fold controls into bar two and keeps all three', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('heading', { name: 'Help' })).toBeNull()
  // Report an issue is a link, not a button — it must survive the move as one,
  // or middle-click and open-in-new-tab quietly stop working.
  expect(screen.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', '/report')

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

test('expand leads the bar and collapse closes it', async () => {
  // Not cosmetic: they were adjacent, so overshooting Expand by one button
  // collapsed everything you had just opened. The link between them is the
  // separation.
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
  expect(labels[0]).toBe('Expand all')
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
