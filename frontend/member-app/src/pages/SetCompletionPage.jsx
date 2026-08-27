import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorFromBody } from '../api/envelopeError'
import { createRequest } from '../api/wishlist'
import { ContextBar } from '../chrome/ContextBar'
import { PageStatus } from '../components/PageStatus'
import './SystemsPage.css'
import './SetCompletionPage.css'

const REGIONS = ['USA', 'EUR', 'JPN', 'WORLD', 'OTHER']

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
    throw errorFromBody(data, response.status, 'set-completion')
  }
  return data
}

export function SetCompletionPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
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

  function setRegion(nextRegion) {
    const next = new URLSearchParams(searchParams)
    next.set('region', nextRegion)
    setSearchParams(next)
  }

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

  const identity = libraryPlatform
    ? `${libraryPlatform} · ${(report && report.region) || region}`
    : 'Set completion'
  const regionSelect = (
    <label className="gt-set-completion-region">
      Region
      <select
        aria-label="Region"
        value={region}
        onChange={(event) => setRegion(event.target.value)}
      >
        {REGIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  )
  const libraryLinks = libraryPlatform ? (
    <>
      <Link className={useNewChrome ? 'gt-cbtn' : 'gt-btn'} to="/systems">
        Systems
      </Link>
      <Link
        className={useNewChrome ? 'gt-cbtn' : 'gt-btn'}
        to={`/library?library_platform=${encodeURIComponent(libraryPlatform)}`}
      >
        Browse library
      </Link>
    </>
  ) : (
    <Link className={useNewChrome ? 'gt-cbtn' : 'gt-btn'} to="/systems">
      Back to Systems
    </Link>
  )

  const chrome = useNewChrome ? (
    <ContextBar
      title={identity}
      summary={
        report
          ? `${report.owned} / ${report.total} owned (${report.percent}%)`
          : null
      }
      filterCount={libraryPlatform && region !== 'USA' ? 1 : 0}
      filters={libraryPlatform ? regionSelect : null}
      actions={libraryLinks}
    />
  ) : null

  if (!libraryPlatform) {
    return (
      <>
        {chrome}
        <div className="gt-more-page gt-set-completion-page">
          {useNewChrome ? null : (
            <div className="gt-page-header">
              <h1>Set completion</h1>
            </div>
          )}
          <p className="gt-more-page__lede">
            Open this page from Systems after an admin uploads a reference DAT.
          </p>
          {useNewChrome ? null : libraryLinks}
        </div>
      </>
    )
  }

  if (error && !report) {
    const isMissingSet = error.status === 404
    return (
      <>
        {chrome}
        <div className="gt-more-page gt-set-completion-page">
          {useNewChrome ? null : (
            <div className="gt-page-header">
              <h1>
                {libraryPlatform} · {region}
              </h1>
            </div>
          )}
          {isMissingSet ? (
            <div role="alert">
              <p>
                {`No reference set uploaded for ${libraryPlatform}/${region}.`}
              </p>
              {useNewChrome ? null : (
                <Link className="gt-btn" to="/systems">
                  Systems
                </Link>
              )}
            </div>
          ) : (
            <PageStatus
              error={error}
              errorMessage="Unable to load set completion."
              onRetry={() => setRetryCount((n) => n + 1)}
            />
          )}
        </div>
      </>
    )
  }

  if (!report) {
    return (
      <>
        {chrome}
        <div className="gt-more-page gt-set-completion-page">
          {useNewChrome ? null : (
            <div className="gt-page-header">
              <h1>
                {libraryPlatform} · {region}
              </h1>
            </div>
          )}
          <PageStatus loading loadingMessage="Loading set completion…" />
        </div>
      </>
    )
  }

  return (
    <>
      {chrome}
      <div className="gt-more-page gt-set-completion-page">
        {useNewChrome ? null : (
          <>
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
              {libraryLinks}
              {regionSelect}
            </div>
          </>
        )}
        {useNewChrome ? (
          <p className="gt-more-page__lede">
            {report.set_name || 'Reference set'}. Title match only; CRC matching comes later.
            Missing: {report.missing_count}.
          </p>
        ) : null}
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
    </>
  )
}
