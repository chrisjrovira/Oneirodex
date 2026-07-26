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

  expect(await screen.findByRole('heading', { name: 'Systems' })).toBeInTheDocument()
  const nes = await screen.findByRole('link', { name: /Nintendo Entertainment System/i })
  expect(nes).toHaveAttribute('href', '/library?library_platform=NES')
  expect(screen.getByText('12 games')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /PC Windows/i })).toHaveAttribute(
    'href',
    '/library?library_platform=PCWIN',
  )
})
