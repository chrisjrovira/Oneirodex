import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TopNav } from './TopNav'

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
  expect(screen.getByRole('link', { name: /discover/i })).toHaveAttribute('href', '/discover')
  expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute('href', '/library')
  expect(screen.getByRole('link', { name: /downloads/i })).toHaveAttribute('href', '/downloads')
  expect(screen.getByRole('link', { name: /favorites/i })).toHaveAttribute('href', '/favorites')
  expect(screen.getByRole('link', { name: /^admin$/i })).toHaveAttribute('href', '/admin/dashboard')
})

test('hides admin when not admin', () => {
  renderNav({ isAdmin: false })
  expect(screen.queryByRole('link', { name: /^admin$/i })).toBeNull()
})

test('more menu uses Flask paths', async () => {
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