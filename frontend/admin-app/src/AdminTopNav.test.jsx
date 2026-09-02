import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

import { AdminSideRail } from './AdminSideRail'
import { AdminTopNav } from './AdminTopNav'
import { ADMIN_NAV, HUB_LINKS } from './navConfig'

const COLLAPSED_SECTIONS_KEY = 'od.admin.rail.collapsedSections'

function resetCollapsedSections() {
  try {
    window.localStorage.removeItem(COLLAPSED_SECTIONS_KEY)
  } catch {
    const store = new Map()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => {
          store.set(key, String(value))
        },
        removeItem: (key) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
      },
    })
  }
}

beforeEach(() => {
  resetCollapsedSections()
})

/**
 * Rewritten for the rail chrome (GT-B2).
 *
 * The previous version of this file asserted the two-bar structure: a brand
 * block, seven section links and a breadcrumb strip, all in bar one. Those
 * assertions were correct for UIR-1 and are wrong now by design — brand and
 * destinations moved to the rail, and the top bar was reduced to page scope.
 *
 * The claims worth carrying over are behavioural, not structural: the ways out
 * of admin still exist, the active section is still marked, and nothing is
 * offered twice. They are asserted here against whichever component now owns
 * them.
 */

function renderTopBar({ at = '/admin/ops', onToggleRail = () => {}, railState } = {}) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <AdminTopNav onToggleRail={onToggleRail} railState={railState} />
    </MemoryRouter>,
  )
}

function renderRail({ at = '/admin/ops', railState = 'expanded' } = {}) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <AdminSideRail railState={railState} />
    </MemoryRouter>,
  )
}

test('the rail toggle reports whether the rail is showing', () => {
  // The rail has three states and this one button drives all of them. Testing
  // `=== 'open'` — the mobile drawer state — left aria-expanded permanently
  // false on desktop, so a screen reader was told the rail was collapsed while
  // it sat there expanded with its labels showing. Shown is 'open' or
  // 'expanded'; 'collapsed' is the only state that is not.
  for (const [railState, expected] of [
    ['expanded', 'true'],
    ['open', 'true'],
    ['collapsed', 'false'],
  ]) {
    const { unmount } = renderTopBar({ railState })
    expect(screen.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute(
      'aria-expanded',
      expected,
    )
    unmount()
  }
})

test('top bar is page scope only — no brand, no destinations', () => {
  const { container } = renderTopBar()

  expect(container.querySelector('.od-topbar')).toBeTruthy()
  // The retired two-bar markup must not come back.
  expect(container.querySelector('.od-appbar')).toBeNull()
  expect(container.querySelector('.od-admin-topbar')).toBeNull()
  expect(container.querySelector('.od-admin-brand')).toBeNull()

  // None of the seven section destinations may appear in the bar — that
  // duplication is exactly what moving them to the rail removed.
  for (const link of ADMIN_NAV) {
    expect(container.querySelector(`a[href="${link.path}"]`)).toBeNull()
  }
})

test('the bar carries no search control of its own (GT-B16 parity)', () => {
  // The member bar dropped its search under GT-B16: a second search affordance
  // in the chrome costs permanent width and buys nothing over the page's own
  // filtering. Admin kept a "Search ⌘K" button, which was the most visible
  // difference between the two bars. ⌘K still works — AdminCommandPalette binds
  // it — and the hint now lives in the account menu, as it does for members.
  renderTopBar()

  expect(screen.queryByRole('button', { name: /^search/i })).toBeNull()
})

test('the palette hint moved into the account menu, and still opens it', () => {
  const onOpen = vi.fn()
  document.addEventListener('od-admin-palette:open', onOpen)

  renderTopBar()
  // fireEvent, not .click(): the menu is React state, and a raw DOM click is
  // not wrapped in act(), so the panel never renders before the next query.
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))

  const hint = screen.getByRole('menuitem', { name: /search everything/i })
  expect(hint).toBeInTheDocument()
  fireEvent.click(hint)
  expect(onOpen).toHaveBeenCalledTimes(1)

  document.removeEventListener('od-admin-palette:open', onOpen)
})

