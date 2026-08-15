import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { DataTable } from './DataTable'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size', align: 'right' },
  { key: 'note', label: 'Note', sortable: false },
]

const ROWS = [
  { id: 1, name: 'Zelda', size: 30, note: 'cart' },
  { id: 2, name: 'Astro', size: 200, note: 'disc' },
  { id: 3, name: 'Mario', size: 9, note: 'cart' },
]

function renderTable(props = {}) {
  return render(
    <DataTable columns={COLUMNS} rows={ROWS} getRowKey={(r) => r.id} {...props} />,
  )
}

function bodyNames() {
  const body = screen.getAllByRole('rowgroup')[1]
  return within(body)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent)
}

test('renders source order until asked to sort', () => {
  renderTable()
  expect(bodyNames()).toEqual(['Zelda', 'Astro', 'Mario'])
})

test('sorts ascending, then descending, then clears', () => {
  renderTable()
  const header = screen.getByRole('button', { name: /Name/ })

  fireEvent.click(header)
  expect(bodyNames()).toEqual(['Astro', 'Mario', 'Zelda'])

  fireEvent.click(header)
  expect(bodyNames()).toEqual(['Zelda', 'Mario', 'Astro'])

  fireEvent.click(header)
  expect(bodyNames()).toEqual(['Zelda', 'Astro', 'Mario'])
})

test('sorts numbers numerically, not as text', () => {
  renderTable()
  fireEvent.click(screen.getByRole('button', { name: /Size/ }))
  // Text sort would put 200 before 30.
  expect(bodyNames()).toEqual(['Mario', 'Zelda', 'Astro'])
})

test('exposes sort state to assistive tech', () => {
  renderTable()
  fireEvent.click(screen.getByRole('button', { name: /Name/ }))
  expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
})

test('columns can opt out of sorting', () => {
  renderTable()
  expect(screen.queryByRole('button', { name: /Note/ })).not.toBeInTheDocument()
})

test('filters across columns and reports the reduced count', () => {
  renderTable()
  fireEvent.change(screen.getByLabelText(/Filter table rows/i), { target: { value: 'cart' } })
  expect(bodyNames()).toEqual(['Zelda', 'Mario'])
  expect(screen.getByText('2 of 3')).toBeInTheDocument()
})

test('says so when a filter matches nothing', () => {
  renderTable()
  fireEvent.change(screen.getByLabelText(/Filter table rows/i), { target: { value: 'zzz' } })
  expect(screen.getByText(/No rows match/i)).toBeInTheDocument()
})

test('honest empty state with no rows at all', () => {
  renderTable({ rows: [], emptyMessage: 'No libraries yet.' })
  expect(screen.getByText('No libraries yet.')).toBeInTheDocument()
})

test('sorts on value() when a cell renders markup', () => {
  const columns = [
    {
      key: 'name',
      label: 'Name',
      value: (row) => row.name,
      render: (row) => <strong>{row.name}</strong>,
    },
  ]
  render(<DataTable columns={columns} rows={ROWS} getRowKey={(r) => r.id} />)
  fireEvent.click(screen.getByRole('button', { name: /Name/ }))
  expect(bodyNames()).toEqual(['Astro', 'Mario', 'Zelda'])
})

test('missing values sort last in both directions', () => {
  const rows = [
    { id: 1, name: 'Has', size: 5 },
    { id: 2, name: 'Missing', size: null },
    { id: 3, name: 'Also', size: 1 },
  ]
  render(<DataTable columns={COLUMNS} rows={rows} getRowKey={(r) => r.id} />)
  const header = screen.getByRole('button', { name: /Size/ })

  fireEvent.click(header)
  expect(bodyNames()).toEqual(['Also', 'Has', 'Missing'])

  fireEvent.click(header)
  expect(bodyNames()).toEqual(['Has', 'Also', 'Missing'])
})

test('does not mutate the caller rows array', () => {
  const rows = [...ROWS]
  const snapshot = [...rows]
  render(<DataTable columns={COLUMNS} rows={rows} getRowKey={(r) => r.id} />)
  fireEvent.click(screen.getByRole('button', { name: /Name/ }))
  expect(rows).toEqual(snapshot)
})

test('toolbar={false} drops the filter and count but keeps sorting', () => {
  // Ops panels carry three or four rows. A filter box over them is chrome in
  // front of the content, and hand-rolling the table to avoid it is exactly
  // how those panels came to disagree with every other table.
  renderTable({ toolbar: false })

  expect(screen.queryByLabelText('Filter table rows')).toBeNull()
  expect(screen.queryByText(/^3 rows$/)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /Name/ }))
  expect(bodyNames()).toEqual(['Astro', 'Mario', 'Zelda'])
})

test('the toolbar is there unless asked otherwise', () => {
  renderTable()
  expect(screen.getByLabelText('Filter table rows')).toBeTruthy()
})

test('toolbar={false} still reports an empty table', () => {
  // The empty state is the half of the toolbar that must not go: a panel with
  // no rows and no message reads as a panel that failed to load.
  render(
    <DataTable
      columns={COLUMNS}
      rows={[]}
      getRowKey={(r) => r.id}
      toolbar={false}
      emptyMessage="No companions registered."
    />,
  )
  expect(screen.getByText('No companions registered.')).toBeTruthy()
})
