import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OwnershipPage } from './OwnershipPage'

function summaryPayload(overrides = {}) {
  return {
    enabled: true,
    has_steam_api_key: true,
    has_gog_api_key: false,
    has_epic_api_key: false,
    total_owned: 12,
    total_matched: 5,
    stores: {
      epic: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
      gog: { connected: false, external_account_id: null, owned_count: 2, matched_count: 1 },
      steam: {
        connected: true,
        external_account_id: '76561190000000000',
        owned_count: 10,
        matched_count: 4,
      },
    },
    ...overrides,
  }
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="csrf-token" content="token-abc">'
  global.fetch = vi.fn()
})

afterEach(() => {
  document.head.innerHTML = ''
  delete global.fetch
})

test('renders ownership summary after loading', async () => {
  global.fetch.mockImplementation(() => jsonResponse(summaryPayload()))

  render(<OwnershipPage shellConfig={{}} />)

  expect(screen.getByText('Loading ownership status…')).toBeInTheDocument()

  expect(await screen.findByText(/12 synced · 5 matched to library/)).toBeInTheDocument()
  expect(screen.getByText(/Steam: connected · 10 titles · 4 matched/)).toBeInTheDocument()
  expect(screen.getByText(/GOG: not connected · 2 titles · 1 matched/)).toBeInTheDocument()
  expect(screen.getByText('Steam API key configured')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/ownership',
    expect.objectContaining({ credentials: 'same-origin' }),
  )
  expect(screen.getByLabelText('Steam ID (64-bit)')).toHaveValue('76561190000000000')
  expect(screen.getByRole('button', { name: 'Disconnect Steam' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Disconnect Epic Games' })).toBeDisabled()
})

test('shows empty state when nothing is synced yet', async () => {
  global.fetch.mockImplementation(() =>
    jsonResponse(
      summaryPayload({
        total_owned: 0,
        total_matched: 0,
        stores: {
          epic: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
          gog: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
          steam: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
        },
      }),
    ),
  )

  render(<OwnershipPage />)

  expect(
    await screen.findByText('No owned titles synced yet. Connect a store or import a CSV below.'),
  ).toBeInTheDocument()
})

test('shows retry when the summary request fails', async () => {
  global.fetch
    .mockImplementationOnce(() => jsonResponse({}, { ok: false, status: 500 }))
    .mockImplementation(() => jsonResponse(summaryPayload()))

  const user = userEvent.setup()
  render(<OwnershipPage />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load store ownership.')

  await user.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByText(/12 synced · 5 matched to library/)).toBeInTheDocument()
})

test('sync posts to the steam sync endpoint with the CSRF header', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/ownership/steam/sync') {
      return jsonResponse({ synced: 10, matched: 4, store: 'steam', summary: summaryPayload() })
    }
    return jsonResponse(summaryPayload())
  })

  const user = userEvent.setup()
  render(<OwnershipPage />)

  const syncButton = await screen.findByRole('button', { name: 'Sync from Steam' })
  await user.click(syncButton)

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ownership/steam/sync',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'X-CSRFToken': 'token-abc' }),
      }),
    )
  })

  expect(
    await screen.findByText('Synced 10 titles (4 matched to library).'),
  ).toBeInTheDocument()
})

test('csv import posts the pasted rows as JSON', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/ownership/gog/csv') {
      return jsonResponse({ imported: 3, matched: 2, store: 'gog', summary: summaryPayload() })
    }
    return jsonResponse(summaryPayload())
  })

  const user = userEvent.setup()
  render(<OwnershipPage />)

  const textarea = await screen.findByLabelText(
    'Import owned titles (CSV: product ID or id,name per line)',
  )
  await user.type(textarea, '123,Some Game')

  await user.click(screen.getAllByRole('button', { name: 'Import CSV' })[1])

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ownership/gog/csv',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ csv: '123,Some Game' }),
        headers: expect.objectContaining({
          'X-CSRFToken': 'token-abc',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  expect(await screen.findByText('Imported 3 GOG titles (2 matched).')).toBeInTheDocument()
})
