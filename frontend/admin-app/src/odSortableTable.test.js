/**
 * Coverage for the classic-side sortable table (UX-C8 · W27-C1 · W27-C2).
 *
 * The module under test is *not* part of this SPA — it is classic theme JS at
 * `oneirodex/setup/default_theme/js/od_sortable_table.js`, loaded by base.html
 * and base_admin.html. It is tested from here because this is the only
 * CI-gated JavaScript runner in the repo with a real DOM, and the behaviour
 * that most needs testing (re-sorting after a poller replaces the rows) is a
 * MutationObserver, which a hand-rolled micro-DOM would only pretend to have.
 *
 * `tests/js/` holds one older harness that runs under bare node with its own
 * micro-DOM. It is not in any workflow, so it gates nothing.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'

// fileURLToPath rather than import.meta.dirname: CI pins Node 20, where that
// property only exists from 20.11.
const HERE = dirname(fileURLToPath(import.meta.url))

const SCRIPT = readFileSync(
  join(
    HERE,
    '..',
    '..',
    '..',
    'oneirodex',
    'setup',
    'default_theme',
    'js',
    'od_sortable_table.js',
  ),
  'utf8',
)

/** Evaluate the classic script against the current jsdom document. */
function loadScript() {
  // eslint-disable-next-line no-eval
  ;(0, eval)(SCRIPT)
}

const HEAD = `
  <thead>
    <tr>
      <th data-sort-key="library">Library</th>
      <th data-sort-key="progress">Progress</th>
      <th>Actions</th>
    </tr>
  </thead>`

function table(bodyRows) {
  document.body.innerHTML = `
    <table id="t" data-od-sortable>
      ${HEAD}
      <tbody id="tb">${bodyRows}</tbody>
    </table>`
}

const ROW = (library, progress, text) =>
  `<tr data-sort-progress="${progress}"><td>${library}</td><td>${text ?? progress}</td><td>—</td></tr>`

const libraries = () =>
  Array.from(document.querySelectorAll('#tb tr')).map((r) => r.children[0]?.textContent)

