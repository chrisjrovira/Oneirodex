import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { OverlayLinksPanel } from './OverlayLinksPanel'
import { stubFetch } from '../testJsonResponse'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists the overlay links with their kinds and opens them in a new tab', async () => {
  stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      enabled: true,
      pack: { title: 'Knight helpers', toggles: [], overlay_links: [] },
      overlay_links: [
        { label: 'Interactive map', url: 'https://example.invalid/map', kind: 'map' },
        {
          label: 'PCGamingWiki',
          url: 'https://www.pcgamingwiki.com/w/index.php?search=Hollow+Knight',
          kind: 'wiki',
        },
      ],
    }),
  }))
  render(<OverlayLinksPanel gameUuid="g1" />)
  expect(
    await screen.findByRole('heading', { name: 'Assists · Knight helpers' }),
  ).toBeInTheDocument()
  const map = screen.getByRole('link', { name: 'Interactive map' })
  expect(map).toHaveAttribute('href', 'https://example.invalid/map')
  expect(map).toHaveAttribute('target', '_blank')
  expect(screen.getByText('Map')).toBeInTheDocument()
  expect(screen.getByText('Wiki')).toBeInTheDocument()
  expect(screen.getByText(/nothing reads or changes it/)).toBeInTheDocument()
})

test('renders nothing without a game or when the server has no links', async () => {
  stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ enabled: true, pack: null, overlay_links: [] }),
  }))
  const { container } = render(<OverlayLinksPanel gameUuid="g1" />)
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
  const empty = render(<OverlayLinksPanel gameUuid="" />)
  expect(empty.container).toBeEmptyDOMElement()
})
