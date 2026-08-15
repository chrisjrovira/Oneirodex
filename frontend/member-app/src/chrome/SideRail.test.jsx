import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'

import { SideRail } from './SideRail'
import { getMoreGroups, getPrimaryLinks } from './navConfig'

/**
 * The rail's whole justification is that nothing is hidden (GT-B2).
 *
 * The old top bar held five destinations and pushed eighteen into a "More"
 * dropdown; the rail exists to make all twenty-three reachable in one place. If
 * a destination stops appearing here, the redesign has silently regressed to
 * the thing it replaced — so completeness is asserted against navConfig rather
 * than against a hand-written list that could drift with it.
 */

function renderRail(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <SideRail shellConfig={{ showTrailers: true, showHelp: true, enableVr: true }} {...props} />
    </MemoryRouter>,
  )
}

test('every primary destination is present', () => {
  const { container } = renderRail()

  for (const link of getPrimaryLinks()) {
    expect(container.querySelector(`a[href="${link.to}"]`)).toBeTruthy()
  }
})

test('every former More-menu destination is present, ungated by an overflow', () => {
  const { container } = renderRail()
  const groups = getMoreGroups({ showTrailers: true, showHelp: true, enableVr: true })

  expect(groups.length).toBeGreaterThan(0)
  for (const group of groups) {
    for (const link of group.links) {
      if (link.action) {
        // Panel openers are buttons, not links, but still must be offered.
        expect(screen.getByRole('button', { name: link.label })).toBeInTheDocument()
      } else {
        expect(container.querySelector(`a[href="${link.to}"]`)).toBeTruthy()
      }
    }
  }
})

test('no overflow control survives in the rail', () => {
  renderRail()
  expect(screen.queryByRole('button', { name: /^more$/i })).toBeNull()
})

test('panel destinations call back instead of routing', () => {
  const onNavigate = vi.fn()
  renderRail({ onNavigate })

  screen.getByRole('button', { name: 'Chat' }).click()

  expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ action: 'open-chat' }))
})

test('admin entry appears only for admins', () => {
  const plain = renderRail({ shellConfig: {} })
  expect(plain.container.querySelector('a[href="/admin/dashboard"]')).toBeNull()
  plain.unmount()

  const admin = renderRail({ shellConfig: { isAdmin: true } })
  expect(admin.container.querySelector('a[href="/admin/dashboard"]')).toBeTruthy()
})

test('collapsed rail keeps labels in the accessibility tree', () => {
  // Hiding them with display:none would leave a column of unnamed icons; the
  // stylesheet clips them visually instead, so the names must still be here.
  renderRail({ railState: 'collapsed' })

  expect(screen.getByRole('link', { name: 'Library' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Wishlist' })).toBeInTheDocument()
})
