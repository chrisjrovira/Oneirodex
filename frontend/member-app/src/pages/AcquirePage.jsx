import { useEffect, useState } from 'react'
import { csrfHeaders } from '../api/csrf'
import { errorFromBody } from '../api/envelopeError'
import { fetchAcquireStatus, searchAcquire } from '../api/updates'
import { PageStatus } from '../components/PageStatus'
import { showToast } from '../utils/toast'

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

/** True when status explicitly says no native/hub indexers are ready. */
function indexersNotReady(status) {
  if (!status?.arr_enabled) return false
  if (typeof status.indexers_ready === 'boolean') return !status.indexers_ready
  if (typeof status.native_ready === 'boolean' || typeof status.hubs_ready === 'boolean') {
    return !(status.native_ready || status.hubs_ready)
  }
  if (typeof status.can_search === 'boolean') return !status.can_search
  return false
}

export function AcquirePage() {
  const [status, setStatus] = useState(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetchAcquireStatus({ signal: controller.signal })
      .then(setStatus)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err)
      })
    return () => controller.abort()
  }, [retryCount])

  const clients = new Set(status?.clients || [])
  const noIndexersReady = indexersNotReady(status)
  const statusWarnings = Array.isArray(status?.indexer_warnings)
    ? status.indexer_warnings
    : Array.isArray(status?.warnings)
      ? status.warnings
      : []

  async function onSearch(event) {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      return
    }
    setBusy(true)
    setError(null)
    setWarnings([])
    try {
      const data = await searchAcquire(q)
      setHits(Array.isArray(data.results) ? data.results : [])
      setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
    } catch (err) {
      setError(err)
      setHits(null)
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
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          url: hit.download_url || hit.magnet || hit.info_url,
          provider,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw errorFromBody(data, response.status, 'acquire')
      }
      showToast(`Sent to ${provider}`, 'success')
    } catch (err) {
      showToast(err?.message || 'Send failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const displayWarnings = [...statusWarnings, ...warnings].filter(Boolean)

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Acquire</h1>
      </div>
      <p className="gt-more-page__lede">
        BYO acquisition via admin-configured native indexers / hubs / debrid. Oneirodex does not host
        torrents. Results are ranked by score (seeders, repack/quality cues).
      </p>
      {status ? (
        <p>
          Arr: {status.arr_enabled ? 'on' : 'off'} · Debrid: {status.debrid_enabled ? 'on' : 'off'} ·
          Send: {status.can_send ? 'allowed' : 'librarian only'} · Clients:{' '}
          {(status.clients || []).join(', ') || '—'}
        </p>
      ) : null}
      {error ? (
        <PageStatus
          error={error}
          onRetry={!status ? () => setRetryCount((n) => n + 1) : null}
          retryLabel="Retry"
        />
      ) : null}
      {!status && !error ? (
        <PageStatus loading loadingMessage="Loading Acquire…" />
      ) : null}
      {displayWarnings.length > 0 ? (
        <p className="gt-more-page__lede" role="status">
          Indexer warnings: {displayWarnings.join(' · ')}
        </p>
      ) : null}
      {!status ? null : !status.enabled ? (
        <p>Enable ENABLE_ARR_MODULE and/or ENABLE_DEBRID to use this page.</p>
      ) : noIndexersReady ? (
        <p role="status">
          No native indexers or Prowlarr/Jackett hubs are ready yet. Ask an admin to add Torznab/Newznab
          entries (or enable presets and set API keys) under Admin → Arr.
        </p>
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
            <li key={`${hit.title}-${hit.indexer || ''}-${index}`}>
              <strong>{hit.title}</strong>
              <span>
                {[
                  hit.score != null ? `score ${hit.score}` : null,
                  hit.is_repack ? 'repack' : null,
                  hit.newer_repack ? 'newer repack?' : null,
                  hit.indexer ? `indexer ${hit.indexer}` : null,
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
