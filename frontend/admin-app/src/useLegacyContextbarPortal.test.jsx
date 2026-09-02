import { render } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

function mountLegacyWithContextbar() {
  const root = document.createElement('div')
  root.id = 'admin-app-root'
  root.dataset.adminRender = 'legacy'
  document.body.appendChild(root)

  const legacy = document.createElement('div')
  legacy.id = 'admin-legacy-content'
  legacy.innerHTML = `
    <div class="od-contextbar">
      <div class="od-contextbar__views">
        <div class="od-seg" role="tablist" aria-label="Views">
          <a class="od-seg__item active" href="#librariesPanel" data-bs-toggle="tab">Libraries</a>
          <a class="od-seg__item" href="#autoScan" data-bs-toggle="tab">Auto scan</a>
        </div>
      </div>
      <div class="od-contextbar__actions">
        <span class="od-contextbar__count">60 libraries · 7513 games</span>
      </div>
    </div>
    <div class="od-adminpage"><form><table><tr><td>Legacy body with enough text for the auto heuristic floor.</td></tr></table></form></div>
  `
  document.body.appendChild(legacy)

  return { root, legacy }
}

afterEach(() => {
  document.getElementById('admin-app-root')?.remove()
  document.getElementById('admin-legacy-content')?.remove()
})

test('legacy Jinja contextbar splits views to centre and count to trail', () => {
  const { legacy } = mountLegacyWithContextbar()
  render(
    <MemoryRouter initialEntries={['/scan_management']}>
      <App />
    </MemoryRouter>,
  )

  const page = document.getElementById('od-admin-topbar-slot')
  const trail = document.getElementById('od-admin-topbar-trail')
  expect(page).toBeTruthy()
  expect(trail).toBeTruthy()

  expect(page.querySelector('.od-contextbar__views')).toBeTruthy()
  expect(page.querySelector('.od-seg')).toHaveTextContent('Libraries')
  expect(page.querySelector('.od-contextbar__count')).toBeNull()

  expect(trail.querySelector('.od-contextbar__count')).toHaveTextContent(
    '60 libraries · 7513 games',
  )
  expect(legacy.querySelector('.od-contextbar')).toBeNull()
})

test('SPA pages leave a Jinja contextbar in legacy content (parked)', () => {
  const root = document.createElement('div')
  root.id = 'admin-app-root'
  root.dataset.adminRender = 'spa'
  document.body.appendChild(root)

  const legacy = document.createElement('div')
  legacy.id = 'admin-legacy-content'
  legacy.innerHTML = `
    <div class="od-contextbar"><span class="od-contextbar__count">should stay</span></div>
  `
  document.body.appendChild(legacy)

  render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <App />
    </MemoryRouter>,
  )

  expect(legacy.querySelector('.od-contextbar')).toBeTruthy()
  expect(
    document.getElementById('od-admin-topbar-slot')?.querySelector('.od-contextbar__views'),
  ).toBeNull()
})
