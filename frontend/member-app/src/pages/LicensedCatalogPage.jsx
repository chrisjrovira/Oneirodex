import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorFromBody } from '../api/envelopeError'
import { ContextBar } from '../chrome/ContextBar'
import { REGION_LABELS } from '../chrome/regions'
import { PageStatus } from '../components/PageStatus'
import './SystemsPage.css'
import './SetCompletionPage.css'

async function fetchLicensedCatalog({ libraryPlatform, signal }) {
  const params = new URLSearchParams({ library_platform: libraryPlatform })
  const response = await fetch(`/api/licensed-catalog?${params}`, {
    signal,
    credentials: 'same-origin',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw errorFromBody(data, response.status, 'licensed-catalog')
  }
  return data
}

export function LicensedCatalogPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [searchParams] = useSearchParams()
  const libraryPlatform = (searchParams.get('library_platform') || '').trim().toUpperCase()

  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

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
    fetchLicensedCatalog({ libraryPlatform, signal: controller.signal })
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
  }, [libraryPlatform, retryCount])

  const identity = libraryPlatform ? `${libraryPlatform} · licensed catalog` : 'Licensed catalog'
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
      <Link
        className={useNewChrome ? 'gt-cbtn' : 'gt-btn'}
        to={`/systems/completion?library_platform=${encodeURIComponent(libraryPlatform)}`}
      >
        Set completeness
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
          ? report.empty
            ? 'Cache empty'
            : `${report.owned_titles} / ${report.unique_titles} titles in cache`
          : null
      }
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
              <h1>Licensed catalog</h1>
            </div>
          )}
          <p className="gt-more-page__lede">
            Open this page from a Systems tile. It shows IGDB regional release
            counts for that console or computer — not Wikipedia, and not a DAT.
          </p>
          {useNewChrome ? null : libraryLinks}
        </div>
      </>
    )
  }

  if (error && !report) {
    return (
      <>
        {chrome}
        <div className="gt-more-page gt-set-completion-page">
          {useNewChrome ? null : (
            <div className="gt-page-header">
              <h1>{libraryPlatform} · licensed catalog</h1>
            </div>
          )}
          <PageStatus
            error={error}
            errorMessage="Unable to load licensed catalog."
            onRetry={() => setRetryCount((n) => n + 1)}
          />
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
              <h1>{libraryPlatform} · licensed catalog</h1>
            </div>
          )}
          <PageStatus loading loadingMessage="Loading licensed catalog…" />
        </div>
      </>
    )
  }

  const rows = Array.isArray(report.by_region) ? report.by_region : []

  return (
    <>
      {chrome}
      <div className="gt-more-page gt-set-completion-page">
        {useNewChrome ? null : (
          <>
            <div className="gt-page-header">
              <h1>{libraryPlatform} · licensed catalog</h1>
            </div>
            <div className="gt-set-completion-toolbar">{libraryLinks}</div>
          </>
        )}
        <p className="gt-more-page__lede">{report.note}</p>
        {report.fetched_at ? (
          <p className="gt-set-completion-msg">Last refresh {report.fetched_at}</p>
        ) : null}
        <table className="gt-licensed-catalog-table">
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Titles in cache</th>
              <th scope="col">Owned here</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const code = row.region_code
              const label = row.label || REGION_LABELS[code] || code
              const source =
                row.source === 'dat_only' ? 'DAT only' : 'IGDB'
              return (
                <tr key={code}>
                  <th scope="row">
                    {label} ({code})
                  </th>
                  <td>{row.titles}</td>
                  <td>{row.owned}</td>
                  <td>{source}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
