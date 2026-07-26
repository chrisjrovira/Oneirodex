import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { fetchBrowseGames } from './api/browse'
import { applyPlatformSkin, clearPlatformSkin } from './chrome/platformSkins'
import { cleanFilters, FilterBar } from './components/FilterBar'
import { GameGrid } from './components/GameGrid'
import { GameGridSkeleton } from './components/GameGridSkeleton'
import { PaginationBar } from './components/PaginationBar'
import { createTranslator } from './i18n'
import { readLibraryFilters, writeLibraryFilters } from './utils/cookies'

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
  const libraryPlatform = searchParams.get('library_platform')
  if (!libraryPlatform) {
    return {}
  }
  return { library_platform: libraryPlatform }
}

export function LibraryApp({ initialConfig, shellConfig: _shellConfig } = {}) {
  const t = useMemo(
    () => createTranslator(initialConfig.locale),
    [initialConfig.locale],
  )
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(initialConfig.perPage)
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

  useEffect(() => {
    const fromUrl = filtersFromSearchParams(searchParams)
    if (!fromUrl.library_platform) {
      return
    }
    setFilters((current) => {
      if (current.library_platform === fromUrl.library_platform) {
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

  const retry = () => {
    setRetryCount((count) => count + 1)
  }

  const applyFilters = (nextFilters) => {
    writeLibraryFilters(nextFilters)
    setPage(1)
    setFilters(nextFilters)
  }

  const clearFilters = () => {
    writeLibraryFilters(defaultFilters)
    setPage(1)
    setFilters(defaultFilters)
  }

  const pages = Math.max(result?.pages ?? 1, 1)
  const games = result?.games ?? []
  const showSkeleton = loading && !result
  const showRefreshing = loading && Boolean(result)
  const hidePlatformChip = Boolean(filters.library_platform)

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
          onPageChange={setPage}
          onPerPageChange={(nextPerPage) => {
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
        <div className={showRefreshing ? 'library-grid-loading' : undefined}>
          {games.length === 0 ? (
            <>
              <GameGrid
                games={games}
                showPlayStatus={initialConfig.showPlayStatus}
                isAdmin={initialConfig.isAdmin}
                enableDeleteOnDisk={initialConfig.enableDeleteOnDisk}
                discordConfigured={initialConfig.discordConfigured}
                discordManualTrigger={initialConfig.discordManualTrigger}
                hidePlatformChip={hidePlatformChip}
              />
              <EmptyState initialConfig={initialConfig} t={t} />
            </>
          ) : (
            <GameGrid
              games={games}
              showPlayStatus={initialConfig.showPlayStatus}
              isAdmin={initialConfig.isAdmin}
              enableDeleteOnDisk={initialConfig.enableDeleteOnDisk}
              discordConfigured={initialConfig.discordConfigured}
              discordManualTrigger={initialConfig.discordManualTrigger}
              hidePlatformChip={hidePlatformChip}
            />
          )}
        </div>
        <PaginationBar
          page={page}
          pages={pages}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(nextPerPage) => {
            setPage(1)
            setPerPage(nextPerPage)
          }}
          t={t}
        />
      </>
    )
  }

  const filterBar = (
    <FilterBar
      filters={filters}
      onApply={applyFilters}
      onClear={clearFilters}
      t={t}
    />
  )
  const filtersRoot = document.getElementById('library-filters-root')

  return (
    <>
      {filtersRoot ? createPortal(filterBar, filtersRoot) : filterBar}
      {content}
    </>
  )
}
