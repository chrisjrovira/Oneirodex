import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AdminTopNav } from './AdminTopNav'

afterEach(() => {
  delete document.documentElement.dataset.chrome
})

function renderNav({ newChrome = false, at = '/admin/ops' } = {}) {
  if (newChrome) document.documentElement.dataset.chrome = 'v2'
  return render(
    <MemoryRouter initialEntries={[at]}>
      <AdminTopNav />
    </MemoryRouter>,
  )
}

test('old chrome keeps admin bar one exactly as it was', () => {
  const { container } = renderNav()
  expect(container.querySelector('.gt-admin-topbar')).toBeTruthy()
  expect(container.querySelector('.gt-appbar')).toBeNull()
  // Breadcrumb buttons are part of the old bar and must not disappear with it.
  // Scoped to the actions region: ADMIN_NAV also has a Dashboard *destination*,
  // and matching on the name alone conflates the two.
  const actions = container.querySelector('.gt-admin-actions')
  expect(actions.querySelector('a[href="/admin/dashboard"]')).toBeTruthy()
  // Not asserting the section-home link here: at /admin/ops it is the section
  // home, and the old bar already suppresses a link to the page you are on.
})

test('new chrome emits the same classes the member bar one uses', () => {
  // Admin and member bar one were structurally identical with different class
  // names — which is why no amount of styling could make them match. The
  // shared stylesheet is what makes them the same bar (UIR-4).
  const { container } = renderNav({ newChrome: true })
  expect(container.querySelector('.gt-appbar')).toBeTruthy()
  expect(container.querySelector('.gt-appbar__brand')).toBeTruthy()
  expect(container.querySelector('.gt-appbar__nav')).toBeTruthy()
  expect(container.querySelector('.gt-admin-topbar')).toBeNull()
})

test('new chrome drops admin breadcrumbs but keeps the ways out', () => {
  // Same call as the member bar: bar two names the section, so repeating it
  // here is duplication. Library and Log out leave the admin app entirely and
  // nothing else offers them.
  //
  // Only the *breadcrumb* copies go. Dashboard is still a destination in
  // ADMIN_NAV and must stay there — the point is that bar one stops saying it
  // twice, not that it stops offering it.
  const { container } = renderNav({ newChrome: true, at: '/admin/ops' })
  const actions = container.querySelector('.gt-appbar__tools')
  expect(actions.querySelector('a[href="/admin/dashboard"]')).toBeNull()
  expect(actions.querySelector('a[href="/admin/ops"]')).toBeNull()
  expect(screen.getByRole('link', { name: 'Library' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Log out' })).toBeInTheDocument()
  // …and the destination survives in the nav.
  const nav = container.querySelector('.gt-appbar__nav')
  expect(nav.querySelector('a[href="/admin/dashboard"]')).toBeTruthy()
})

test('the active destination is marked with the shared active class', () => {
  const { container } = renderNav({ newChrome: true })
  const active = container.querySelector('.gt-appbar__link.is-active')
  expect(active).toBeTruthy()
})
