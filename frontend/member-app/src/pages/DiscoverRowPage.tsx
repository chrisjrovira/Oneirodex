import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { fetchDiscoverRow } from '../api/discover'
import { ContextBar } from '../chrome/ContextBar'
import { GameGrid } from '../components/GameGrid'
import { NewsCard } from '../components/NewsCard'
import { PageStatus } from '../components/PageStatus'
import '../components/DiscoverShelf.css'
import { useShellConfig, useViewer } from '@oneirodex/ui'

/** Games per request. A page, not a shelf window — this view is the whole row. */
const PAGE_SIZE = 60

/**
 * One Discover row, on its own page.
 *
 * Reached from a row's "see all" tile. Rows that the Library page can express
 * as a filter never land here — the server hands those a `/library?…` href
 * instead, so this page is for the rows the Library has no way to say.
 */
export function DiscoverRowPage() {
  const { isAdmin } = useViewer()
  const shellConfig = useShellConfig()
  const { identifier } = useParams()
  const [row, setRow] = useState<any>(null)
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<any>(null)
  const abortRef = useRef<any>(null)

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
      .catch((err: any) => {
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
          const keyOf = (item: any) => item.uuid || item.id
          const seen = new Set(current.map(keyOf).filter(Boolean))
          return current.concat(
            page.items.filter((item: any) => {
              const key = keyOf(item)
              return key ? !seen.has(key) : true
            }),
          )
        })
        setRow((current: any) => ({
          ...current,
          hasMore: page.hasMore,
          total: page.total,
          totalIsEstimate: page.totalIsEstimate,
        }))
        setLoadingMore(false)
      })
      .catch((err: any) => {
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

  const isArticles = row?.itemKind === 'articles'

  /* "Load more (28 left)" when the server counted the row, plain "Load more"
     when it could not. The count is deliberately the remainder rather than a
     page number: this view has no pages — it appends — so "page 3 of 139" was
     describing a control that does not exist, which is how it managed to offer
     139 of them for 50 items. A remainder cannot drift from what is on screen
     because it is computed from what is on screen. */
  const remaining = typeof row?.total === 'number' ? Math.max(0, row.total - games.length) : null
  const loadMoreLabel = remaining ? `Load more (${remaining} left)` : 'Load more'

  return (
    <>
      {bar}
      {isArticles ? (
        <div
          className="od-shelf__track"
          role="list"
          aria-label={row?.title || 'Discover'}
          style={{ flexWrap: 'wrap', overflowX: 'visible' }}
        >
          {games.map((item, index) => (
            <div
              className="od-shelf__item"
              role="listitem"
              key={item.id || item.uuid || `item-${index}`}
            >
              <NewsCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <GameGrid
          games={games}
          isAdmin={isAdmin}
          showPlayStatus={Boolean(shellConfig.showPlayStatus)}
          enableDeleteOnDisk={Boolean(shellConfig.enableDeleteOnDisk)}
        />
      )}
      {row?.hasMore ? (
        <button type="button" className="od-cbtn" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : loadMoreLabel}
        </button>
      ) : null}
    </>
  )
}

export default DiscoverRowPage
