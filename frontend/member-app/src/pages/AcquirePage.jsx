import { useEffect, useState } from 'react'
import { fetchAcquireStatus, searchAcquire } from '../api/updates'

function csrfToken() {
  return (
    document.querySelector('meta[name="csrf-token"]')?.content ||
    document.querySelector('input[name="csrf_token"]')?.value ||
    ''
  )
}

export function AcquirePage() {
  const [status, setStatus] = useState(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchAcquireStatus()
      .then(setStatus)
      .catch((err) => setError(err))
  }, [])

  async function onSearch(event) {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await searchAcquire(q)
      setHits(Array.isArray(data.results) ? data.results : [])
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function sendHit(hit, provider) {
    setBusy(true)
    try {
      const response = await fetch('/api/acquire/download', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken(),
        },
        body: JSON.stringify({
          url: hit.download_url || hit.magnet || hit.info_url,
          provider,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || `acquire ${response.status}`)
      }
      if (window.$?.notify) {
        window.$.notify(`Sent to ${provider}`, 'success')
      }
    } catch (err) {
      if (window.$?.notify) {
        window.$.notify(err?.message || 'Send failed', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Acquire</h1>
      </div>
      <p className="gt-more-page__lede">
        BYO acquisition via admin-configured indexers / debrid. GameTheca does not host torrents.
      </p>
      {status ? (
        <p>
          Arr: {status.arr_enabled ? 'on' : 'off'} · Debrid: {status.debrid_enabled ? 'on' : 'off'} ·
          Send: {status.can_send ? 'allowed' : 'librarian only'}
        </p>
      ) : null}
      {error ? <p role="alert">{String(error.message || error)}</p> : null}
      {!status?.enabled ? (
        <p>Enable ENABLE_ARR_MODULE and/or ENABLE_DEBRID to use this page.</p>
      ) : (
        <form className="gt-updates__search-form" onSubmit={onSearch}>
          <label>
            Search indexers
            <input value={query} onChange={(e) => setQuery(e.target.value)} required />
          </label>
          <button className="gt-btn" type="submit" disabled={busy || !status.arr_enabled}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </form>
      )}
      {hits && hits.length === 0 ? <p>No indexer hits.</p> : null}
      {hits && hits.length > 0 ? (
        <ul className="gt-updates__list">
          {hits.map((hit, index) => (
            <li key={`${hit.title}-${index}`}>
              <strong>{hit.title}</strong>
              <span>
                {[hit.indexer, hit.seeders != null ? `${hit.seeders} seeders` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {status?.can_send ? (
                <div className="gt-updates__inbox-actions">
                  <button
                    type="button"
                    className="gt-btn"
                    disabled={busy}
                    onClick={() => void sendHit(hit, 'qbittorrent')}
                  >
                    Send qBit
                  </button>
                  <button
                    type="button"
                    className="gt-btn"
                    disabled={busy || !status.debrid_enabled}
                    onClick={() => void sendHit(hit, 'real_debrid')}
                  >
                    Real-Debrid
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
