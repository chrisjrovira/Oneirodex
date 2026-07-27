import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { createRequest } from '../api/wishlist'
import './SystemsPage.css'
import './SetCompletionPage.css'

async function fetchSetCompletion({ libraryPlatform, region, signal }) {
  const params = new URLSearchParams({
    library_platform: libraryPlatform,
    region,
  })
  const response = await fetch(`/api/set-completion?${params}`, {
    signal,
    credentials: 'same-origin',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = new Error(data.message || data.error || `set-completion ${response.status}`)
    err.status = response.status
    err.payload = data
    throw err
  }
  return data
}

export function SetCompletionPage({ shellConfig: _shellConfig } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const libraryPlatform = (searchParams.get('library_platform') || '').trim().toUpperCase()
  const region = (searchParams.get('region') || 'USA').trim().toUpperCase()

  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [busyTitle, setBusyTitle] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)

  useEffect(() => {
    if (!libraryPlatform) {
      setError(new Error('library_platform query required'))
      setReport(null)
      return undefined
    }
    const controller = new AbortController()
    let active = true
    setError(null)
    setReport(null)
    fetchSetCompletion({
      libraryPlatform,
      region,
      signal: controller.signal,
    })
      .then((data) => {
        if (active) setReport(data)
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') setError(err)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [libraryPlatform, region, retryCount])

  const missing = useMemo(
    () => (Array.isArray(report?.missing) ? report.missing : []),
    [report],
  )

  async function addToWishlist(title) {
    setBusyTitle(title)
    setActionMsg(null)
    try {
      await createRequest({
        title,
        notes: `Missing from ${libraryPlatform} ${region} reference set`,
      })
      setActionMsg(`Added “${title}” to wishlist`)
    } catch (err) {
      setActionMsg(err.message || 'Wishlist request failed')
    } finally {
      setBusyTitle(null)
    }
  }

  if (!libraryPlatform) {
    return (
      <div className="gt-more-page gt-set-completion-page">
        <div className="gt-page-header">
          <h1>Set completion</h1>
        </div>
        <p className="gt-more-page__lede">
          Open this page from Systems after an admin uploads a reference DAT.
        </p>
        <Link className="gt-btn" to="/systems">
          Back to Systems
        </Link>
      </div>
    )
  }

  if (error && !report) {
    const isMissingSet = error.status === 404
    return (
      <div className="gt-more-page gt-set-completion-page">
        <div className="gt-page-header">
          <h1>
            {libraryPlatform} · {region}
          </h1>
        </div>
        <div role="alert">
          <p>
            {isMissingSet
              ? `No reference set uploaded for ${libraryPlatform}/${region}.`
              : 'Unable to load set completion.'}
          </p>
          {!isMissingSet ? (
            <button type="button" className="gt-btn" onClick={() => setRetryCount((n) => n + 1)}>
              Retry
            </button>
          ) : null}
          <Link className="gt-btn" to="/systems">
            Systems
          </Link>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="gt-more-page gt-set-completion-page">
        <div className="gt-page-header">
          <h1>
            {libraryPlatform} · {region}
          </h1>
        </div>
        <p className="gt-more-page__lede">Loading set completion…</p>
      </div>
    )
  }

  return (
    <div className="gt-more-page gt-set-completion-page">
      <div className="gt-page-header">
        <h1>
          {libraryPlatform} · {report.region}
        </h1>
      </div>
      <p className="gt-more-page__lede">
        {report.set_name || 'Reference set'} — {report.owned} / {report.total} owned (
        {report.percent}%). Title match only; CRC matching comes later. Missing:{' '}
        {report.missing_count}.
      </p>
      <div className="gt-set-completion-toolbar">
        <Link className="gt-btn" to="/systems">
          Systems
        </Link>
        <Link
          className="gt-btn"
          to={`/library?library_platform=${encodeURIComponent(libraryPlatform)}`}
        >
          Browse library
        </Link>
        <label className="gt-set-completion-region">
          Region
          <select
            value={region}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams)
              next.set('region', event.target.value)
              setSearchParams(next)
            }}
          >
            {['USA', 'EUR', 'JPN', 'WORLD', 'OTHER'].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      {actionMsg ? <p className="gt-set-completion-msg">{actionMsg}</p> : null}
      {missing.length === 0 ? (
        <p className="gt-more-page__lede">No missing titles for this set — nice.</p>
      ) : (
        <ul className="gt-set-completion-missing">
          {missing.map((row) => (
            <li key={row.normalized_name || row.name}>
              <span>{row.name}</span>
              <button
                type="button"
                className="gt-btn"
                disabled={busyTitle === row.name}
                onClick={() => addToWishlist(row.name)}
              >
                Wishlist
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
