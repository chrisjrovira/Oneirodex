import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'

import { HubPage } from './pages'

/**
 * GT-B35. A section landing page with no body of its own is the one page where
 * wrong wayfinding copy has nothing to hide behind — there is nothing else on
 * the screen to fall back to.
 */

test('does not point at the actions row GT-B7 deleted', () => {
  // The old copy read "Use the actions above for the full workflow." The
  // per-page LinkRow was removed when the rail took over destinations, so that
  // sentence sent the operator to blank space.
  render(
    <MemoryRouter>
      <HubPage title="Content" lede="Shelves and announcements." />
    </MemoryRouter>,
  )

  expect(screen.queryByText(/actions above/i)).toBeNull()
})

test('does not explain the app to itself', () => {
  // "Form POSTs still hit the existing Flask endpoints" is implementation
  // detail an operator cannot act on.
  render(
    <MemoryRouter>
      <HubPage title="Content" lede="Shelves and announcements." />
    </MemoryRouter>,
  )

  expect(screen.queryByText(/Flask endpoints/i)).toBeNull()
  expect(screen.queryByText(/React shell/i)).toBeNull()
})

test('offers the section destinations when it has them', () => {
  render(
    <MemoryRouter>
      <HubPage
        title="Content"
        lede="Shelves and announcements."
        links={[
          { href: '/admin/discovery_sections', label: 'Discovery shelves' },
          { href: '/admin/newsletter', label: 'Newsletter' },
        ]}
      />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Discovery shelves' })).toHaveAttribute(
    'href',
    '/admin/discovery_sections',
  )
  expect(screen.getByRole('link', { name: 'Newsletter' })).toBeInTheDocument()
})

test('falls back to naming the rail rather than leaving a blank panel', () => {
  // With no links there is still an answer to "what do I do here", and it names
  // somewhere that actually exists.
  render(
    <MemoryRouter>
      <HubPage title="Admin" lede="" />
    </MemoryRouter>,
  )

  expect(screen.getByText(/pick a destination/i)).toBeInTheDocument()
})
