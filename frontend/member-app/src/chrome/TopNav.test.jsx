import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { openPreferencesModal } from '../api/preferences'
import { TopNav } from './TopNav'

vi.mock('../api/preferences', async () => {
  const actual = await vi.importActual('../api/preferences')
  return {
    ...actual,
    openPreferencesModal: vi.fn(() => Promise.resolve()),
  }
})

function renderNav(shellConfig = {}) {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <TopNav shellConfig={shellConfig} />
    </MemoryRouter>,
  )
}

test('renders GameTheca wordmark and primary SPA links', () => {
  renderNav({ isAdmin: true, username: 'ada' })
  expect(screen.getByText('GameTheca')).toBeInTheDocument()
  const nav = screen.getByRole('navigation', { name: 'Primary' })
  expect(nav.querySelector('a[href="/discover"]')).toHaveTextContent(/discover/i)
  expect(nav.querySelector('a.gt-topnav__link[href="/library"]')).toHaveTextContent(/^Library$/i)
  expect(nav.querySelector('a[href="/systems"]')).toHaveTextContent(/systems/i)
  expect(nav.querySelector('a[href="/downloads"]')).toHaveTextContent(/downloads/i)
  expect(nav.querySelector('a[href="/favorites"]')).toHaveTextContent(/favorites/i)
  expect(nav.querySelector('a[href="/admin/dashboard"]')).toHaveTextContent(/^Admin$/i)
})

test('hides admin when not admin', () => {
  renderNav({ isAdmin: false })
  expect(screen.queryByRole('link', { name: /^admin$/i })).toBeNull()
})

test('more menu uses SPA paths via NavLink', async () => {
  const user = userEvent.setup()
  renderNav({ showTrailers: true, showHelp: true, enableVr: true })
  await user.click(screen.getByRole('button', { name: /more/i }))
  expect(screen.getByRole('menuitem', { name: 'Collections' })).toHaveAttribute('href', '/collections')
  expect(screen.getByRole('menuitem', { name: 'News' })).toHaveAttribute('href', '/news')
  expect(screen.getByRole('menuitem', { name: 'VR' })).toHaveAttribute('href', '/vr')
  expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/help')
})

test('account menu matches base.html account URLs', async () => {
  const user = userEvent.setup()
  renderNav({ username: 'ada' })
  await user.click(screen.getByRole('button', { name: /account menu/i }))
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/settings_profile_view')
  expect(screen.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute('href', '/settings_panel')
  expect(screen.getByRole('menuitem', { name: 'Change Password' })).toHaveAttribute('href', '/settings_password')
  expect(screen.getByRole('menuitem', { name: 'Logout' })).toHaveAttribute('href', '/logout')
})

test('preferences opens modal path so theme reload can apply', async () => {
  const user = userEvent.setup()
  renderNav({ username: 'ada' })
  await user.click(screen.getByRole('button', { name: /account menu/i }))
  await user.click(screen.getByRole('menuitem', { name: 'Preferences' }))
  expect(openPreferencesModal).toHaveBeenCalled()
})
