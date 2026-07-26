import { useEffect, useState } from 'react'
import { fetchAcquireStatus, searchAcquire } from '../api/updates'

function csrfToken() {
  return (
    document.querySelector('meta[name="csrf-token"]')?.content ||
    document.querySelector('input[name="csrf_token"]')?.value ||
    ''
  )
}

const CLIENT_BUTTONS = [
  { id: 'qbittorrent', label: 'qBit' },
  { id: 'transmission', label: 'Transmission' },
  { id: 'sabnzbd', label: 'SABnzbd' },
  { id: 'nzbget', label: 'NZBGet' },
]

const DEBRID_BUTTONS = [
  { id: 'real_debrid', label: 'Real-Debrid' },
  { id: 'alldebrid', label: 'AllDebrid' },
  { id: 'premiumize', label: 'Premiumize' },
  { id: 'torbox', label: 'TorBox' },
]

function formatSize(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return null
  const gib = bytes / 1024 ** 3
  if (gib >= 1) return `${gib.toFixed(1)} GiB`
  const mib = bytes / 1024 ** 2
  return `${mib.toFixed(0)} MiB`
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

  const clients = new Set(status?.clients || [])

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
        Results are ranked by score (seeders, repack/quality cues).
      </p>
      {status ? (
        <p>
          Arr: {status.arr_enabled ? 'on' : 'off'} · Debrid: {status.debrid_enabled ? 'on' : 'off'} ·
          Send: {status.can_send ? 'allowed' : 'librarian only'} · Clients:{' '}
          {(status.clients || []).join(', ') || '—'}
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
                {[
                  hit.score != null ? `score ${hit.score}` : null,
                  hit.is_repack ? 'repack' : null,
                  hit.newer_repack ? 'newer repack?' : null,
                  hit.indexer,
                  hit.seeders != null ? `${hit.seeders} seeders` : null,
                  formatSize(hit.size),
                  hit.protocol,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {hit.score_reasons?.length ? (
                <span className="gt-more-page__lede">{hit.score_reasons.join(', ')}</span>
              ) : null}
              {status?.can_send ? (
                <div className="gt-updates__inbox-actions">
                  {CLIENT_BUTTONS.filter((c) => clients.has(c.id)).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="gt-btn"
                      disabled={busy}
                      onClick={() => void sendHit(hit, c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                  {status.debrid_enabled
                    ? DEBRID_BUTTONS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className="gt-btn"
                          disabled={busy}
                          onClick={() => void sendHit(hit, d.id)}
                        >
                          {d.label}
                        </button>
                      ))
                    : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
