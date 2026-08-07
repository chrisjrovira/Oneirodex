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
  expect(nav.querySelector('a.gt-topnav__link[href="/favorites"]')).toHaveTextContent(/favorites/i)
  // Admin lives in context strip — not a primary link beside Favorites
  expect(nav.querySelector('a.gt-topnav__link[href="/admin/dashboard"]')).toBeNull()
  expect(nav.querySelector('a.gt-topnav__context-link[href="/admin/dashboard"]')).toHaveTextContent(
    /^Admin$/i,
  )
})

test('new chrome drops breadcrumbs from bar one but keeps the way out to admin', () => {
  renderNav({ isAdmin: true, enableNewChrome: true })
  const nav = screen.getByRole('navigation', { name: 'Primary' })
  // Bar two already names the section; "Library" + "Library home" side by side
  // was the duplication the two-bar split was supposed to remove.
  expect(nav.querySelector('a.gt-topnav__context-link[href="/library"]')).toBeNull()
  expect(nav.querySelector('a.gt-topnav__context-link[href="/discover"]')).toBeNull()
  expect(nav.querySelector('a.gt-topnav__context-link[href="/admin/dashboard"]')).toHaveTextContent(
    /^Admin$/i,
  )
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

test('more → Friends opens dock event without navigating to /social-companion', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  window.addEventListener('gt-open-social-companion', onOpen)
  try {
    renderNav({})
    await user.click(screen.getByRole('button', { name: /more/i }))
    const friends = screen.getByRole('menuitem', { name: 'Friends' })
    expect(friends.tagName).toBe('BUTTON')
    expect(friends).not.toHaveAttribute('href')
    await user.click(friends)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).not.toBe('/social-companion')
  } finally {
    window.removeEventListener('gt-open-social-companion', onOpen)
  }
})

test('account menu opens profile panel under TopNav (no full takeover)', async () => {
  const user = userEvent.setup()
  renderNav({ username: 'ada', role: 'admin' })
  await user.click(screen.getByRole('button', { name: /account menu/i }))
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '#account-profile')
  expect(screen.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute('href', '/settings_panel')
  expect(screen.getByRole('menuitem', { name: 'API tokens' })).toHaveAttribute('href', '/tokens')
  expect(screen.getByRole('menuitem', { name: 'Change Password' })).toHaveAttribute('href', '/settings_password')
  expect(screen.getByRole('menuitem', { name: 'Logout' })).toHaveAttribute('href', '/logout')

  await user.click(screen.getByRole('menuitem', { name: 'Profile' }))
  expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  expect(screen.getByText('GameTheca')).toBeInTheDocument()
})

test('preferences opens modal path so theme reload can apply', async () => {
  const user = userEvent.setup()
  renderNav({ username: 'ada' })
  await user.click(screen.getByRole('button', { name: /account menu/i }))
  await user.click(screen.getByRole('menuitem', { name: 'Preferences' }))
  expect(openPreferencesModal).toHaveBeenCalled()
})

test('search hint opens command palette callback', async () => {
  const user = userEvent.setup()
  const onOpenCommandPalette = vi.fn()
  render(
    <MemoryRouter initialEntries={['/library']}>
      <TopNav shellConfig={{}} onOpenCommandPalette={onOpenCommandPalette} />
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: /search commands/i }))
  expect(onOpenCommandPalette).toHaveBeenCalled()
})

test('active primary link uses quiet underline class without pill fill', () => {
  renderNav({ isAdmin: false })
  const library = screen.getByRole('navigation', { name: 'Primary' }).querySelector(
    'a.gt-topnav__link.active[href="/library"]',
  )
  expect(library).toBeTruthy()
  expect(library.className).toContain('active')
  // Pill fill removed in CSS — class remains `active` for NavLink; style is underline/weight.
  expect(library).not.toHaveClass('gt-topnav__pill')
})
