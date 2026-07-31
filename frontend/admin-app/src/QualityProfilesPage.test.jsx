import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { QualityProfilesPage } from './QualityProfilesPage'

const SAMPLE_STORE = {
  version: 2,
  active_id: 'p1',
  profiles: [
    {
      id: 'p1',
      name: 'Default',
      preferred_groups: ['GOG'],
      preferred_patterns: ['repack'],
      blocked_groups: [],
      excluded_terms: ['CAM'],
      min_size_mb: null,
      max_size_mb: null,
      prefer_repack: true,
    },
    {
      id: 'p2',
      name: 'Strict',
      preferred_groups: [],
      preferred_patterns: [],
      blocked_groups: ['scene'],
      excluded_terms: [],
      min_size_mb: 100,
      max_size_mb: null,
      prefer_repack: true,
    },
  ],
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

test('QualityProfilesPage lists profiles and sets active', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  let store = structuredClone(SAMPLE_STORE)
  global.fetch = mockFetch([
    [
      '/api/quality-profiles/active',
      async (_url, init, method) => {
        if (method !== 'PUT') return null
        const body = init?.body ? JSON.parse(init.body) : {}
        store = { ...store, active_id: body.id }
        return jsonOk({ ...store })
      },
    ],
    [
      '/api/quality-profiles',
      async (_url, _init, method) => {
        if (method === 'GET') return jsonOk(store)
        return null
      },
    ],
  ])

  try {
    render(<QualityProfilesPage />)
    expect(await screen.findByRole('heading', { name: 'Quality Profiles' })).toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Quality profiles' })
    expect(select).toHaveDisplayValue(/Default \(active\)/)
    expect(screen.getByDisplayValue('GOG')).toBeInTheDocument()

    await user.selectOptions(select, 'p2')
    expect(select).toHaveValue('p2')
    await user.click(screen.getByRole('button', { name: 'Set active' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/quality-profiles/active',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/Active profile updated|Active: Strict/i)).toBeInTheDocument()
    })
  } finally {
    global.fetch = originalFetch
  }
})

test('QualityProfilesPage creates a profile', async () => {
  const user = userEvent.setup()
  const originalFetch = global.fetch
  const originalPrompt = window.prompt
  window.prompt = vi.fn(() => 'Household')
  let store = structuredClone(SAMPLE_STORE)

  global.fetch = mockFetch([
    [
      '/api/quality-profiles',
      async (_url, init, method) => {
        if (method === 'GET') return jsonOk(store)
        if (method === 'POST') {
          const body = init?.body ? JSON.parse(init.body) : {}
          const created = {
            id: 'p3',
            name: body.name || 'Profile',
            preferred_groups: [],
            preferred_patterns: [],
            blocked_groups: [],
            excluded_terms: [],
            min_size_mb: null,
            max_size_mb: null,
            prefer_repack: true,
          }
          store = { ...store, profiles: [...store.profiles, created] }
          return jsonOk(created, 201)
        }
        return null
      },
    ],
  ])

  try {
    render(<QualityProfilesPage />)
    expect(await screen.findByRole('combobox', { name: 'Quality profiles' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/quality-profiles',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/Created Household/i)).toBeInTheDocument()
    })
    const select = screen.getByRole('combobox', { name: 'Quality profiles' })
    expect(select.querySelector('option[value="p3"]')).toBeTruthy()
  } finally {
    global.fetch = originalFetch
    window.prompt = originalPrompt
  }
})

test('App route /admin/quality_profiles mounts Quality Profiles UI', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch([
    ['/api/quality-profiles', async () => jsonOk(SAMPLE_STORE)],
  ])
  try {
    render(
      <MemoryRouter initialEntries={['/admin/quality_profiles']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Quality Profiles' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Quality profiles' })).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})
