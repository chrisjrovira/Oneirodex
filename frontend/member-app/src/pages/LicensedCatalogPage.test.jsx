import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LicensedCatalogPage } from './LicensedCatalogPage'

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

const SAMPLE = {
  ok: true,
  library_platform: 'NES',
  unique_titles: 2,
  owned_titles: 1,
  empty: false,
  fetched_at: '2026-08-29T00:00:00+00:00',
  note: 'Titles are IGDB main games.',
  by_region: [
    {
      region_code: 'USA',
      label: 'United States',
      titles: 2,
      owned: 1,
      source: 'igdb',
    },
    {
      region_code: 'FRA',
      label: 'France',
      titles: 0,
      owned: 0,
      source: 'dat_only',
    },
  ],
}

function renderPage(path, shellConfig = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LicensedCatalogPage shellConfig={shellConfig} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  global.fetch = vi.fn(() => jsonResponse(SAMPLE))
})

afterEach(() => {
  delete global.fetch
})

test('empty query asks the member to open the page from Systems', () => {
  renderPage('/systems/catalog')
  expect(screen.getByRole('heading', { name: 'Licensed catalog' })).toBeInTheDocument()
  expect(screen.getByText(/Open this page from a Systems tile/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Systems' })).toHaveAttribute(
    'href',
    '/systems',
  )
  expect(global.fetch).not.toHaveBeenCalled()
})

test('lists IGDB region counts and DAT-only honesty', async () => {
  renderPage('/systems/catalog?library_platform=NES')
  expect(await screen.findByText('United States (USA)')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'NES · licensed catalog' })).toBeInTheDocument()
  expect(screen.getByText(/Titles are IGDB main games/)).toBeInTheDocument()
  expect(screen.getByText('France (FRA)')).toBeInTheDocument()
  expect(screen.getByText('DAT only')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Set completeness' })).toHaveAttribute(
    'href',
    '/systems/completion?library_platform=NES',
  )
})

test('Retry reloads after a failed fetch', async () => {
  const user = userEvent.setup()
  global.fetch
    .mockResolvedValueOnce(jsonResponse({ error: 'down' }, 502))
    .mockResolvedValueOnce(jsonResponse(SAMPLE))

  renderPage('/systems/catalog?library_platform=NES')
  expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load licensed catalog/)
  await user.click(screen.getByRole('button', { name: /Try again/i }))
  expect(await screen.findByText('United States (USA)')).toBeInTheDocument()
})

test('new chrome moves identity into the bar', async () => {
  renderPage('/systems/catalog?library_platform=NES', { enableNewChrome: true })
  expect(await screen.findByText('1 / 2 titles in cache')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'NES · licensed catalog' })).toBeNull()
  expect(screen.getByText('NES · licensed catalog')).toBeInTheDocument()
})
