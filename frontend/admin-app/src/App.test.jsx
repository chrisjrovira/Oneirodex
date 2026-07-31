import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

test('integrations hub shows grouped cards', async () => {
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/api/admin/integrations/inventory')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          integrations: [
            {
              id: 'steamgriddb',
              name: 'SteamGridDB',
              category: 'artwork',
              status: 'configured',
              configured: true,
              admin_href: '/admin/integrations#steamgriddb',
              settings_href: '/admin/integrations#steamgriddb',
              notes: 'Cover / hero art',
            },
            {
              id: 'igdb',
              name: 'IGDB',
              category: 'metadata',
              status: 'configured',
              configured: true,
              admin_href: '/admin/integrations#igdb',
              settings_href: '/admin/igdb_settings',
              notes: 'Primary game metadata',
            },
            {
              id: 'arr_prowlarr',
              name: 'Prowlarr',
              category: 'acquire',
              status: 'available',
              configured: false,
              admin_href: '/admin/arr',
              settings_href: '/admin/arr',
              notes: 'Acquire connector',
            },
          ],
          count: 3,
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })
  try {
    render(
      <MemoryRouter initialEntries={['/admin/integrations']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'IGDB' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Artwork & secondary metadata' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SMTP' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'OIDC' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'LiveKit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acquire / Arr' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Export packs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Support' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'IGDB settings' })).toHaveAttribute(
      'href',
      '/admin/igdb_settings',
    )
    expect(screen.getByRole('link', { name: 'Download ES-DE gamelist.xml' })).toHaveAttribute(
      'href',
      '/api/export/esde',
    )
    expect(screen.getByRole('link', { name: 'Download Pegasus metadata' })).toHaveAttribute(
      'href',
      '/api/export/pegasus?platform=Library',
    )
    expect(await screen.findByRole('heading', { name: 'Provider inventory' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Artwork' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Metadata' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acquire' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SteamGridDB' })).toHaveAttribute(
      'href',
      '/admin/integrations#steamgriddb',
    )
    const igdbLinks = screen.getAllByRole('link', { name: 'IGDB' })
    expect(igdbLinks.some((el) => el.getAttribute('href') === '/admin/igdb_settings')).toBe(true)
    expect(screen.getByText(/Cover \/ hero art/i)).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})

test('renders admin brand and primary nav', () => {
  render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByText('GameTheca')).toBeInTheDocument()
  expect(screen.getByText('Admin')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Admin' })).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(nav.querySelector('a[href="/admin/dashboard"]')).toHaveTextContent('Dashboard')
  expect(nav.querySelector('a[href="/libraries"]')).toHaveTextContent('Libraries')
  expect(nav.querySelector('a[href="/admin/settings"]')).toHaveTextContent('Settings')
})

test('users route shows React roster', async () => {
  const originalFetch = global.fetch
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/admin/api/users')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          users: [
            {
              id: 1,
              name: 'Ada',
              email: 'ada@example.com',
              role: 'admin',
              state: true,
              is_email_verified: true,
            },
          ],
        }),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })
  try {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Classic user editor/i })).toHaveAttribute(
      'href',
      '/admin/manage_users',
    )
  } finally {
    global.fetch = originalFetch
  }
})