test('the section label appears only when the rail is collapsed', () => {
  // An expanded rail already names the active section a few pixels to the left,
  // so the bar repeating it is a second answer to a question nothing asked.
  // Same rule the member bar follows.
  const expanded = renderTopBar({ railState: 'expanded' })
  expect(expanded.container.querySelector('.od-topbar__section')).toBeNull()
  expanded.unmount()

  const collapsed = renderTopBar({ railState: 'collapsed' })
  expect(collapsed.container.querySelector('.od-topbar__section')).toBeTruthy()
})

test('dashboard section label is Dashboard (no product prefix)', () => {
  const { container } = renderTopBar({
    at: '/admin/dashboard',
    railState: 'collapsed',
  })
  const section = container.querySelector('.od-topbar__section')
  expect(section).toHaveTextContent('Dashboard')
  expect(section.textContent).not.toMatch(/Oneirodex/i)
  expect(section).not.toHaveTextContent('HOME')
  expect(section).not.toHaveTextContent('Home')
})

test('top bar exposes the rail toggle and wires it up', async () => {
  const onToggleRail = vi.fn()
  renderTopBar({ onToggleRail })

  const toggle = screen.getByRole('button', { name: /toggle navigation/i })
  toggle.click()

  expect(onToggleRail).toHaveBeenCalledTimes(1)
})

test('rail lists every admin section', () => {
  renderRail()

  // Dashboard is a destination link; foldable sections are buttons (member LHN).
  expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  for (const link of ADMIN_NAV) {
    if (link.id === 'dashboard') continue
    expect(screen.getByRole('button', { name: link.label })).toBeInTheDocument()
  }
})

test('rail marks the active section and expands its hub subsections', () => {
  const { container } = renderRail({ at: '/admin/ops' })

  const section = screen.getByRole('button', { name: 'System' })
  expect(section).toHaveClass('od-rail__group-toggle')
  expect(section).not.toHaveClass('od-rail__link')
  expect(section).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Ops glance' })).toHaveClass('is-active')
  for (const child of HUB_LINKS.system) {
    expect(container.querySelector(`a[href="${child.href}"]`)).toBeTruthy()
  }
  // Member fold: caret on the group heading, not a destination-styled row.
  expect(container.querySelector('.od-rail__section-fold')).toBeNull()
  expect(section.querySelector('.od-rail__icon')).toBeNull()
})

test('rail settings subsections include every settings row', () => {
  renderRail({ at: '/admin/new_server_settings' })

  expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(screen.getByRole('link', { name: 'All settings' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Server settings' })).toHaveAttribute(
    'href',
    '/admin/new_server_settings',
  )
})

test('rail subsection titles have no bullet markers', () => {
  const { container } = renderRail({ at: '/admin/ops' })
  const sub = container.querySelector('.od-rail__link--sub')
  expect(sub).toBeTruthy()
  expect(sub.querySelector('.od-rail__icon')).toBeNull()
})

test('the ways out of admin survive, and live in exactly one place', () => {
  const rail = renderRail()
  expect(screen.getByRole('link', { name: 'Library' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Log out' })).toBeInTheDocument()
  rail.unmount()

  // They were briefly in both the rail and the bar during the migration.
  const { container } = renderTopBar()
  expect(container.querySelector('a[href="/library"]')).toBeNull()
  expect(container.querySelector('a[href="/logout"]')).toBeNull()
})

test('the rail brand is the mark only', () => {
  const { container } = renderRail()
  const brand = container.querySelector('.od-rail__brand')
  expect(brand).toHaveClass('od-rail__brand--mark-only')
  expect(brand.querySelector('.od-rail__brand-role')).toBeNull()
})

test('collapsed rail keeps accessible names', () => {
  renderRail({ at: '/admin/ops', railState: 'collapsed' })
  expect(screen.getByRole('link', { name: 'System' })).toBeInTheDocument()
})

test('account menu is a dropdown panel, not a horizontal strip', () => {
  const { container } = renderTopBar()
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
  const panel = container.querySelector('.od-topnav__dropdown-panel')
  expect(panel).toBeTruthy()
  expect(panel.getAttribute('role')).toBe('menu')
  expect(panel.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(1)
})
