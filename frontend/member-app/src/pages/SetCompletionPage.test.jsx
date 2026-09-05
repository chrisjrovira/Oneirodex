import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SetCompletionPage } from './SetCompletionPage'
import * as wishlistApi from '../api/wishlist'

vi.mock('../api/wishlist', () => ({
  createRequest: vi.fn(),
}))

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

const SAMPLE = {
  region: 'USA',
  set_name: 'No-Intro NES',
  owned: 10,
  total: 12,
  percent: 83,
  missing_count: 1,
  missing: [{ name: 'Zelda II', normalized_name: 'zelda ii' }],
}

function renderPage(path, shellConfig = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SetCompletionPage shellConfig={shellConfig} />
    </MemoryRouter>,
  )
}

function completionPayload(url, overrides = {}) {
  const parsed = new URL(String(url), 'http://local.test')
  return {
    ...SAMPLE,
    region: (parsed.searchParams.get('region') || 'USA').toUpperCase(),
    ...overrides,
  }
}

beforeEach(() => {
  wishlistApi.createRequest.mockReset()
  wishlistApi.createRequest.mockResolvedValue({ id: 1 })
  global.fetch = vi.fn((url) => jsonResponse(completionPayload(url)))
})

afterEach(() => {
  delete global.fetch
})

test('lists missing titles and can wishlist one', async () => {
  const user = userEvent.setup()
  renderPage('/systems/completion?library_platform=NES&region=USA')

  expect(screen.getByRole('status', { busy: true })).toBeInTheDocument()
  expect(await screen.findByText('Zelda II')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'NES · USA' })).toBeInTheDocument()
  expect(screen.getByText(/10 \/ 12 owned \(83%\)/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Systems' })).toHaveAttribute('href', '/systems')
  expect(screen.getByRole('link', { name: 'Browse library' })).toHaveAttribute(
    'href',
    '/library?library_platform=NES',
  )
  expect(screen.getByRole('link', { name: 'Licensed catalog' })).toHaveAttribute(
    'href',
    '/systems/catalog?library_platform=NES',
  )

  await user.click(screen.getByRole('button', { name: 'Wishlist' }))
  await waitFor(() => {
    expect(wishlistApi.createRequest).toHaveBeenCalledWith({
      title: 'Zelda II',
      notes: 'Missing from NES USA reference set',
    })
  })
  expect(screen.getByText(/Added “Zelda II” to wishlist/)).toBeInTheDocument()
})

test('empty query asks the member to open the page from Systems', () => {
  renderPage('/systems/completion')
  expect(screen.getByRole('heading', { name: 'Set completion' })).toBeInTheDocument()
  expect(screen.getByText(/Open this page from Systems/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Systems' })).toHaveAttribute(
    'href',
    '/systems',
  )
  expect(global.fetch).not.toHaveBeenCalled()
})

test('404 names the missing reference set', async () => {
  global.fetch.mockResolvedValue(
    jsonResponse({ error: 'No set', error_code: 'not_found' }, 404),
  )
  renderPage('/systems/completion?library_platform=NES&region=USA')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /No reference set uploaded for NES\/USA/,
  )
  expect(screen.queryByRole('button', { name: /Try again/i })).toBeNull()
})

test('Retry reloads after a failed fetch', async () => {
  const user = userEvent.setup()
  global.fetch
    .mockResolvedValueOnce(jsonResponse({ error: 'down' }, 502))
    .mockResolvedValueOnce(jsonResponse(SAMPLE))

  renderPage('/systems/completion?library_platform=NES')
  expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load set completion/)
  await user.click(screen.getByRole('button', { name: /Try again/i }))
  expect(await screen.findByText('Zelda II')).toBeInTheDocument()
})

test('new chrome moves identity and actions into the bar', async () => {
  const user = userEvent.setup()
  renderPage('/systems/completion?library_platform=NES&region=USA', {
    enableNewChrome: true,
  })

  expect(await screen.findByText('10 / 12 owned (83%)')).toBeInTheDocument()
  // The identity is the bar's own <h1>, not a page header. It was a <span>
  // until the a11y pass gave every route a real heading (f2723d11); the
  // check that it is *not* a heading outlived that. Asserting the bar class
  // keeps the original intent — the name moved into the bar — without
  // reinstating "this route announces no heading at all".
  const heading = screen.getByRole('heading', { name: 'NES · USA' })
  expect(heading).toHaveClass('od-topbar__section')
  expect(screen.queryByRole('heading', { name: 'Set completion' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Systems' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse library' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Back to Systems' })).toBeNull()

  const trigger = screen.getByRole('button', { name: /Filters/ })
  expect(trigger).not.toHaveClass('is-on')
  await user.click(trigger)
  await user.selectOptions(screen.getByLabelText('Region'), 'EUR')
  await waitFor(() => {
    expect(trigger).toHaveClass('is-on')
  })
  await waitFor(() => {
    const urls = global.fetch.mock.calls.map((call) => String(call[0]))
    expect(urls.some((url) => url.includes('region=EUR'))).toBe(true)
  })
})
