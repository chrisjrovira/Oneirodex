import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { queueClientCommand } from '../api/clientCommands'
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
  const [busyKey, setBusyKey] = useState(null)
  const [statusByUuid, setStatusByUuid] = useState({})
  const searchRequestId = useRef(0)

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
    const requestId = ++searchRequestId.current
    setSearching(true)
    setSearchError(null)
    setHits(null)
    try {
      const data = await fetchStoreSearch({ q, source })
      if (requestId !== searchRequestId.current) {
        return
      }
      setHits(Array.isArray(data.results) ? data.results : [])
    } catch (err) {
      if (requestId !== searchRequestId.current) {
        return
      }
      setSearchError(err)
    } finally {
      if (requestId === searchRequestId.current) {
        setSearching(false)
      }
    }
  }

  async function applyPack(game, pack) {
    if (!pack?.uuid) {
      return
    }
    const key = `${game.uuid}:${pack.uuid}`
    setBusyKey(key)
    try {
      await queueClientCommand(game.uuid, 'update', {
        kind: pack.kind,
        versionUuid: pack.uuid,
      })
      setStatusByUuid((prev) => ({
        ...prev,
        [game.uuid]: `${pack.kind} queued for companion`,
      }))
      if (window.$?.notify) {
        window.$.notify(`${pack.label} queued for companion`, 'success')
      }
    } catch (err) {
      setStatusByUuid((prev) => ({
        ...prev,
        [game.uuid]: err?.message || 'Failed to queue apply',
      }))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="gt-more-page gt-updates">
      <div className="gt-page-header">
        <h1>Updates</h1>
      </div>
      <p className="gt-more-page__lede">
        Library titles that look behind store versions. Download local Update/DLC packs from your
        library, or queue the companion to apply them. Store search is discovery-only (Steam / GOG
        links).
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
          <ul className="gt-updates__list gt-updates__inbox-list">
            {items.map((game) => {
              const pack = game.latest_update || game.latest_extra
              const applyKey = pack ? `${game.uuid}:${pack.uuid}` : null
              return (
                <li key={game.uuid} className="gt-updates__inbox-item">
                  <div className="gt-updates__inbox-main">
                    <Link to={`/game_details/${game.uuid}`}>
                      <strong>{game.name}</strong>
                    </Link>
                    <span>
                      {[
                        game.freshness_status,
                        `${game.local_version || 'local?'} → ${game.remote_version_summary || 'store?'}`,
                        game.updates_count
                          ? `${game.updates_count} local update${game.updates_count === 1 ? '' : 's'}`
                          : null,
                        game.dlc?.missing_count != null
                          ? `DLC gap ${game.dlc.missing_count}`
                          : game.dlc?.store_count != null
                            ? `Store DLC ${game.dlc.store_count}`
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {statusByUuid[game.uuid] ? (
                      <span className="gt-updates__status" role="status">
                        {statusByUuid[game.uuid]}
                      </span>
                    ) : null}
                  </div>
                  <div className="gt-updates__inbox-actions">
                    {pack?.download_url ? (
                      <a className="gt-btn" href={pack.download_url}>
                        Download {pack.kind}
                      </a>
                    ) : null}
                    {pack && game.client_connected ? (
                      <button
                        type="button"
                        className="gt-btn"
                        disabled={busyKey === applyKey}
                        onClick={() => {
                          void applyPack(game, pack)
                        }}
                      >
                        {busyKey === applyKey ? 'Queuing…' : 'Apply with companion'}
                      </button>
                    ) : null}
                    <Link className="gt-btn" to={`/game_details/${game.uuid}`}>
                      Details
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
