import { render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useLibrariesContextbarUnfurl } from './useLibrariesContextbarUnfurl'
import { ADMIN_TOPBAR_SLOT_ID } from './useLegacyContextbarPortal'

function Harness({ enabled }) {
  useLibrariesContextbarUnfurl(enabled)
  return null
}

afterEach(() => {
  document.body.innerHTML = ''
})

test('leaves a flat Auto | Manual strip alone (no Scan unfurl)', () => {
  document.body.innerHTML = `
    <div id="${ADMIN_TOPBAR_SLOT_ID}">
      <div class="od-contextbar__views">
        <div class="od-seg" role="group">
          <a class="od-seg__item is-active" href="/scan_management?active_tab=auto">Auto</a>
          <a class="od-seg__item" href="/scan_management?active_tab=manual">Manual</a>
        </div>
      </div>
    </div>
  `
  const before = document.querySelector(`#${ADMIN_TOPBAR_SLOT_ID} .od-seg`)?.innerHTML

  render(
    <MemoryRouter>
      <Harness enabled />
    </MemoryRouter>,
  )

  const seg = document.querySelector(`#${ADMIN_TOPBAR_SLOT_ID} .od-seg`)
  expect(seg?.dataset.odUnfurlReady).toBeUndefined()
  expect(seg?.querySelector('.od-seg__unfurl-anchor')).toBeNull()
  expect(seg?.innerHTML).toBe(before)
  expect(
    Array.from(seg.querySelectorAll(':scope > a.od-seg__item')).map((el) => el.textContent),
  ).toEqual(['Auto', 'Manual'])
})
