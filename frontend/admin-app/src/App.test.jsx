import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

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
