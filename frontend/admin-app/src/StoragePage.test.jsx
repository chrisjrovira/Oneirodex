import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { StoragePage } from './StoragePage'

const STATUS_HELPERS_OFF = {
  helpers_enabled: false,
  allow_apply: false,
  games_path: '/storage',
  games_exists: true,
  games_readable: true,
  games_writable: true,
  degrade_reason: null,
}

const STATUS_APPLY_OFF = {
  helpers_enabled: true,
  allow_apply: false,
  games_path: '/storage',
  games_exists: true,
  games_readable: true,
  games_writable: true,
  degrade_reason: 'Apply disabled (ALLOW_HARDLINK_APPLY=false)',
}

const STATUS_RO = {
  helpers_enabled: true,
  allow_apply: false,
  games_path: '/storage',
  games_exists: true,
  games_readable: true,
  games_writable: false,
  degrade_reason:
    'Apply disabled (ALLOW_HARDLINK_APPLY=false); games path is read-only',
}

const PREVIEW_OK = {
  ok: true,
  same_volume: true,
  would_succeed: true,
  bytes_saved_estimate: 2048,
  reasons: [],
  source: 'C:\\games\\a.exe',
  dest: 'C:\\library\\a.exe',
}

function mockFetch(handlers) {
  return vi.fn(async (url, init) => {
    const method = (init?.method || 'GET').toUpperCase()
    const key = `${method} ${String(url)}`
    for (const [match, fn] of handlers) {
      if (key.includes(match) || String(url).includes(match)) {
        const result = await fn(url, init, method)
        if (result) return result
      }
    }
    throw new Error(`unexpected fetch ${method} ${url}`)
  })
}

function jsonOk(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('StoragePage shows helpers-off and apply-off banners from status', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch([
    ['/api/storage/status', async () => jsonOk(STATUS_HELPERS_OFF)],
  ])
  try {
    render(<StoragePage />)
    expect(await screen.findByRole('heading', { name: 'Storage / hardlinks' })).toBeInTheDocument()
    expect(await screen.findByText(/Hardlink helpers are/i)).toBeInTheDocument()
    expect(screen.getByText(/off/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  } finally {
    global.fetch = originalFetch
  }
})

test('StoragePage shows apply-off safety banner and RO games mount banner', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch([['/api/storage/status', async () => jsonOk(STATUS_RO)]])
  try {
    render(<StoragePage />)
    expect(await screen.findByText(/Apply is disabled until/i)).toBeInTheDocument()
    expect(screen.getByText(/Games mount is/i)).toBeInTheDocument()
    expect(screen.getByText(/games path is read-only/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  } finally {
    global.fetch = originalFetch
  }
})

test('StoragePage preview happy path shows reasons list and bytes estimate', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  global.fetch = mockFetch([
    ['/api/storage/status', async () => jsonOk(STATUS_APPLY_OFF)],
    [
      '/api/storage/hardlink/preview',
      async (_url, init, method) => {
        if (method !== 'POST') return null
        const body = init?.body ? JSON.parse(init.body) : {}
        expect(body.source).toBe('C:\\games\\a.exe')
        expect(body.dest).toBe('C:\\library\\a.exe')
        return jsonOk(PREVIEW_OK)
      },
    ],
  ])
  try {
    render(<StoragePage />)
    expect(await screen.findByRole('button', { name: 'Preview' })).toBeEnabled()
    await user.type(screen.getByLabelText('Source file'), 'C:\\games\\a.exe')
    await user.type(screen.getByLabelText('Destination path'), 'C:\\library\\a.exe')
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => {
      expect(screen.getByText(/Would succeed/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Same volume:/i)).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText(/2\.0 KB/i)).toBeInTheDocument()
    expect(screen.getByText(/Reasons: none/i)).toBeInTheDocument()
    expect(screen.getByText('Raw JSON')).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})

test('App route /admin/storage mounts Storage UI', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch([['/api/storage/status', async () => jsonOk(STATUS_APPLY_OFF)]])
  try {
    render(
      <MemoryRouter initialEntries={['/admin/storage']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Storage / hardlinks' })).toBeInTheDocument()
    expect(screen.getByLabelText('Source file')).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})
