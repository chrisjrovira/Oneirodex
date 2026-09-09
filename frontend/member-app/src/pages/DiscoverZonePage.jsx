import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDiscoverZone } from '../api/discover'
import { ContextBar } from '../chrome/ContextBar'
import { DiscoverShelf } from '../components/DiscoverShelf'
import { PageStatus } from '../components/PageStatus'
import { useShellConfig, useViewer } from '@oneirodex/ui'

/**
 * One Discover zone — the feed narrowed to one named surface.
 *
 * Reached from the zone strip on Discover. The rows are the same rows the main
 * feed serves, assembled by the same pipeline, so a shelf behaves identically
 * whichever surface a member arrives through — including its dedupe token,
 * which is per-assembly and therefore per-zone.
 *
 * A zone that resolves to nothing 404s at the API rather than rendering a
 * heading over empty space, so the empty branch here is for a zone that emptied
 * out between the strip being drawn and the member clicking it.
 */
export function DiscoverZonePage() {
  const { isAdmin } = useViewer()
  const shellConfig = useShellConfig()
  const { slug } = useParams()
  const [zone, setZone] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    setZone(null)
    fetchDiscoverZone(slug, { signal: controller.signal })
      .then((next) => {
        if (cancelled) return
        setZone(next)
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
  }, [slug])

  /* The zone's name stays in the bar through loading and failure, for the same
     reason the row page keeps its title: the slug is in the URL and the name is
     not, so a bare status would leave nothing saying what had failed. */
  const bar = <ContextBar title={zone?.title || 'Discover'} />

  if (loading || error) {
    return (
      <>
        {bar}
        <PageStatus
          loading={loading}
          error={error}
          errorMessage="Unable to load this zone."
          loadingMessage="Loading zone…"
        />
      </>
    )
  }

  const sections = zone?.sections || []

  if (!sections.length) {
    return (
      <>
        {bar}
        <PageStatus emptyMessage="This zone has nothing to show right now.">
          <Link className="od-btn" to="/discover">
            Back to Discover
          </Link>
        </PageStatus>
      </>
    )
  }

  return (
    <>
      {bar}
      {zone?.lede ? <p className="od-more-page__lede">{zone.lede}</p> : null}
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

export default DiscoverZonePage
