import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  batchAddToWishlist,
  batchCheckFreshness,
  batchRefreshImages,
  batchSetFavorite,
  batchSetPlayStatus,
} from './api/batchActions'
import { fetchBrowseGames } from './api/browse'
import { applyPlatformSkin, clearPlatformSkin } from './chrome/platformSkins'
import { SystemBackdrop } from './chrome/SystemBackdrop'
import { usesNewChrome } from './chrome/usesNewChrome'
import {
  BADGE_FILTER_PARAMS,
  badgeFiltersFromSearchParams,
} from './components/BadgeFilterChips'
import {
  ITEM_KIND_FILTER_CHIPS,
  itemKindFromSearchParams,
  parseItemKindFilter,
} from './components/ItemKindFilterChips'
import { ContextBar } from './chrome/ContextBar'
import {
  cleanFilters,
  FilterBar,
} from './components/FilterBar'
import './components/libraryFilters.css'
import { GameGrid } from './components/GameGrid'
import { GameGridSkeleton } from './components/GameGridSkeleton'
import { LibrarySelectionBar } from './components/LibrarySelectionBar'
import { PageStatus } from './components/PageStatus'
import { PaginationBar } from './components/PaginationBar'
import { createTranslator } from './i18n'
import { batchItemUuids, summarizeBatchOutcome } from './utils/batchOutcome'
import { CATALOG_LAYOUTS, useCatalogLayout } from './utils/catalogLayout'
import { readLibraryFilters, writeLibraryFilters } from './utils/cookies'
import { showToast } from './utils/toast'

function EmptyState({ initialConfig, t }) {
  if (initialConfig.libraryCount === 0) {
    return (
      <p>
        {initialConfig.isAdmin
          ? t('No libraries found. Add a library to get started.')
          : t('No libraries are available.')}
      </p>
    )
  }

  if (initialConfig.gamesCount === 0) {
    return <p>{t('No games found in your libraries.')}</p>
  }

  return <p>{t('No games match the current filters.')}</p>
}

function filtersFromSearchParams(searchParams) {
  const next = {
    ...badgeFiltersFromSearchParams(searchParams),
    ...itemKindFromSearchParams(searchParams),
  }
  const libraryPlatform = searchParams.get('library_platform')
  if (libraryPlatform) {
    next.library_platform = libraryPlatform
  }
  const playMode = searchParams.get('play_mode')
  if (playMode) {
    next.play_mode = playMode
  }
  const genre = searchParams.get('genre')
  if (genre) {
    next.genre = genre
  }
  const theme = searchParams.get('theme')
  if (theme) {
    next.theme = theme
  }
  const gameMode = searchParams.get('game_mode')
  if (gameMode) {
    next.game_mode = gameMode
  }
  const perspective = searchParams.get('player_perspective')
  if (perspective) {
    next.player_perspective = perspective
  }
  const name = (searchParams.get('name') || searchParams.get('q') || '').trim()
  if (name) {
    next.name = name
  }
  return next
}

function searchParamsHaveLibraryFilters(searchParams) {
  if (
    searchParams.has('library_platform') ||
    searchParams.has('play_mode') ||
    searchParams.has('genre') ||
    searchParams.has('theme') ||
    searchParams.has('game_mode') ||
    searchParams.has('player_perspective') ||
    searchParams.has('item_kind') ||
    searchParams.has('content_kind') ||
    searchParams.has('name') ||
    searchParams.has('q')
  ) {
    return true
  }
  return BADGE_FILTER_PARAMS.some((param) => searchParams.has(param))
}

