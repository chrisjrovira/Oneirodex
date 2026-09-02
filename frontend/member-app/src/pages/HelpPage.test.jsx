import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { HelpPage } from './HelpPage'

test('starts with every section collapsed', () => {
  render(
    <MemoryRouter>
      <HelpPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(screen.getByRole('button', { name: /Game Catalog & signals/i })).toHaveAttribute(
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
  expect(screen.getByRole('button', { name: /Game Catalog & signals/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  await user.click(screen.getByRole('button', { name: 'Collapse all' }))
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('new chrome also starts with every section collapsed', () => {
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('topic groups and Expand/Collapse share one fused seg', async () => {
  // One outline, one chrome language — Expand/Collapse used to be separate
  // `od-cbtn`s beside the green `.od-seg` and read as a second toolbar.
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  const expand = screen.getByRole('button', { name: 'Expand all' })
  const seg = expand.closest('.od-seg')
  expect(seg).toBeTruthy()
  expect(seg.getAttribute('aria-label')).toBe('Help')
  const labels = [...seg.querySelectorAll(':scope > .od-seg__item')].map((el) =>
    el.textContent.trim(),
  )
  expect(labels[0]).toBe('Start')
  expect(labels).toContain('Expand all')
  expect(labels).toContain('Collapse all')
  expect(labels.indexOf('Expand all')).toBeLessThan(labels.indexOf('Collapse all'))
  expect(labels[labels.length - 1]).toBe('Collapse all')
  expect(expand.classList.contains('od-seg__item')).toBe(true)
  expect(expand.classList.contains('od-cbtn')).toBe(false)
})

test('every section carries a theme tone and a glyph', async () => {
  // Twelve identical grey panels are found by re-reading every heading. The
  // tone must come from the token set, not from a hex picked in the page.
  const { container } = render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  const sections = container.querySelectorAll('.od-help__section')
  expect(sections.length).toBeGreaterThan(0)
  const allowed = new Set(['accent', 'info', 'success', 'warning', 'danger'])
  for (const section of sections) {
    expect(allowed.has(section.getAttribute('data-tone'))).toBe(true)
    expect(section.querySelector('.od-help__section-mark svg')).not.toBeNull()
  }
})

test('names Oneirodex and documents every play mode, not only NES', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'How Oneirodex works' })).toBeInTheDocument()
  expect(screen.queryByText(/How Oneirodex works/)).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Expand all' }))
  expect(screen.getByText(/oh-NY-roh-dex/)).toBeInTheDocument()
  expect(screen.getByText(/Genesis family \(including SG-1000\)/)).toBeInTheDocument()
  expect(screen.getByText(/PS5 and Xbox Series stay catalog-only/)).toBeInTheDocument()
  expect(screen.getByText(/one tile per title/i)).toBeInTheDocument()
  expect(screen.getByText(/Set completeness/)).toBeInTheDocument()
  expect(screen.getByText(/Licensed catalog/)).toBeInTheDocument()
})
