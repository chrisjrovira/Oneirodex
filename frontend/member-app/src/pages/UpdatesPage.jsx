import { useEffect, useState } from 'react'
import { fetchStoreSearch, fetchUpdatesInbox } from '../api/updates'

export function UpdatesPage() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState(null)
  const [searchError, setSearchError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setItems(null)

    fetchUpdatesInbox({ signal: controller.signal, limit: 100 })
      .then((data) => {
        if (active) {
          setItems(Array.isArray(data.items) ? data.items : [])
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  async function handleSearch(event) {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      return
    }
    setSearching(true)
    setSearchError(null)
    setHits(null)
    try {
      const data = await fetchStoreSearch({ q, source })
      setHits(Array.isArray(data.results) ? data.results : [])
    } catch (err) {
      setSearchError(err)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="gt-more-page gt-updates">
      <div className="gt-page-header">
        <h1>Updates</h1>
      </div>
      <p className="gt-more-page__lede">
        Library titles that look behind store versions, plus a store search to check Steam / GOG
        for updates and DLC.
      </p>

      <section className="gt-updates__search gt-glass-panel">
        <h2>Search stores</h2>
        <form className="gt-updates__search-form" onSubmit={handleSearch}>
          <label>
            Game name
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Hades II"
              required
            />
          </label>
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">Steam + GOG</option>
              <option value="steam">Steam</option>
              <option value="gog">GOG</option>
            </select>
          </label>
          <button className="gt-btn" type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchError ? (
          <p role="alert">Store search failed: {String(searchError.message || searchError)}</p>
        ) : null}
        {hits && hits.length === 0 ? <p>No store hits.</p> : null}
        {hits && hits.length > 0 ? (
          <ul className="gt-updates__list">
            {hits.map((hit, index) => (
              <li key={`${hit.source}-${hit.steam_app_id || hit.gog_id || hit.url || index}`}>
                {hit.url ? (
                  <a href={hit.url} target="_blank" rel="noreferrer">
                    <strong>{hit.name}</strong>
                    <span>{hit.source}</span>
                  </a>
                ) : (
                  <>
                    <strong>{hit.name}</strong>
                    <span>{hit.source}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="gt-updates__inbox">
        <h2>Library freshness inbox</h2>
        {error ? (
          <div role="alert">
            <p>Unable to load updates.</p>
            <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {!error && !items ? <p>Loading…</p> : null}

        {!error && items && items.length === 0 ? (
          <p>No outdated titles detected. Nice.</p>
        ) : null}

        {!error && items && items.length > 0 ? (
          <ul className="gt-updates__list">
            {items.map((game) => (
              <li key={game.uuid}>
                <a href={`/game_details/${game.uuid}`}>
                  <strong>{game.name}</strong>
                  <span>
                    {[
                      game.freshness_status,
                      `${game.local_version || 'local?'} → ${game.remote_version_summary || 'store?'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