export function LibraryApp({ initialConfig, shellConfig = {} } = {}) {
  const t = useMemo(
    () => createTranslator(initialConfig.locale),
    [initialConfig.locale],
  )
  const canBatchRefreshImages = Boolean(
    shellConfig.isLibrarian || shellConfig.isAdmin || initialConfig.isAdmin,
  )
  const useNewChrome = usesNewChrome(shellConfig)
  const filtersPanelId = useId()
  // The rail is rendered by the shell, not by this tree, so the slot only
  // exists after mount. Resolving it in state (rather than a ref read during
  // render) makes the first paint correct instead of one frame late.
  const [railSlot, setRailSlot] = useState(null)
  useEffect(() => {
    setRailSlot(document.getElementById('od-rail-slot'))
  }, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(initialConfig.perPage)
  const [layout, setLayout] = useCatalogLayout()
  const defaultFilters = {
    sort_by: initialConfig.defaultSort,
    sort_order: initialConfig.defaultSortOrder,
  }
  const [filters, setFilters] = useState(() =>
    cleanFilters({
      ...defaultFilters,
      ...initialConfig.currentFilters,
      ...readLibraryFilters(),
      ...filtersFromSearchParams(searchParams),
    }),
  )
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  /** UUIDs known to have a pending wishlist request (session + batch skips). */
  const [wishlistPendingIds, setWishlistPendingIds] = useState(() => new Set())
  const [selectionBusy, setSelectionBusy] = useState(false)
  const [wishlistAvailable, setWishlistAvailable] = useState(true)
  const [playStatusAvailable, setPlayStatusAvailable] = useState(true)
  const [refreshImagesAvailable, setRefreshImagesAvailable] = useState(true)
  const selectionAnchorRef = useRef(null)

  useEffect(() => {
    const fromUrl = filtersFromSearchParams(searchParams)
    if (!searchParamsHaveLibraryFilters(searchParams)) {
      return
    }
    setFilters((current) => {
      const same =
        current.library_platform === fromUrl.library_platform &&
        current.play_mode === fromUrl.play_mode &&
        current.genre === fromUrl.genre &&
        current.theme === fromUrl.theme &&
        current.game_mode === fromUrl.game_mode &&
        current.player_perspective === fromUrl.player_perspective &&
        current.item_kind === fromUrl.item_kind &&
        current.name === fromUrl.name &&
        BADGE_FILTER_PARAMS.every((param) => current[param] === fromUrl[param])
      if (same) {
        return current
      }
      const next = cleanFilters({ ...current, ...fromUrl })
      writeLibraryFilters(next)
      return next
    })
    setPage(1)
  }, [searchParams])

  useEffect(() => {
    if (filters.library_platform) {
      applyPlatformSkin(filters.library_platform)
    } else {
      clearPlatformSkin()
    }
    return () => {
      clearPlatformSkin()
    }
  }, [filters.library_platform])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setError(null)
    fetchBrowseGames(
      {
        ...filters,
        page,
        per_page: perPage,
      },
      { signal: controller.signal },
    )
      .then((nextResult) => {
        if (active) {
          setResult(nextResult)
          setLoading(false)
        }
      })
      .catch((requestError) => {
        if (active && requestError.name !== 'AbortError') {
          setError(requestError)
          setLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [filters, page, perPage, retryCount])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') {
        return
      }
      if (selectedIds.size > 0) {
        setSelectedIds(new Set())
        selectionAnchorRef.current = null
        return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedIds.size])

  const clearSelection = () => {
    setSelectedIds(new Set())
    selectionAnchorRef.current = null
  }

  const selectPage = () => {
    const pageGames = result?.games ?? []
    if (pageGames.length === 0) {
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const game of pageGames) {
        if (game?.uuid) {
          next.add(game.uuid)
        }
      }
      return next
    })
  }

  const retry = () => {
    setRetryCount((count) => count + 1)
  }

  const applyFilters = (nextFilters) => {
    writeLibraryFilters(nextFilters)
    setPage(1)
    setFilters(nextFilters)
    clearSelection()
  }

  /** Live title search — same filter apply, keep mobile LHN open while typing. */
  const applyLiveSearch = (nextFilters) => {
    writeLibraryFilters(nextFilters)
    setPage(1)
    setFilters(nextFilters)
    clearSelection()
  }

  const clearFilters = () => {
    writeLibraryFilters(defaultFilters)
    setPage(1)
    setFilters(defaultFilters)
    clearSelection()
    if (searchParamsHaveLibraryFilters(searchParams)) {
      setSearchParams({}, { replace: true })
    }
  }

  const handleSelectionToggle = (uuid, opts = {}) => {
    const games = result?.games ?? []
    setSelectedIds((prev) => {
      const next = new Set(prev)

      if (opts.range && games.length > 0) {
        const anchor = selectionAnchorRef.current
        const endIndex = games.findIndex((game) => game.uuid === uuid)
        const startIndex = anchor
          ? games.findIndex((game) => game.uuid === anchor)
          : endIndex
        if (endIndex >= 0 && startIndex >= 0) {
          const from = Math.min(startIndex, endIndex)
          const to = Math.max(startIndex, endIndex)
          for (let i = from; i <= to; i += 1) {
            next.add(games[i].uuid)
          }
          selectionAnchorRef.current = uuid
          return next
        }
      }

      if (opts.checked === true) {
        next.add(uuid)
      } else if (opts.checked === false) {
        next.delete(uuid)
      } else if (opts.fromLongPress || opts.additive) {
        next.add(uuid)
      } else if (next.has(uuid)) {
        next.delete(uuid)
      } else {
        next.add(uuid)
      }

      selectionAnchorRef.current = uuid
      return next
    })
  }

  const favoriteByUuid = useMemo(() => {
    const map = {}
    for (const game of result?.games ?? []) {
      map[game.uuid] = Boolean(game.is_favorite)
    }
    return map
  }, [result])

  const applyFavoriteResults = (uuids, favorite) => {
    const idSet = new Set(uuids)
    setResult((prev) => {
      if (!prev?.games) {
        return prev
      }
      return {
        ...prev,
        games: prev.games.map((game) =>
          idSet.has(game.uuid) ? { ...game, is_favorite: favorite } : game,
        ),
      }
    })
  }

  const applyPlayStatusResults = (updatedRows, status) => {
    const byUuid = new Map()
    if (Array.isArray(updatedRows)) {
      for (const row of updatedRows) {
        if (typeof row === 'string' && row) {
          byUuid.set(row, status)
          continue
        }
        if (row && typeof row === 'object' && typeof row.uuid === 'string') {
          byUuid.set(row.uuid, row.status !== undefined ? row.status : status)
        }
      }
    }
    if (byUuid.size === 0) {
      return
    }
    setResult((prev) => {
      if (!prev?.games) {
        return prev
      }
      return {
        ...prev,
        games: prev.games.map((game) =>
          byUuid.has(game.uuid)
            ? { ...game, user_status: byUuid.get(game.uuid) || '' }
            : game,
        ),
      }
    })
  }

  const runBatchFavorite = async (favorite) => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchSetFavorite(uuids, favorite, { favoriteByUuid })
      applyFavoriteResults(batchItemUuids(outcome.updated), favorite)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: favorite ? t('Favorites') : t('Unfavorite'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      showToast(err?.message || t('Favorite update failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchFreshness = async () => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchCheckFreshness(uuids)
      const updatedRows = outcome.updated || outcome.results || []
      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        const byUuid = new Map(
          updatedRows
            .filter((row) => row && row.uuid)
            .map((row) => [row.uuid, row]),
        )
        if (byUuid.size > 0) {
          setResult((prev) => {
            if (!prev?.games) {
              return prev
            }
            return {
              ...prev,
              games: prev.games.map((game) => {
                const row = byUuid.get(game.uuid)
                if (!row) {
                  return game
                }
                return {
                  ...game,
                  freshness_status: row.status ?? row.freshness_status ?? game.freshness_status,
                  freshness_confidence:
                    row.confidence ?? row.freshness_confidence ?? game.freshness_confidence,
                }
              }),
            }
          })
        }
      }
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Freshness'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      showToast(err?.message || t('Freshness refresh failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchWishlist = async (remove = false) => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy || !wishlistAvailable) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchAddToWishlist(uuids, {
        action: remove ? 'remove' : 'add',
      })
      const touched = new Set([
        ...batchItemUuids(outcome.updated),
        ...(outcome.skipped || [])
          .filter((row) => row?.reason === 'already_pending' && row.uuid)
          .map((row) => row.uuid),
      ])
      if (touched.size) {
        setWishlistPendingIds((prev) => {
          const next = new Set(prev)
          touched.forEach((uuid) => {
            if (remove) next.delete(uuid)
            else next.add(uuid)
          })
          return next
        })
      }
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: remove ? t('Remove from wishlist') : t('Wishlist'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      if (err?.unavailable) {
        setWishlistAvailable(false)
      }
      showToast(err?.message || t('Wishlist update failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchPlayStatus = async (status) => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy || !playStatusAvailable) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchSetPlayStatus(uuids, status)
      applyPlayStatusResults(outcome.updated, status)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Play status'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      if (err?.unavailable) {
        setPlayStatusAvailable(false)
      }
      showToast(err?.message || t('Play status update failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchRefreshImages = async () => {
    const uuids = Array.from(selectedIds)
    if (
      uuids.length === 0 ||
      selectionBusy ||
      !canBatchRefreshImages ||
      !refreshImagesAvailable
    ) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchRefreshImages(uuids)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Refresh covers'),
        successVerb: 'queued',
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      if (err?.unavailable) {
        setRefreshImagesAvailable(false)
      }
      showToast(err?.message || t('Cover refresh failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const pages = Math.max(result?.pages ?? 1, 1)
  const games = result?.games ?? []
  const showSkeleton = loading && !result
  const showRefreshing = loading && Boolean(result)
  const hidePlatformChip = Boolean(filters.library_platform)

  const selectedFavoriteMode = useMemo(() => {
    if (!selectedIds.size) return 'add'
    for (const uuid of selectedIds) {
      if (!favoriteByUuid[uuid]) return 'add'
    }
    return 'remove'
  }, [favoriteByUuid, selectedIds])
  const selectedWishlistMode = useMemo(() => {
    if (!selectedIds.size) return 'add'
    for (const uuid of selectedIds) {
      if (!wishlistPendingIds.has(uuid)) return 'add'
    }
    return 'remove'
  }, [selectedIds, wishlistPendingIds])

  const gridProps = {
    games,
    showPlayStatus: initialConfig.showPlayStatus,
    isAdmin: initialConfig.isAdmin,
    enableDeleteOnDisk: initialConfig.enableDeleteOnDisk,
    hidePlatformChip,
    selectionEnabled: true,
    selectedIds,
    onSelectionToggle: handleSelectionToggle,
    // Filtered to a system, a grouped tile names *that* system rather than the
    // newest one the title exists on — you are looking at that copy.
    activePlatform: filters.library_platform || '',
    layout,
    filters,
  }

  /* Grid does not page.
     Its shelves are genres, each fetching its own covers, so there is no
     "next 50" to walk — the pager offered 138 pages of genre headings that
     never added up to a genre. Tile and Rows still page; See all on a shelf
     hands the genre to Tile, which is the layout built for a long list. */
  const showPager = layout !== 'grid'

  let content
  if (error && !result) {
    content = (
      <PageStatus
        error={error}
        errorMessage={t('Unable to load games.')}
        onRetry={retry}
        retryLabel={t('Retry')}
      />
    )
  } else if (showSkeleton) {
    content = (
      <>
          <GameGridSkeleton count={perPage} layout={layout} />
        {showPager ? (
        <PaginationBar
          page={page}
          pages={1}
          perPage={perPage}
          onPageChange={(nextPage) => {
            clearSelection()
            setPage(nextPage)
          }}
          onPerPageChange={(nextPerPage) => {
            clearSelection()
            setPage(1)
            setPerPage(nextPerPage)
          }}
          t={t}
        />
        ) : null}
      </>
    )
  } else {
    content = (
      <>
        {error && (
          <PageStatus
            error={error}
            errorMessage={t('Unable to refresh games.')}
            onRetry={retry}
            retryLabel={t('Retry')}
          />
        )}
        {/* New chrome mounts selection in the top bar (replaces All/Games/View). */}
        {useNewChrome ? null : (
          <LibrarySelectionBar
            count={selectedIds.size}
            busy={selectionBusy}
            wishlistAvailable={wishlistAvailable}
            playStatusAvailable={playStatusAvailable}
            refreshImagesAvailable={refreshImagesAvailable}
            favoriteMode={selectedFavoriteMode}
            wishlistMode={selectedWishlistMode}
            onFavorite={() => void runBatchFavorite(true)}
            onUnfavorite={() => void runBatchFavorite(false)}
            onRefreshFreshness={() => void runBatchFreshness()}
            onRefreshImages={
              canBatchRefreshImages ? () => void runBatchRefreshImages() : undefined
            }
            onWishlist={() => void runBatchWishlist(false)}
            onWishlistRemove={() => void runBatchWishlist(true)}
            onPlayStatus={(status) => void runBatchPlayStatus(status)}
            onSelectPage={selectPage}
            onClear={clearSelection}
            t={t}
          />
        )}
        <div className={showRefreshing ? 'library-grid-loading' : undefined}>
          {games.length === 0 ? (
            <>
              <GameGrid {...gridProps} />
              <EmptyState initialConfig={initialConfig} t={t} />
            </>
          ) : (
            <GameGrid {...gridProps} />
          )}
        </div>
        {showPager ? (
          <PaginationBar
            page={page}
            pages={pages}
            perPage={perPage}
            onPageChange={(nextPage) => {
              clearSelection()
              setPage(nextPage)
            }}
            onPerPageChange={(nextPerPage) => {
              clearSelection()
              setPage(1)
              setPerPage(nextPerPage)
            }}
            t={t}
          />
        ) : null}
      </>
    )
  }

  // The label already rides along on the game rows, so the backdrop needs no
  // extra fetch and no 70-entry name table to stay in step with the enum.
  const selectedSystemLabel =
    (result?.games ?? []).find(
      (game) => game.library_platform === filters.library_platform,
    )?.library_platform_label || filters.library_platform || ''

  // Kind becomes the segmented control. A URL may still carry several kinds —
  // that keeps working, it just lights no segment, which is honest: the
  // segmented control cannot represent "two of these at once".
  const activeKinds = parseItemKindFilter(filters.item_kind)
  const activeView = activeKinds.length === 1 ? activeKinds[0] : ''
  const kindViews = [
    { id: '', label: t('All') },
    ...ITEM_KIND_FILTER_CHIPS.map((chip) => ({ id: chip.kind, label: t(chip.label) })),
  ]

  function selectKindView(kind) {
    applyFilters(cleanFilters({ ...filters, item_kind: kind || '' }))
  }

  // Everything narrowing the grid that is *hidden* while the popover is shut.
  // Excluded: item_kind (the segmented control shows it in the open) and the
  // sort keys, which always carry a value from user preferences and are not
  // narrowing anything. Counting those showed "Filters 2" on an untouched
  // library, which is worse than no badge — it sends people hunting for a
  // filter they never set.
  const NOT_A_FILTER = new Set(['item_kind', 'sort_by', 'sort_order'])
  const activeFilterCount = Object.entries(cleanFilters(filters)).filter(
    ([key]) => !NOT_A_FILTER.has(key),
  ).length

  const selecting = selectedIds.size > 0
  const selectionBar = (
    <LibrarySelectionBar
      count={selectedIds.size}
      busy={selectionBusy}
      wishlistAvailable={wishlistAvailable}
      playStatusAvailable={playStatusAvailable}
      refreshImagesAvailable={refreshImagesAvailable}
      favoriteMode={selectedFavoriteMode}
      wishlistMode={selectedWishlistMode}
      onFavorite={() => void runBatchFavorite(true)}
      onUnfavorite={() => void runBatchFavorite(false)}
      onRefreshFreshness={() => void runBatchFreshness()}
      onRefreshImages={
        canBatchRefreshImages ? () => void runBatchRefreshImages() : undefined
      }
      onWishlist={() => void runBatchWishlist(false)}
      onWishlistRemove={() => void runBatchWishlist(true)}
      onPlayStatus={(status) => void runBatchPlayStatus(status)}
      onSelectPage={selectPage}
      onClear={clearSelection}
      t={t}
      inTopBar={useNewChrome}
    />
  )

  const filterBar = (
    <div className="library-filters-stack">
      <FilterBar
        filters={filters}
        onApply={applyFilters}
        onLiveSearch={applyLiveSearch}
        onClear={clearFilters}
        t={t}
      />
    </div>
  )

  if (useNewChrome) {
    return (
      <>
        <SystemBackdrop
          platform={filters.library_platform}
          label={selectedSystemLabel}
        />
        <ContextBar
          /* While selecting, the kind / View strip is unused — put the fused
             selection actions in the centre instead (Filters stay). */
          views={selecting ? undefined : kindViews}
          activeView={selecting ? undefined : activeView}
          onSelectView={selecting ? undefined : selectKindView}
          filterCount={activeFilterCount}
          filters={() => (
            <div className="library-filters-stack">
              <FilterBar
                filters={filters}
                onApply={applyFilters}
                onLiveSearch={applyLiveSearch}
                onClear={clearFilters}
                t={t}
                hideKind
              />
            </div>
          )}
          summary={
            selecting
              ? null
              : typeof result?.total === 'number'
                ? `${result.total.toLocaleString()} ${t('titles')}`
                : null
          }
          t={t}
          viewUnfurl={
            selecting
              ? null
              : {
                  views: CATALOG_LAYOUTS.map((view) => ({
                    ...view,
                    label: t(view.label),
                  })),
                  active: layout,
                  onSelect: setLayout,
                  triggerLabel: t('View'),
                }
          }
          actions={selecting ? selectionBar : null}
        />
        {/* No aside, no collapse rail, no page header — the grid gets the
            whole width, which is the visible payoff of the refresh. */}
        <div className="library-layout is-chrome-v2">
          <div className="library-layout__main">{content}</div>
        </div>
      </>
    )
  }

  return (
    <>
    <SystemBackdrop
      platform={filters.library_platform}
      label={selectedSystemLabel}
    />
    <div className="library-layout">
      {/* Filters render into the rail (GT-B4) — see #od-rail-slot in SideRail.
          They used to be a 17.5rem sticky aside sitting immediately right of
          the rail: two left-hand panels, which is what read as broken, plus a
          collapse tab that clipped itself against the top of the column.

          A portal rather than props or lifted state: every filter handler stays
          here, only the markup moves, and the shell never has to know what a
          filter is. When the rail is absent (Big Picture, tests) it falls back
          to rendering in place rather than vanishing. */}
      {railSlot ? (
        createPortal(filterBar, railSlot)
      ) : (
        <aside
          id={filtersPanelId}
          className="library-layout__filters"
          aria-label={t('Library filters')}
        >
          {filterBar}
        </aside>
      )}

      <div className="library-layout__main">{content}</div>
    </div>
    </>
  )
}
