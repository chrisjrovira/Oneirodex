import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SystemsPage } from './SystemsPage'

function mockFetch(payload, ok = true) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(payload),
    }),
  )
}

test('renders system tiles linking into library platform filter', async () => {
  mockFetch([
    {
      id: 'NES',
      value: 'NES',
      name: 'Nintendo Entertainment System (NES)',
      game_count: 12,
    },
    {
      id: 'PCWIN',
      value: 'PCWIN',
      name: 'PC Windows',
      game_count: 40,
    },
  ])

  render(
    <MemoryRouter>
      <SystemsPage />
    </MemoryRouter>,
  )

  // TopNav already labels the Systems route — no redundant page H1 here.
  const nes = await screen.findByRole('link', { name: /Nintendo Entertainment System/i })
  expect(screen.queryByRole('heading', { name: 'Systems' })).not.toBeInTheDocument()
  expect(nes).toHaveAttribute('href', '/library?library_platform=NES')
  expect(screen.getByText('12 games')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /PC Windows/i })).toHaveAttribute(
    'href',
    '/library?library_platform=PCWIN',
  )
  // Export packs live in a secondary section — not buried in the intro lede.
  expect(screen.getByRole('heading', { name: 'Export packs' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /ES-DE gamelist/i })).toHaveAttribute(
    'href',
    '/api/export/esde',
  )
  expect(screen.getByRole('link', { name: /Pegasus metadata/i })).toHaveAttribute(
    'href',
    '/api/export/pegasus?platform=Library',
  )
  expect(screen.getByText(/EmulationStation Desktop Edition/i)).toBeInTheDocument()
})

test('shows error retry instead of empty state when fetch fails', async () => {
  mockFetch([], false)

  render(
    <MemoryRouter>
      <SystemsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load systems.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  expect(screen.queryByText(/No library platforms yet/i)).not.toBeInTheDocument()
})

test('prefers themed system-mark WebP for the active data-theme', async () => {
  document.documentElement.setAttribute('data-theme', 'aurora')
  mockFetch([
    {
      id: 'NES',
      value: 'NES',
      name: 'Nintendo Entertainment System (NES)',
      game_count: 3,
    },
  ])

  try {
    const { container } = render(
      <MemoryRouter>
        <SystemsPage />
      </MemoryRouter>,
    )
    await screen.findByRole('link', { name: /Nintendo Entertainment System/i })
    const img = container.querySelector('img.gt-systems-tile__mark-img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/static/library/system-marks/aurora/nes.webp')
  } finally {
    document.documentElement.removeAttribute('data-theme')
  }
})
