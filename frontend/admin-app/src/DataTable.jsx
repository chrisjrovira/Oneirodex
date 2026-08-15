import { useMemo, useState } from 'react'
import './DataTable.css'

/**
 * Sortable + filterable admin table (UX-C8).
 *
 * Every admin table was hand-rolled, so sorting and filtering existed on some
 * and not others with no consistent behaviour. This is the one implementation
 * they should all share.
 *
 * columns: [{ key, label, sortable?, filterable?, render?, value?, align? }]
 *   - `value(row)` supplies the sort/filter key when the cell renders markup;
 *     without it we fall back to `row[key]`, so a column that renders a badge
 *     still sorts on the underlying value rather than on "[object Object]".
 *
 * `toolbar={false}` drops the filter box and row count, keeping the shared
 * header, sorting and empty state. Ops panels are the case it exists for: a
 * filter box above three rows of companion kinds is more chrome than content,
 * and without this the only way to avoid it was to hand-roll the table — which
 * is how these panels came to disagree with every other table in the first place.
 */
export function DataTable({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'Nothing to show.',
  initialSort = null,
  dense = false,
  caption,
  toolbar = true,
}) {
  const [sort, setSort] = useState(initialSort) // { key, dir: 'asc' | 'desc' }
  const [query, setQuery] = useState('')

  const cellValue = (column, row) => {
    if (typeof column.value === 'function') {
      return column.value(row)
    }
    return row?.[column.key]
  }

  const filterable = columns.filter((c) => c.filterable !== false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return rows
    }
    return rows.filter((row) =>
      filterable.some((column) => {
        const raw = cellValue(column, row)
        return raw != null && String(raw).toLowerCase().includes(needle)
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, columns])

  const sorted = useMemo(() => {
    if (!sort?.key) {
      return filtered
    }
    const column = columns.find((c) => c.key === sort.key)
    if (!column) {
      return filtered
    }
    const factor = sort.dir === 'desc' ? -1 : 1
    // Copy first — sorting the caller's array in place is a nasty surprise.
    return [...filtered].sort((a, b) => {
      const av = cellValue(column, a)
      const bv = cellValue(column, b)

      // Absent values sort last in both directions; "missing" is not "smallest".
      const aEmpty = av == null || av === ''
      const bEmpty = bv == null || bv === ''
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1

      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * factor
      }
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor
    })
  }, [filtered, sort, columns])

  const toggleSort = (key) => {
    setSort((current) => {
      if (current?.key !== key) {
        return { key, dir: 'asc' }
      }
      if (current.dir === 'asc') {
        return { key, dir: 'desc' }
      }
      return null // third click clears, so a table can go back to source order
    })
  }

  return (
    <div className={`gt-table-wrap${dense ? ' gt-table-wrap--dense' : ''}`}>
      {toolbar ? (
        <div className="gt-table-toolbar">
          <label className="gt-table-filter">
            <span className="gt-table-filter__label">Filter</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to filter…"
              aria-label="Filter table rows"
            />
          </label>
          <span className="gt-table-count" aria-live="polite">
            {query.trim() && filtered.length !== rows.length
              ? `${filtered.length} of ${rows.length}`
              : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
          </span>
        </div>
      ) : null}

      <div className="gt-table-scroll">
        <table className="gt-table">
          {caption ? <caption className="gt-table__caption">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key
                const ariaSort = !active ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending'
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable === false ? undefined : ariaSort}
                    className={column.align ? `is-${column.align}` : undefined}
                  >
                    {column.sortable === false ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        className={`gt-table__sort${active ? ' is-active' : ''}`}
                        onClick={() => toggleSort(column.key)}
                      >
                        {column.label}
                        <span className="gt-table__sort-mark" aria-hidden="true">
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="gt-table__empty">
                  {query.trim() ? `No rows match “${query.trim()}”.` : emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, index) => (
                <tr key={getRowKey ? getRowKey(row, index) : index}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.align ? `is-${column.align}` : undefined}
                    >
                      {column.render ? column.render(row) : cellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
