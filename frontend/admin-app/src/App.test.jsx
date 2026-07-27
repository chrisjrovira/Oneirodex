import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

test('integrations hub shows grouped cards', () => {
  render(
    <MemoryRouter initialEntries={['/admin/integrations']}>
      <App />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'IGDB' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'SMTP' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'OIDC' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'LiveKit' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Support' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'IGDB settings' })).toHaveAttribute(
    'href',
    '/admin/igdb_settings',
  )
})

test('renders admin brand and primary nav', () => {
  render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <App />
    </MemoryRouter>,
  )
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
