import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDiscoverSections } from './api/discover'
import { fetchDiscoverPins, saveDiscoverPins } from './api/discoverPins'
import { ContextBar, Popover } from './chrome/ContextBar'
import { DiscoverShelf, formatEventEnds, rowItems } from './components/DiscoverShelf'
import { DiscoverRowSettings } from './components/DiscoverRowSettings'
import { PageStatus } from './components/PageStatus'

export function DiscoverApp({ isAdmin = false, shellConfig = {} } = {}) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pins, setPins] = useState([])
  const [hidden, setHidden] = useState([])
  const [maxPins, setMaxPins] = useState(0)
  // Every row the feed can show, hidden ones included. The sections payload
  // only carries what is actually rendered, so a hidden row is absent from it
  // by construction — which is exactly the row the settings panel has to be
  // able to list. Kept from the arrangement response, which is derived from
  // `resolve_feed` and therefore always the complete set.
  const [known, setKnown] = useState([])

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

  const loadArrangement = useCallback((signal) => {
    return fetchDiscoverPins({ signal })
      .then((state) => {
        setPins(state.pins)
        setHidden(state.hidden)
        setMaxPins(state.maxPins)
        setKnown(state.available)
      })
      .catch(() => {
        // Arrangement is an enhancement. A feed that loaded is still a feed, so
        // a failure here hides the controls rather than breaking the page.
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadArrangement(controller.signal)
    return () => controller.abort()
  }, [loadArrangement])

  /**
   * Push an arrangement change and roll back if the server refuses it.
   *
   * Optimistic on purpose: pins and exclusions only take visible effect on the
   * next feed load anyway, so waiting for a round trip before updating the
   * control would make every one of these feel broken. The rollback matters for
   * the one case the server genuinely says no to — hiding a shelf an admin
   * forced — where the control must not keep a state the feed will not honour.
   */
  const commit = useCallback(
    (next, previous) => {
      saveDiscoverPins(next).catch(() => {
        if (previous.pins) setPins(previous.pins)
        if (previous.hidden) setHidden(previous.hidden)
      })
    },
    [],
  )

  const togglePin = useCallback(
    (identifier) => {
      setPins((current) => {
        const next = current.includes(identifier)
          ? current.filter((pin) => pin !== identifier)
          : current.concat(identifier).slice(0, maxPins || current.length + 1)
        commit({ pins: next }, { pins: current })
        return next
      })
    },
    [commit, maxPins],
  )

  const toggleHidden = useCallback(
    (identifier) => {
      setHidden((current) => {
        const next = current.includes(identifier)
          ? current.filter((row) => row !== identifier)
          : current.concat(identifier)
        commit({ hidden: next }, { hidden: current })
        return next
      })
      // A hidden row cannot also be pinned — the feed would have to both
      // reserve a slot for it and not render it. Dropping the pin here keeps
      // the two lists from disagreeing rather than leaving the server to
      // arbitrate.
      setPins((current) => {
        if (!current.includes(identifier)) return current
        const next = current.filter((pin) => pin !== identifier)
        commit({ pins: next }, { pins: current })
        return next
      })
    },
    [commit],
  )

  /** Move a pinned row one place up (-1) or down (+1) in the member's order. */
  const movePin = useCallback(
    (identifier, delta) => {
      setPins((current) => {
        const from = current.indexOf(identifier)
        const to = from + delta
        if (from < 0 || to < 0 || to >= current.length) return current
        const next = current.slice()
        next.splice(to, 0, next.splice(from, 1)[0])
        commit({ pins: next }, { pins: current })
        return next
      })
    },
    [commit],
  )

  // Rows of games carry `games`, rows of anything else carry `items`. Reading
  // only the former would have hidden the news row entirely.
  const visible = useMemo(
    () => sections.filter((section) => rowItems(section).length > 0),
    [sections],
  )

  /**
   * Every row the settings panel can offer, with a title for each.
   *
   * Titles come from the rendered sections where we have them. A hidden row is
   * not in that payload, so it falls back to its identifier prettified — which
   * is not ideal, and is the honest cost of the feed not shipping rows it is
   * not going to render. It stays recognisable ("free_this_week" reads as "Free
   * this week"), and showing the row again replaces it with the real title.
   */
  const settingsRows = useMemo(() => {
    const titles = new Map(
      visible.map((section) => [
        String(section.identifier || ''),
        section.title || String(section.identifier || ''),
      ]),
    )
    return known.map((identifier) => ({
      identifier,
      title: titles.get(identifier) || prettifyIdentifier(identifier),
    }))
  }, [known, visible])

  if (loading || error) {
    return (
      <PageStatus
        loading={loading}
        error={error}
        errorMessage="Unable to load Discover shelves."
        loadingMessage="Loading Discover…"
      />
    )
  }

  /* The way back for a hidden row, and the only place pin order can be said.
     Rendered whenever the server told us what the feed could contain — without
     that list the panel would be a control that cannot list what it controls. */
  const bar = settingsRows.length ? (
    <ContextBar
      summary={`${visible.length} rows`}
      actions={
        <Popover label="Rows" count={hidden.length}>
          <DiscoverRowSettings
            rows={settingsRows}
            pins={pins}
            hidden={hidden}
            maxPins={maxPins}
            onTogglePin={togglePin}
            onToggleHidden={toggleHidden}
            onMovePin={movePin}
          />
        </Popover>
      }
    />
  ) : null

  if (!visible.length) {
    return (
      <>
        {bar}
        <PageStatus emptyMessage="No Discover shelves to show yet." />
      </>
    )
  }

  return (
    <>
      {bar}
      {visible.map((section) => {
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
            onHide={known.length ? toggleHidden : undefined}
          />
        )
      })}
    </>
  )
}

/** "free_this_week" → "Free this week". Only used for a row we cannot name. */
export function prettifyIdentifier(identifier) {
  const words = String(identifier || '').replace(/[_:-]+/g, ' ').trim()
  if (!words) return 'Row'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Re-exported for the tests and callers that imported it from here before the
// shelf became its own component.
export { formatEventEnds }
