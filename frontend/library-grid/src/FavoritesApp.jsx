import { useEffect, useState } from 'react'
import { fetchFavoriteGames } from './api/favorites'
import { GameGrid } from './components/GameGrid'

export function FavoritesApp({ initialConfig }) {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setError(null)
    fetchFavoriteGames({ signal: controller.signal })
      .then((result) => {
        if (active) {
          setGames(result.games ?? [])
        }
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
  }, [retryCount])

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

  if (games.length === 0) {
    return <p>You haven't added any favorites yet!</p>
  }

  return (
    <GameGrid
      games={games}
      showPlayStatus={initialConfig.showPlayStatus}
      isAdmin={initialConfig.isAdmin}
      onToggleFavorite={(gameUuid, isFavorite) => {
        if (!isFavorite) {
          setGames((currentGames) =>
            currentGames.filter((game) => game.uuid !== gameUuid),
          )
        }
      }}
    />
  )
}
