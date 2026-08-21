import { useCallback, useEffect, useState } from 'react'
import { fetchDiscoverSections } from './api/discover'
import { fetchDiscoverPins, saveDiscoverPins } from './api/discoverPins'
import { DiscoverShelf, formatEventEnds, rowItems } from './components/DiscoverShelf'
import { PageStatus } from './components/PageStatus'

export function DiscoverApp({ isAdmin = false, shellConfig = {} } = {}) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pins, setPins] = useState([])
  const [maxPins, setMaxPins] = useState(0)

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

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    fetchDiscoverPins({ signal: controller.signal })
      .then((state) => {
        if (cancelled) return
        setPins(state.pins)
        setMaxPins(state.maxPins)
      })
      .catch(() => {
        // Pins are an enhancement. A feed that loaded is still a feed, so a
        // failure here hides the control rather than breaking the page.
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const togglePin = useCallback(
    (identifier) => {
      setPins((current) => {
        const next = current.includes(identifier)
          ? current.filter((pin) => pin !== identifier)
          : current.concat(identifier).slice(0, maxPins || current.length + 1)
        // Optimistic: the row order only changes on the next feed load anyway,
        // so a round trip before updating the control would just feel slow.
        saveDiscoverPins(next).catch(() => setPins(current))
        return next
      })
    },
    [maxPins],
  )

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

  // Rows of games carry `games`, rows of anything else carry `items`. Reading
  // only the former would have hidden the news row entirely.
  const visible = sections.filter((section) => rowItems(section).length > 0)
  if (!visible.length) {
    return <PageStatus emptyMessage="No Discover shelves to show yet." />
  }

  return visible.map((section) => {
    const identifier = String(section.identifier || section.title || 'section')
    return (
      <DiscoverShelf
        key={identifier}
        section={section}
        isAdmin={isAdmin}
        showPlayStatus={Boolean(shellConfig.showPlayStatus)}
        enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
        pinned={pins.includes(identifier)}
        canPin={pins.length < maxPins}
        onTogglePin={maxPins ? togglePin : undefined}
      />
    )
  })
}

// Re-exported for the tests and callers that imported it from here before the
// shelf became its own component.
export { formatEventEnds }
