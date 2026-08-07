import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  LibraryFiltersCollapseToggle,
  readFiltersVisible,
  writeFiltersVisible,
} from './components/FilterBar'
import './components/libraryFilters.css'
import { GameGrid } from './components/GameGrid'
import { GameGridSkeleton } from './components/GameGridSkeleton'
import { LibrarySelectionBar } from './components/LibrarySelectionBar'
import { PaginationBar } from './components/PaginationBar'
import { createTranslator } from './i18n'
import { batchItemUuids, summarizeBatchOutcome } from './utils/batchOutcome'
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
  const genre = searchParams.get('genre')
  if (genre) {
    next.genre = genre
  }
  const theme = searchParams.get('theme')
  if (theme) {
    next.theme = theme
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
    searchParams.has('genre') ||
    searchParams.has('theme') ||
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
  const filtersPanelId = useId()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(initialConfig.perPage)
  const [filtersOpen, setFiltersOpen] = useState(false)
  /** Desktop LHN: false = full panel, true = slim arrow rail (grid reclaims width). */
  const [filtersCollapsed, setFiltersCollapsed] = useState(() => !readFiltersVisible())
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
        current.genre === fromUrl.genre &&
        current.theme === fromUrl.theme &&
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
    function onResize() {
      if (window.matchMedia('(min-width: 901px)').matches) {
        setFiltersOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
      if (filtersOpen) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [filtersOpen, selectedIds.size])

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
    setFiltersOpen(false)
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
    setFiltersOpen(false)
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

  const runBatchWishlist = async () => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy || !wishlistAvailable) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchAddToWishlist(uuids)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Wishlist'),
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

  const gridProps = {
    games,
    showPlayStatus: initialConfig.showPlayStatus,
    isAdmin: initialConfig.isAdmin,
    enableDeleteOnDisk: initialConfig.enableDeleteOnDisk,
    hidePlatformChip,
    selectionEnabled: true,
    selectedIds,
    onSelectionToggle: handleSelectionToggle,
  }

  let content
  if (error && !result) {
    content = (
      <div role="alert">
        <p>{t('Unable to load games.')}</p>
        <button type="button" className="gt-btn" onClick={retry}>
          {t('Retry')}
        </button>
      </div>
    )
  } else if (showSkeleton) {
    content = (
      <>
        <GameGridSkeleton count={perPage} />
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
      </>
    )
  } else {
    content = (
      <>
        {error && (
          <div role="alert">
            <p>{t('Unable to refresh games.')}</p>
            <button type="button" className="gt-btn" onClick={retry}>
              {t('Retry')}
            </button>
          </div>
        )}
        <LibrarySelectionBar
          count={selectedIds.size}
          busy={selectionBusy}
          wishlistAvailable={wishlistAvailable}
          playStatusAvailable={playStatusAvailable}
          refreshImagesAvailable={refreshImagesAvailable}
          onFavorite={() => void runBatchFavorite(true)}
          onUnfavorite={() => void runBatchFavorite(false)}
          onRefreshFreshness={() => void runBatchFreshness()}
          onRefreshImages={
            canBatchRefreshImages ? () => void runBatchRefreshImages() : undefined
          }
          onWishlist={() => void runBatchWishlist()}
          onPlayStatus={(status) => void runBatchPlayStatus(status)}
          onSelectPage={selectPage}
          onClear={clearSelection}
          t={t}
        />
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
      </>
    )
  }

  const toggleFiltersCollapsed = () => {
    setFiltersCollapsed((current) => {
      const next = !current
      writeFiltersVisible(!next)
      return next
    })
  }

  // The label already rides along on the game rows, so the backdrop needs no
  // extra fetch and no 70-entry name table to stay in step with the enum.
  const selectedSystemLabel =
    (result?.games ?? []).find(
      (game) => game.library_platform === filters.library_platform,
    )?.library_platform_label || filters.library_platform || ''

  const useNewChrome = Boolean(shellConfig.enableNewChrome)

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
  // Kind is excluded because the segmented control shows it in the open.
  const activeFilterCount = Object.entries(cleanFilters(filters)).filter(
    ([key]) => key !== 'item_kind',
  ).length

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
          views={kindViews}
          activeView={activeView}
          onSelectView={selectKindView}
          filterCount={activeFilterCount}
          filters={
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
          }
          summary={
            typeof result?.total === 'number'
              ? `${result.total.toLocaleString()} ${t('titles')}`
              : null
          }
          t={t}
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
    <div
      className={`library-layout${filtersCollapsed ? ' is-filters-collapsed' : ''}`}
    >
      <button
        type="button"
        className="library-filters-mobile-toggle"
        aria-expanded={filtersOpen}
        aria-controls={filtersPanelId}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        {filtersOpen ? t('Close filters') : t('Filters')}
      </button>

      {filtersOpen ? (
        <button
          type="button"
          className="library-filters-backdrop"
          aria-label={t('Close filters')}
          onClick={() => setFiltersOpen(false)}
        />
      ) : null}

      <aside
        id={filtersPanelId}
        className={`library-layout__filters${filtersOpen ? ' is-open' : ''}`}
        aria-label={t('Library filters')}
      >
        {filterBar}
        {/* Last child, and styled as a tab on the panel's own trailing edge —
            it belongs to the filter section rather than floating over the grid. */}
        <LibraryFiltersCollapseToggle
          collapsed={filtersCollapsed}
          onToggle={toggleFiltersCollapsed}
          controlsId={filtersPanelId}
          t={t}
        />
      </aside>

      <div className="library-layout__main">{content}</div>
    </div>
    </>
  )
}
