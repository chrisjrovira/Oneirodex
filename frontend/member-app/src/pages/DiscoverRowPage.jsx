import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { fetchDiscoverRow } from '../api/discover'
import { ContextBar } from '../chrome/ContextBar'
import { GameGrid } from '../components/GameGrid'
import { PageStatus } from '../components/PageStatus'

/** Games per request. A page, not a shelf window — this view is the whole row. */
const PAGE_SIZE = 60

/**
 * One Discover row, on its own page.
 *
 * Reached from a row's "see all" tile. Rows that the Library page can express
 * as a filter never land here — the server hands those a `/library?…` href
 * instead, so this page is for the rows the Library has no way to say.
 */
export function DiscoverRowPage({ isAdmin = false, shellConfig = {} } = {}) {
  const { identifier } = useParams()
  const [row, setRow] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    setGames([])
    setRow(null)
    fetchDiscoverRow(identifier, { limit: PAGE_SIZE, signal: controller.signal })
      .then((page) => {
        if (cancelled) return
        setRow(page)
        setGames(page.items)
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
  }, [identifier])

  useEffect(() => () => abortRef.current?.abort(), [])

  const loadMore = useCallback(() => {
    if (loadingMore || !row?.hasMore) return
    setLoadingMore(true)
    const controller = new AbortController()
    abortRef.current = controller
    fetchDiscoverRow(identifier, {
      offset: games.length,
      limit: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((page) => {
        setGames((current) => {
          const seen = new Set(current.map((game) => game.uuid))
          return current.concat(page.items.filter((game) => !seen.has(game.uuid)))
        })
        setRow((current) => ({ ...current, hasMore: page.hasMore }))
        setLoadingMore(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err)
        setLoadingMore(false)
      })
  }, [games.length, identifier, loadingMore, row])

  // A row the server would rather answer with a real Library filter. Following
  // it here keeps the "see all" contract in one place: every tile links to this
  // route and this route decides where that actually means.
  if (row?.moreHref && row.moreHref.startsWith('/library?')) {
    return <Navigate to={row.moreHref} replace />
  }

  /* The row's own name stays in the bar through loading and failure alike.
     Returning a bare status swapped the whole page — including the title — for
     a spinner, so "see all" led to an unlabelled loading screen and then, on a
     slow row, an unlabelled error. The identifier is in the URL and the title
     usually is not, so there was nothing left to say what had failed. */
  const bar = <ContextBar title={row?.title || 'Discover'} />

  if (loading || error) {
    return (
      <>
        {bar}
        <PageStatus
          loading={loading}
          error={error}
          errorMessage="Unable to load this row."
          loadingMessage="Loading row…"
        />
      </>
    )
  }

  if (!games.length) {
    return (
      <>
        {bar}
        <PageStatus emptyMessage="This row has nothing to show right now." />
      </>
    )
  }

  return (
    <>
      {bar}
      <GameGrid
        games={games}
        isAdmin={isAdmin}
        showPlayStatus={Boolean(shellConfig.showPlayStatus)}
        enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
      />
      {row?.hasMore ? (
        <button
          type="button"
          className="gt-cbtn"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </>
  )
}

export default DiscoverRowPage
