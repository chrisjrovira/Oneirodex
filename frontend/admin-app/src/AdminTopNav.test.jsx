import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'

import { AdminSideRail } from './AdminSideRail'
import { AdminTopNav } from './AdminTopNav'
import { ADMIN_NAV, HUB_LINKS } from './navConfig'

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

  expect(container.querySelector('.gt-topbar')).toBeTruthy()
  // The retired two-bar markup must not come back.
  expect(container.querySelector('.gt-appbar')).toBeNull()
  expect(container.querySelector('.gt-admin-topbar')).toBeNull()
  expect(container.querySelector('.gt-admin-brand')).toBeNull()

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
  document.addEventListener('gt-admin-palette:open', onOpen)

  renderTopBar()
  // fireEvent, not .click(): the menu is React state, and a raw DOM click is
  // not wrapped in act(), so the panel never renders before the next query.
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))

  const hint = screen.getByRole('menuitem', { name: /search everything/i })
  expect(hint).toBeInTheDocument()
  fireEvent.click(hint)
  expect(onOpen).toHaveBeenCalledTimes(1)

  document.removeEventListener('gt-admin-palette:open', onOpen)
})

test('the section label appears only when the rail is collapsed', () => {
  // An expanded rail already names the active section a few pixels to the left,
  // so the bar repeating it is a second answer to a question nothing asked.
  // Same rule the member bar follows.
  const expanded = renderTopBar({ railState: 'expanded' })
  expect(expanded.container.querySelector('.gt-topbar__section')).toBeNull()
  expanded.unmount()

  const collapsed = renderTopBar({ railState: 'collapsed' })
  expect(collapsed.container.querySelector('.gt-topbar__section')).toBeTruthy()
})

test('top bar exposes the rail toggle and wires it up', async () => {
  const onToggleRail = vi.fn()
  renderTopBar({ onToggleRail })

  const toggle = screen.getByRole('button', { name: /toggle navigation/i })
  toggle.click()

  expect(onToggleRail).toHaveBeenCalledTimes(1)
})

test('rail lists every admin section', () => {
  const { container } = renderRail()

  for (const link of ADMIN_NAV) {
    expect(container.querySelector(`a[href="${link.path}"]`)).toBeTruthy()
  }
})

test('rail marks the active section', () => {
  const { container } = renderRail({ at: '/admin/ops' })

  const active = container.querySelector('.gt-rail__link.is-active')
  expect(active).toBeTruthy()
  expect(active.getAttribute('href')).toBe('/admin/ops')
})

test('rail expands only the active section, not all sixty destinations', () => {
  const { container } = renderRail({ at: '/admin/ops' })

  // System's hub links are present because System is the active section…
  for (const child of HUB_LINKS.system) {
    expect(container.querySelector(`a[href="${child.href}"]`)).toBeTruthy()
  }

  // …while an inactive section's are not. Listing all of them permanently
  // would trade the overflow menu for a wall of text.
  //
  // Two exclusions, both real rather than convenient: a link shared with the
  // active section is legitimately shown, and a hub link that is *also* an
  // ADMIN_NAV section path (Content's hub lists /admin/discovery_sections,
  // which is Content's own destination) appears as a section link regardless.
  const sectionPaths = new Set(ADMIN_NAV.map((l) => l.path.split('?')[0]))
  const contentOnly = HUB_LINKS.content.filter(
    (c) =>
      !HUB_LINKS.system.some((s) => s.href === c.href) &&
      !sectionPaths.has(c.href.split('?')[0]),
  )

  expect(contentOnly.length).toBeGreaterThan(0)
  for (const child of contentOnly) {
    expect(container.querySelector(`a[href="${child.href}"]`)).toBeNull()
  }
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

test('collapsed rail keeps accessible names and drops sub-links', () => {
  const { container } = renderRail({ at: '/admin/ops', railState: 'collapsed' })

  // Labels stay in the DOM — the stylesheet hides them visually — or the rail
  // becomes a column of unlabelled icons to a screen reader.
  expect(screen.getByRole('link', { name: 'System' })).toBeInTheDocument()
  expect(container.querySelector('.gt-rail__sublist')).toBeNull()
})