function clickHeader(index) {
  document.querySelectorAll('#t thead th')[index].querySelector('.od-sort-btn').click()
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('auto-wiring', () => {
  it('builds header controls without the page calling anything', () => {
    table(ROW('Retro', 10))
    loadScript()

    const headers = document.querySelectorAll('#t thead th')
    expect(headers[0].querySelector('.od-sort-btn__label').textContent).toBe('Library')
    expect(headers[0].getAttribute('aria-sort')).toBe('none')
  })

  it('preserves markup already inside the header cell', () => {
    // Header cells here routinely hold an icons.icon() macro's <svg>. Rebuilding
    // the cell from textContent would drop it silently — no error, just a
    // missing icon nobody connects to the sort feature.
    document.body.innerHTML = `
      <table id="t" data-od-sortable>
        <thead><tr><th data-sort-key="library"><svg class="ic"></svg>Library</th></tr></thead>
        <tbody id="tb"><tr><td>Retro</td></tr></tbody>
      </table>`
    loadScript()

    const label = document.querySelector('#t thead th .od-sort-btn__label')
    expect(label.querySelector('svg.ic')).not.toBeNull()
    expect(label.textContent).toBe('Library')
  })

  it('leaves a column without a sort key inert', () => {
    table(ROW('Retro', 10))
    loadScript()

    const actions = document.querySelectorAll('#t thead th')[2]
    expect(actions.querySelector('.od-sort-btn')).toBeNull()
    expect(actions.hasAttribute('aria-sort')).toBe(false)
  })
})

describe('three-state toggle', () => {
  beforeEach(() => {
    table(ROW('Nintendo', 1) + ROW('Arcade', 2) + ROW('Mega Drive', 3))
    loadScript()
  })

  it('sorts ascending, then descending, then returns to arrival order', () => {
    clickHeader(0)
    expect(libraries()).toEqual(['Arcade', 'Mega Drive', 'Nintendo'])
    expect(document.querySelectorAll('#t thead th')[0].getAttribute('aria-sort')).toBe('ascending')

    clickHeader(0)
    expect(libraries()).toEqual(['Nintendo', 'Mega Drive', 'Arcade'])
    expect(document.querySelectorAll('#t thead th')[0].getAttribute('aria-sort')).toBe('descending')

    clickHeader(0)
    // Arrival order is the server's own ranking (busy jobs first), so clearing
    // has to restore it rather than freeze the last sort.
    expect(libraries()).toEqual(['Nintendo', 'Arcade', 'Mega Drive'])
    expect(document.querySelectorAll('#t thead th')[0].getAttribute('aria-sort')).toBe('none')
  })

  it('moves the active marker when a different column is clicked', () => {
    clickHeader(0)
    clickHeader(1)

    const [library, progress] = document.querySelectorAll('#t thead th')
    expect(library.getAttribute('aria-sort')).toBe('none')
    expect(progress.getAttribute('aria-sort')).toBe('ascending')
    expect(library.querySelector('.od-sort-btn').classList.contains('is-active')).toBe(false)
    expect(progress.querySelector('.od-sort-btn').classList.contains('is-active')).toBe(true)
  })
})

describe('declared default order', () => {
  const withDefault = (dir) => `
    <table id="t" data-od-sortable data-od-sort-default="library"${
      dir ? ` data-od-sort-dir="${dir}"` : ''
    }>
      ${HEAD}
      <tbody id="tb">${ROW('Nintendo', 1) + ROW('Arcade', 2)}</tbody>
    </table>`

  it('sorts on load without the page asking', () => {
    document.body.innerHTML = withDefault()
    loadScript()

    expect(libraries()).toEqual(['Arcade', 'Nintendo'])
    expect(document.querySelectorAll('#t thead th')[0].getAttribute('aria-sort')).toBe('ascending')
  })

  it('honours a declared descending direction', () => {
    document.body.innerHTML = withDefault('desc')
    loadScript()

    expect(libraries()).toEqual(['Nintendo', 'Arcade'])
  })

  it('re-applies the default after the body is re-rendered', async () => {
    // The unmatched table re-fetches and rebuilds its rows. It used to call its
    // own sorter afterwards; now nothing does, so the observer has to.
    document.body.innerHTML = withDefault()
    loadScript()

    const body = document.getElementById('tb')
    body.innerHTML = ''
    ;['Zed', 'Beta'].forEach((name) => {
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${name}</td><td>1</td><td>—</td>`
      body.appendChild(tr)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(libraries()).toEqual(['Beta', 'Zed'])
  })
})

describe('compare rules — parity with DataTable.jsx', () => {
  it('sorts progress numerically, not as text', () => {
    // The whole reason the Progress column carries a data-sort key: as text,
    // "10/25" sorts before "9/25".
    table(ROW('A', 9, '9/25') + ROW('B', 10, '10/25') + ROW('C', 100, '100/25'))
    loadScript()
    clickHeader(1)

    expect(libraries()).toEqual(['A', 'B', 'C'])
  })

  it('puts absent values last in both directions', () => {
    table(ROW('Has', 5) + `<tr data-sort-progress=""><td>Empty</td><td></td><td>—</td></tr>`)
    loadScript()

    clickHeader(1)
    expect(libraries()).toEqual(['Has', 'Empty'])

    clickHeader(1)
    expect(libraries()).toEqual(['Has', 'Empty'])
  })
})

describe('furniture rows', () => {
  it('keeps a full-width empty-state row out of the sort and at the bottom', () => {
    table(
      ROW('Zed', 1) +
        ROW('Alpha', 2) +
        `<tr class="jobs-empty-row"><td colspan="3">No scan jobs yet.</td></tr>`,
    )
    loadScript()
    clickHeader(0)

    const rows = Array.from(document.querySelectorAll('#tb tr'))
    expect(rows[0].children[0].textContent).toBe('Alpha')
    expect(rows[1].children[0].textContent).toBe('Zed')
    expect(rows[2].className).toBe('jobs-empty-row')
  })
})

describe('polled tables', () => {
  it('re-applies the active sort after the poller replaces every row', async () => {
    table(ROW('Nintendo', 1) + ROW('Arcade', 2))
    loadScript()
    clickHeader(0)
    expect(libraries()).toEqual(['Arcade', 'Nintendo'])

    // Exactly what admin_manage_scanjobs.js does on each poll.
    const body = document.getElementById('tb')
    body.innerHTML = ''
    ;['Zed', 'Beta'].forEach((name) => {
      const tr = document.createElement('tr')
      tr.setAttribute('data-sort-progress', '1')
      tr.innerHTML = `<td>${name}</td><td>1</td><td>—</td>`
      body.appendChild(tr)
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Without the observer this reads ['Zed', 'Beta'] — the sort silently
    // reverting seconds after the click, which looks broken rather than absent.
    expect(libraries()).toEqual(['Beta', 'Zed'])
  })

  it('leaves poller order alone once the sort is cleared', async () => {
    table(ROW('Nintendo', 1) + ROW('Arcade', 2))
    loadScript()
    clickHeader(0)
    clickHeader(0)
    clickHeader(0) // cleared

    const body = document.getElementById('tb')
    body.innerHTML = ''
    ;['Zed', 'Beta'].forEach((name) => {
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${name}</td><td>1</td><td>—</td>`
      body.appendChild(tr)
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(libraries()).toEqual(['Zed', 'Beta'])
  })
})
