import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSavedFilters, type SavedFilter } from '../api/savedFilters'

/**
 * Saved filters that asked to be shelves (INSP-29).
 *
 * A smart collection is not a second kind of thing: it is a saved filter with
 * `is_collection` set, so it stays answerable by the same query that built it
 * and cannot go stale the way a hand-curated shelf does when the library
 * grows. Opening one is a link into the catalog with its tree applied, which
 * is why `LibraryApp` had to learn to read `filter_tree` from the URL.
 *
 * It renders nothing at all when a member has none — an empty "Smart
 * collections" heading over blank space is chrome explaining a feature nobody
 * asked for yet.
 */
export function SmartCollections({ t = (key: string) => key }: { t?: (key: string) => string }) {
  const [rows, setRows] = useState<SavedFilter[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetchSavedFilters(controller.signal)
      .then((all) => setRows(all.filter((row) => row.is_collection)))
      .catch(() => {
        // Having none is the common case, not an error worth a banner on a
        // page whose real content is the manual shelves below.
      })
    return () => controller.abort()
  }, [])

  if (rows.length === 0) return null

  return (
    <section className="od-smart-collections">
      <h2 className="od-smart-collections__head">{t('Smart collections')}</h2>
      <p className="od-smart-collections__lede">
        {t('Saved filters, kept up to date by the question rather than by hand.')}
      </p>
      <ul className="od-smart-collections__list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              className="od-collections__card"
              to={`/library?filter_tree=${encodeURIComponent(JSON.stringify(row.tree))}`}
            >
              <strong>{row.name}</strong>
              <span className="od-collections__card-desc">{t('Filter')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
