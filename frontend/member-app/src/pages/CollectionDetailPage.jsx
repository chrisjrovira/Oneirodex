import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addCollectionItem, fetchCollection } from '../api/collections'
import './Collections.css'

function loadErrorMessage(error) {
  if (error?.status === 404) {
    return 'That collection does not exist.'
  }
  if (error?.status === 403) {
    return 'This collection is private.'
  }
  return 'Unable to load this collection.'
}

export function CollectionDetailPage({ shellConfig: _shellConfig } = {}) {
  const { collectionUuid } = useParams()
  const [collection, setCollection] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [gameUuid, setGameUuid] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setCollection(null)

    fetchCollection(collectionUuid, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setCollection(data)
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
  }, [collectionUuid, retryCount])

  async function handleAdd(event) {
    event.preventDefault()
    const trimmedUuid = gameUuid.trim()
    if (!trimmedUuid || adding) {
      return
    }

    setAdding(true)
    setAddError(null)
    try {
      const item = await addCollectionItem(collectionUuid, trimmedUuid)
      setCollection((current) => {
        if (!current) {
          return current
        }
        const items = current.items || []
        if (items.some((row) => row.id === item.id)) {
          return current
        }
        return { ...current, items: [...items, item] }
      })
      setGameUuid('')
    } catch (submitError) {
      setAddError(submitError)
    } finally {
      setAdding(false)
    }
  }

  const items = collection?.items || []

  return (
    <div className="gt-more-page gt-collection">
      <p className="gt-collection__crumb">
        <Link to="/collections">← Collections</Link>
      </p>
      <div className="gt-page-header">
        <h1>{collection?.name || 'Collection'}</h1>
      </div>
      {collection?.description ? (
        <p className="gt-more-page__lede">{collection.description}</p>
      ) : null}

      {error ? (
        <div role="alert">
          <p>{loadErrorMessage(error)}</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !collection ? <p>Loading…</p> : null}

      {!error && collection && items.length === 0 ? (
        <p>No games in this collection yet. Add one with its game ID below.</p>
      ) : null}

      {!error && items.length > 0 ? (
        <ul className="gt-collection__items">
          {items.map((item) => (
            <li key={item.id} className="gt-collection__item">
              <a href={`/game_details/${item.game_uuid}`}>
                <strong>{item.game_name || item.game_uuid}</strong>
                <span className="gt-collections__meta">Open game</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {!error && collection ? (
        <details className="gt-collection__add">
          <summary>Add a game</summary>
          <p>
            Paste a game ID — it is the last part of a game details URL, for example
            <code> /game_details/&lt;game id&gt;</code>. Only the collection owner and
            admins can add games.
          </p>
          <form onSubmit={handleAdd}>
            <label className="gt-collections__field">
              Game ID
              <input
                type="text"
                value={gameUuid}
                onChange={(event) => setGameUuid(event.target.value)}
              />
            </label>
            <button type="submit" disabled={adding}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </form>
          {addError ? (
            <p className="gt-collections__error" role="alert">
              {addError.message || 'Unable to add that game.'}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  )
}
