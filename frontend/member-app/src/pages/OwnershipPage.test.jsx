import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OwnershipPage } from './OwnershipPage'
import { ShellHarness } from '../testShell'

function summaryPayload(overrides = {}) {
  return {
    enabled: true,
    has_steam_api_key: true,
    has_gog_api_key: false,
    has_epic_api_key: false,
    total_owned: 12,
    total_matched: 5,
    stores: {
      amazon: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
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
  const payload = JSON.stringify(body)
  return Promise.resolve({
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(payload),
  })
}

function requestHeaders(call) {
  return new Headers(call?.[1]?.headers)
}

function ownedTitlesCounts() {
  const el = document.querySelector('.od-ownership__card-counts')
  return (el?.textContent || '').replace(/\s+/g, ' ').trim()
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

  render(
    <ShellHarness shell={{}}>
      <OwnershipPage />
    </ShellHarness>,
  )

  expect(screen.getByText('Loading ownership status…')).toBeInTheDocument()

  await waitFor(() => {
    expect(ownedTitlesCounts()).toMatch(/12 synced · 5 matched/)
  })
  const storeRows = screen.getAllByRole('listitem')
  const steamRow = storeRows.find((row) => /Steam/.test(row.textContent || ''))
  const gogRow = storeRows.find(
    (row) => /^GOG/.test((row.textContent || '').trim()) || /\bGOG\b/.test(row.textContent || ''),
  )
  expect(steamRow).toHaveTextContent(/connected/)
  expect(steamRow).toHaveTextContent(/10 titles · 4 matched/)
  expect(gogRow).toHaveTextContent(/not connected/)
  expect(gogRow).toHaveTextContent(/2 titles · 1 matched/)
  expect(
    screen.getByText(/Steam API key configured.*GOG \/ Epic \/ Amazon: live register/),
  ).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/ownership',
    expect.objectContaining({ credentials: 'include' }),
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
          amazon: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
          epic: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
          gog: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
          steam: { connected: false, external_account_id: null, owned_count: 0, matched_count: 0 },
        },
      }),
    ),
  )

  render(
    <ShellHarness>
      <OwnershipPage />
    </ShellHarness>,
  )

  expect(
    await screen.findByText('No owned titles synced yet. Connect a store or import a CSV below.'),
  ).toBeInTheDocument()
})

test('shows retry when the summary request fails', async () => {
  global.fetch
    .mockImplementationOnce(() => jsonResponse({}, { ok: false, status: 500 }))
    .mockImplementation(() => jsonResponse(summaryPayload()))

  const user = userEvent.setup()
  render(
    <ShellHarness>
      <OwnershipPage />
    </ShellHarness>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load store ownership.')

  await user.click(screen.getByRole('button', { name: /Try again/i }))

  await waitFor(() => {
    expect(ownedTitlesCounts()).toMatch(/12 synced · 5 matched/)
  })
})

test('sync posts to the steam sync endpoint with the CSRF header', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/ownership/steam/sync') {
      return jsonResponse({ synced: 10, matched: 4, store: 'steam', summary: summaryPayload() })
    }
    return jsonResponse(summaryPayload())
  })

  const user = userEvent.setup()
  render(
    <ShellHarness>
      <OwnershipPage />
    </ShellHarness>,
  )

  const syncButton = await screen.findByRole('button', { name: 'Sync from Steam' })
  await user.click(syncButton)

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ownership/steam/sync',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })
  const syncCall = global.fetch.mock.calls.find(([url]) => url === '/api/ownership/steam/sync')
  expect(requestHeaders(syncCall).get('X-CSRFToken')).toBe('token-abc')

  expect(await screen.findByText('Synced 10 titles (4 matched to library).')).toBeInTheDocument()
})

test('csv import posts the pasted rows as JSON', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/ownership/gog/csv') {
      return jsonResponse({ imported: 3, matched: 2, store: 'gog', summary: summaryPayload() })
    }
    return jsonResponse(summaryPayload())
  })

  const user = userEvent.setup()
  render(
    <ShellHarness>
      <OwnershipPage />
    </ShellHarness>,
  )

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
      }),
    )
  })
  const csvCall = global.fetch.mock.calls.find(([url]) => url === '/api/ownership/gog/csv')
  expect(requestHeaders(csvCall).get('X-CSRFToken')).toBe('token-abc')
  expect(requestHeaders(csvCall).get('Content-Type')).toBe('application/json')

  expect(await screen.findByText('Imported 3 GOG titles (2 matched).')).toBeInTheDocument()
})
