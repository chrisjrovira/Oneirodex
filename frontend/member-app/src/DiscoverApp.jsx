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

  return visible.map((section) => (
    <section key={section.identifier} data-discover-section={section.identifier}>
      <h2 className={`discovery-${section.identifier.replaceAll('_', '-')}-label`}>
        {section.title}
      </h2>
      <GameGrid
        games={section.games}
        isAdmin={isAdmin}
        showPlayStatus={Boolean(shellConfig.showPlayStatus)}
        enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
      />
    </section>
  ))
}
