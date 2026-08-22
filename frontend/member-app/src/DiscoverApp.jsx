import { useCallback, useEffect, useState } from 'react'
import { fetchDiscoverSections } from './api/discover'
import { DiscoverShelf, formatEventEnds } from './components/DiscoverShelf'
import { PageStatus } from './components/PageStatus'
import { loadPinnedShelves, orderShelves, togglePinnedShelf } from './utils/discoverPins'

export function DiscoverApp({ isAdmin = false, shellConfig = {} } = {}) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pinned, setPinned] = useState(() => loadPinnedShelves())

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

  const onTogglePin = useCallback((id) => {
    setPinned(togglePinnedShelf(id))
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

  const visible = sections.filter(
    (section) => Array.isArray(section.games) && section.games.length > 0,
  )
  if (!visible.length) {
    return <PageStatus emptyMessage="No Discover shelves to show yet." />
  }

  // Pinned shelves rise to the top; the rest keep the admin's display order.
  const ordered = orderShelves(visible, pinned)

  return ordered.map((section) => {
    const id = String(section.identifier || section.title || 'section')
    return (
      <DiscoverShelf
        key={id}
        section={section}
        isAdmin={isAdmin}
        showPlayStatus={Boolean(shellConfig.showPlayStatus)}
        enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
        pinned={pinned.includes(id)}
        onTogglePin={onTogglePin}
      />
    )
  })
}

// Re-exported: this used to live here, and the shelf head is its only caller.
export { formatEventEnds }
