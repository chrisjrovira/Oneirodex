import { useEffect, useState } from 'react'
import { fetchDiscoverSections } from './api/discover'
import { GameGrid } from './components/GameGrid'
import { PageStatus } from './components/PageStatus'

export function DiscoverApp({ isAdmin = false, shellConfig = {} } = {}) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchDiscoverSections({ signal: controller.signal })
      .then((next) => {
        if (cancelled) return
        setSections(next)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  if (loading) {
    return <PageStatus loading loadingMessage="Loading Discover…" />
  }
  if (error) {
    return (
      <p className="gt-more-page__lede" role="alert">
        Unable to load Discover shelves.
      </p>
    )
  }

  const visible = sections.filter((section) => Array.isArray(section.games) && section.games.length > 0)
  if (!visible.length) {
    return <PageStatus emptyMessage="No Discover shelves to show yet." />
  }

  return visible.map((section) => {
    const id = String(section.identifier || section.title || 'section')
    const layout = section.layout || 'shelf'
    return (
      <section
        key={id}
        data-discover-section={id}
        data-layout={layout}
        className={`gt-store-shelf gt-store-shelf--${layout}`}
      >
        <div className="gt-store-shelf__head">
          <h2 className={`discovery-${id.replaceAll('_', '-')}-label`}>
            {section.title}
          </h2>
          {section.is_event ? (
            <span className="gt-store-shelf__event" title="Limited-time shelf">
              Event{formatEventEnds(section.ends_at)}
            </span>
          ) : null}
        </div>
        <GameGrid
          games={section.games}
          isAdmin={isAdmin}
          showPlayStatus={Boolean(shellConfig.showPlayStatus)}
          enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
        />
      </section>
    )
  })
}

/** " · ends in 3 days" — omitted entirely when there is no honest end date. */
export function formatEventEnds(endsAt) {
  if (!endsAt) return ''
  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return ''
  const msLeft = end.getTime() - Date.now()
  if (msLeft <= 0) return ''
  const days = Math.floor(msLeft / 86_400_000)
  if (days >= 2) return ` · ends in ${days} days`
  const hours = Math.max(1, Math.floor(msLeft / 3_600_000))
  return ` · ends in ${hours} hour${hours === 1 ? '' : 's'}`
}
