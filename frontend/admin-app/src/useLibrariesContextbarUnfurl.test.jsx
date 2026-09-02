import { render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useLibrariesContextbarUnfurl } from './useLibrariesContextbarUnfurl'
import { ADMIN_TOPBAR_SLOT_ID, LEGACY_CONTENT_ID } from './useLegacyContextbarPortal'

function Harness({ enabled }) {
  useLibrariesContextbarUnfurl(enabled)
  return null
}

function mountChrome() {
  document.body.innerHTML = `
    <div id="${ADMIN_TOPBAR_SLOT_ID}">
      <div class="od-contextbar__views">
        <div class="od-seg" role="tablist">
          <a class="od-seg__item active" href="#librariesPanel" data-bs-toggle="tab">Libraries</a>
          <a class="od-seg__item" href="#autoScan" data-bs-toggle="tab">Auto scan</a>
          <a class="od-seg__item" href="#libraryTools" data-bs-toggle="tab">Library tools</a>
          <a class="od-seg__item" href="#manualScan" data-bs-toggle="tab">Manual scan</a>
        </div>
      </div>
    </div>
    <div id="${LEGACY_CONTENT_ID}">
      <div id="odLibrariesPanel" data-add-url="/admin/library/add"></div>
      <div id="librariesPanel" class="active"></div>
    </div>
  `
}

afterEach(() => {
  document.body.innerHTML = ''
})

test('collapses Libraries / Auto / Manual into Libraries and Scan unfurls', () => {
  mountChrome()
  render(
    <MemoryRouter>
      <Harness enabled />
    </MemoryRouter>,
  )

  const seg = document.querySelector(`#${ADMIN_TOPBAR_SLOT_ID} .od-seg`)
  expect(seg?.dataset.odUnfurlReady).toBe('1')
  const triggers = Array.from(seg.querySelectorAll(':scope > .od-seg__unfurl-anchor > .od-seg__item'))
  expect(triggers.map((el) => el.textContent)).toEqual(['Libraries', 'Scan'])
  expect(seg.querySelector(':scope > a.od-seg__item[href="#libraryTools"]')?.textContent).toBe(
    'Library tools',
  )
  // Auto scan lives inside the Scan unfurl panel, not as a peer seg item.
  expect(seg.querySelector(':scope > a.od-seg__item[href="#autoScan"]')).toBeNull()
  expect(seg.querySelector('.od-contextbar__views-unfurl a[href="#autoScan"]')).toBeTruthy()
  // Libraries trigger already names the view — menu only offers Add library.
  const librariesMenu = seg.querySelectorAll(
    '.od-seg__unfurl-anchor:first-child .od-contextbar__views-unfurl a',
  )
  expect(Array.from(librariesMenu).map((el) => el.textContent)).toEqual(['Add library'])
})
