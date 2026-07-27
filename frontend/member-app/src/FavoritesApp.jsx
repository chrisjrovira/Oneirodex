import { useEffect, useState } from 'react'
import { fetchFavoriteGames } from './api/favorites'
import { GameGrid } from './components/GameGrid'
import { PaginationBar } from './components/PaginationBar'

export function FavoritesApp({ initialConfig, shellConfig } = {}) {
  const defaultPerPage = Number(shellConfig?.perPage) || Number(initialConfig?.perPage) || 20
  const [games, setGames] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(defaultPerPage)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setError(null)
    setGames(null)
    fetchFavoriteGames(
      { page, per_page: perPage },
      { signal: controller.signal },
    )
      .then((result) => {
        if (!active) return
        setGames(result.games ?? [])
        setPages(Number(result.pages) || 1)
        setTotal(Number(result.total) || 0)
      })
      .catch((requestError) => {
        if (active && requestError.name !== 'AbortError') {
          setError(requestError)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [page, perPage, retryCount])

  if (error) {
    return (
      <div role="alert">
        <p>Unable to load favorites.</p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
          Retry
        </button>
      </div>
    )
  }

  if (!games) {
    return <p>Loading favorites…</p>
  }

  if (games.length === 0 && total === 0) {
    return <p>You haven't added any favorites yet!</p>
  }

  return (
    <>
      <GameGrid
        games={games}
        showPlayStatus={initialConfig.showPlayStatus}
        isAdmin={initialConfig.isAdmin}
        onToggleFavorite={(gameUuid, isFavorite) => {
          if (!isFavorite) {
            setGames((currentGames) =>
              currentGames.filter((game) => game.uuid !== gameUuid),
            )
            setTotal((n) => Math.max(0, n - 1))
          }
        }}
      />
      <PaginationBar
        page={page}
        pages={pages}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(next) => {
          setPage(1)
          setPerPage(next)
        }}
      />
    </>
  )
}
