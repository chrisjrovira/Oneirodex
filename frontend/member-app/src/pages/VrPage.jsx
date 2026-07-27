import { useEffect, useState } from 'react'
import { fetchVrCatalog, fetchVrGame } from '../api/vr'
import './VrPage.css'

const PER_PAGE = 48

export function VrPage({ shellConfig: _shellConfig } = {}) {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [selectedUuid, setSelectedUuid] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.register('/vr/sw.js', { scope: '/vr' }).catch(() => {
      // The PWA shell is optional; browsing still works without it.
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setCatalog(null)

    fetchVrCatalog({ signal: controller.signal, page, perPage: PER_PAGE })
      .then((data) => {
        if (active) {
          setCatalog(data)
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
  }, [page, retryCount])

  useEffect(() => {
    if (!selectedUuid) {
      return undefined
    }

    const controller = new AbortController()
    let active = true
    setDetailError(null)
    setDetail(null)

    fetchVrGame(selectedUuid, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setDetail(data)
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setDetailError(err)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedUuid])

  const games = catalog?.games || []

  return (
    <div className="gt-more-page gt-vr">
      <div className="gt-page-header">
        <h1>VR Library</h1>
      </div>
      <p className="gt-more-page__lede">
        Large-tap browse for headset browsers. Install as a PWA from the browser menu. Browse
        only — no downloads.
      </p>

      {error ? (
        <div role="alert">
          <p>Unable to load the VR catalog.</p>
          {error.message ? <p className="gt-vr__error-detail">{error.message}</p> : null}
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !catalog ? <p className="gt-vr__status">Loading…</p> : null}

      {!error && catalog ? (
        <p className="gt-vr__status">{catalog.total || 0} games</p>
      ) : null}

      {!error && catalog && games.length === 0 ? (
        <p>No games are available for VR browsing yet.</p>
      ) : null}

      {!error && games.length > 0 ? (
        <div className="gt-vr__grid">
          {games.map((game) => (
            <button
              key={game.uuid}
              type="button"
              className="gt-vr__card"
              data-uuid={game.uuid}
              onClick={() => setSelectedUuid(game.uuid)}
            >
              {game.cover_url ? <img src={game.cover_url} alt="" loading="lazy" /> : null}
              <span>{game.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {!error && catalog && catalog.pages > 1 ? (
        <nav className="gt-vr__pager" aria-label="Catalog pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
            Previous
          </button>
          <span>
            Page {catalog.page} of {catalog.pages}
          </span>
          <button
            type="button"
            disabled={page >= catalog.pages}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}

      {selectedUuid ? (
        <div className="gt-vr__detail">
          <button
            type="button"
            className="gt-vr__back"
            onClick={() => setSelectedUuid(null)}
          >
            Back
          </button>

          {detailError ? (
            <p role="alert">{detailError.message || 'Unable to load this game.'}</p>
          ) : null}

          {!detailError && !detail ? <p>Loading…</p> : null}

          {!detailError && detail ? (
            <>
              {detail.cover_url ? (
                <img className="gt-vr__detail-cover" src={detail.cover_url} alt="" />
              ) : null}
              <h2>{detail.name}</h2>
              {detail.size ? <p className="gt-vr__meta">{detail.size}</p> : null}
              <p>{detail.summary || 'No summary'}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
