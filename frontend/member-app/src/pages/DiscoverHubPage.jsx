import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchGenreHub } from '../api/discover'
import { ContextBar } from '../chrome/ContextBar'
import { DiscoverShelf } from '../components/DiscoverShelf'
import { PageStatus } from '../components/PageStatus'

/**
 * Genre hub — Discover shelves for one genre, no pin/hide.
 *
 * Reached from a genre zone's See all. The catalog is still the full list.
 */
export function DiscoverHubPage({ isAdmin = false, shellConfig = {} } = {}) {
  const { genre } = useParams()
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    setHub(null)
    fetchGenreHub(genre, { signal: controller.signal })
      .then((next) => {
        if (cancelled) return
        setHub(next)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return
        setError(err)
        setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [genre])

  const title = hub?.title || 'Discover'
  const catalogHref = hub?.catalogHref || ''
  const bar = <ContextBar title={title} />

  if (loading || error) {
    return (
      <>
        {bar}
        <PageStatus
          loading={loading}
          error={error}
          errorMessage="Unable to load this genre hub."
          loadingMessage="Loading genre…"
        />
      </>
    )
  }

  const sections = hub?.sections || []

  if (!sections.length) {
    return (
      <>
        {bar}
        <PageStatus emptyMessage="Nothing assembled for this genre right now.">
          {catalogHref ? (
            <Link className="od-btn" to={catalogHref}>
              Browse catalog
            </Link>
          ) : null}
        </PageStatus>
      </>
    )
  }

  return (
    <>
      {bar}
      <p className="od-more-page__lede">
        Assembled from this genre.{' '}
        {catalogHref ? (
          <Link to={catalogHref}>Browse the catalog</Link>
        ) : null}{' '}
        for the full list. These rows cannot be pinned.
      </p>
      {sections.map((section) => (
        <DiscoverShelf
          key={section.identifier}
          section={section}
          isAdmin={isAdmin}
          showPlayStatus={Boolean(shellConfig.showPlayStatus)}
          enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
        />
      ))}
    </>
  )
}

export default DiscoverHubPage
