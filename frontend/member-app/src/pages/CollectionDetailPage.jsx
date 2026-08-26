import { useEffect, useRef, useState } from 'react'
import { ContextBar } from '../chrome/ContextBar'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addCollectionItem,
  deleteCollection,
  fetchCollection,
  removeCollectionItem,
  reorderCollectionItems,
  searchGames,
  updateCollection,
} from '../api/collections'
import { applyPlatformSkin, clearPlatformSkin, sharedPlatform } from '../chrome/platformSkins'
import { PageStatus } from '../components/PageStatus'
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

export function CollectionDetailPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const { collectionUuid } = useParams()
  const navigate = useNavigate()
  const [collection, setCollection] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingUuid, setAddingUuid] = useState(null)
  const [addError, setAddError] = useState(null)
  const [removingUuid, setRemovingUuid] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPublic, setEditIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [reordering, setReordering] = useState(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setCollection(null)

    fetchCollection(collectionUuid, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setCollection(data)
          setEditName(data.name || '')
          setEditDescription(data.description || '')
          setEditIsPublic(Boolean(data.is_public))
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

  useEffect(() => {
    const platform = sharedPlatform(collection?.items || [])
    if (platform) {
      applyPlatformSkin(platform)
    } else {
      clearPlatformSkin()
    }
    return () => {
      clearPlatformSkin()
    }
  }, [collection])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return undefined
    }

    const controller = new AbortController()
    const seq = ++searchSeq.current
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchGames(trimmed, { signal: controller.signal })
        .then((rows) => {
          if (seq === searchSeq.current) {
            setResults(rows)
          }
        })
        .catch((searchError) => {
          if (searchError.name !== 'AbortError' && seq === searchSeq.current) {
            setResults([])
            setAddError(searchError)
          }
        })
        .finally(() => {
          if (seq === searchSeq.current) {
            setSearching(false)
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  async function handleSave(event) {
    event.preventDefault()
    if (!collection?.can_edit || collection.is_system || saving) {
      return
    }
    const trimmedName = editName.trim()
    if (!trimmedName) {
      setSaveError(new Error('Name is required.'))
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateCollection(collectionUuid, {
        name: trimmedName,
        description: editDescription.trim(),
        isPublic: editIsPublic,
      })
      setCollection(updated)
      setEditName(updated.name || '')
      setEditDescription(updated.description || '')
      setEditIsPublic(Boolean(updated.is_public))
    } catch (submitError) {
      setSaveError(submitError)
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(game) {
    if (!game?.uuid || addingUuid || !collection?.can_edit) {
      return
    }
    setAddingUuid(game.uuid)
    setAddError(null)
    try {
      const item = await addCollectionItem(collectionUuid, game.uuid)
      setCollection((current) => {
        if (!current) {
          return current
        }
        const items = current.items || []
        if (items.some((row) => row.game_uuid === item.game_uuid || row.id === item.id)) {
          return current
        }
        return {
          ...current,
          items: [...items, item],
          item_count: (current.item_count || items.length) + 1,
        }
      })
      setQuery('')
      setResults([])
    } catch (submitError) {
      setAddError(submitError)
    } finally {
      setAddingUuid(null)
    }
  }

  async function handleRemove(gameUuid) {
    if (!gameUuid || removingUuid || !collection?.can_edit) {
      return
    }
    setRemovingUuid(gameUuid)
    try {
      await removeCollectionItem(collectionUuid, gameUuid)
      setCollection((current) => {
        if (!current) {
          return current
        }
        const items = (current.items || []).filter((row) => row.game_uuid !== gameUuid)
        return {
          ...current,
          items,
          item_count: items.length,
        }
      })
    } catch (removeError) {
      window.alert(removeError.message || 'Unable to remove that game.')
    } finally {
      setRemovingUuid(null)
    }
  }

  async function handleMove(index, direction) {
    if (!collection?.can_edit || reordering) {
      return
    }
    const items = collection.items || []
    const target = index + direction
    if (target < 0 || target >= items.length) {
      return
    }
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    const gameUuids = next.map((item) => item.game_uuid)
    setReordering(true)
    try {
      const updated = await reorderCollectionItems(collectionUuid, gameUuids)
      setCollection(updated)
    } catch (reorderError) {
      window.alert(reorderError.message || 'Unable to reorder games.')
    } finally {
      setReordering(false)
    }
  }

  async function handleDeleteCollection() {
    if (!collection?.can_edit || collection.is_system || deleting) {
      return
    }
    const confirmed = window.confirm(
      `Delete collection “${collection.name}”? This cannot be undone.`,
    )
    if (!confirmed) {
      return
    }
    setDeleting(true)
    try {
      await deleteCollection(collectionUuid)
      navigate('/collections')
    } catch (deleteError) {
      window.alert(deleteError.message || 'Unable to delete that collection.')
      setDeleting(false)
    }
  }

  const items = collection?.items || []
  const existingUuids = new Set(items.map((item) => item.game_uuid))
  const canEditMeta = Boolean(collection?.can_edit && !collection.is_system)

  return (
    <>
    {/* The heading here is the collection's *name*, not the page's. The v2
          retirement rule matches `.gt-page-header > h1`, so under the new
          chrome this page was rendering with nothing at all to say which
          collection you were looking at. It moves to bar two's summary. */}
      {useNewChrome ? (
        <ContextBar
          summary={collection?.name || 'Collection'}
          actions={
            canEditMeta ? (
              <button
                type="button"
                className="gt-cbtn"
                disabled={deleting}
                onClick={handleDeleteCollection}
              >
                {deleting ? 'Deleting…' : 'Delete collection'}
              </button>
            ) : null
          }
        />
      ) : null}
    <div className="gt-more-page gt-collection">
      <p className="gt-collection__crumb">
        <Link to="/collections">← Collections</Link>
      </p>
      {useNewChrome ? null : (
        <>
        <div className="gt-page-header gt-collection__header">
          <h1>{collection?.name || 'Collection'}</h1>
          {canEditMeta ? (
            <button
              type="button"
              className="gt-collections__delete"
              disabled={deleting}
              onClick={handleDeleteCollection}
            >
              {deleting ? 'Deleting…' : 'Delete collection'}
            </button>
          ) : null}
        </div>
        </>
      )}
      {collection?.description && !canEditMeta ? (
        <p className="gt-more-page__lede">{collection.description}</p>
      ) : null}

      {canEditMeta ? (
        <form className="gt-collections__form" onSubmit={handleSave}>
          <label className="gt-collections__field">
            Name
            <input
              type="text"
              maxLength={120}
              required
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </label>
          <label className="gt-collections__field">
            Description
            <input
              type="text"
              maxLength={4000}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
          </label>
          <label className="gt-collections__check">
            <input
              type="checkbox"
              checked={editIsPublic}
              onChange={(event) => setEditIsPublic(event.target.checked)}
            />
            Public
          </label>
          <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saveError ? (
            <p className="gt-collections__error" role="alert">
              {saveError.message || 'Unable to save changes.'}
            </p>
          ) : null}
        </form>
      ) : null}

      <PageStatus
        loading={!error && !collection}
        error={error}
        errorMessage={error ? loadErrorMessage(error) : null}
        loadingMessage="Loading shelf…"
        onRetry={() => setRetryCount((n) => n + 1)}
      />

      {!error && collection && items.length === 0 ? (
        <p>No games in this collection yet. Search below to add one.</p>
      ) : null}

      {!error && items.length > 0 ? (
        <ul className="gt-collection__items">
          {items.map((item, index) => (
            <li key={item.id} className="gt-collection__item">
              <a href={`/game_details/${item.game_uuid}`}>
                <strong>{item.game_name || item.game_uuid}</strong>
                <span className="gt-collections__meta">Open game</span>
              </a>
              {collection.can_edit ? (
                <div className="gt-collection__item-actions">
                  <button
                    type="button"
                    className="gt-collections__reorder"
                    disabled={reordering || index === 0}
                    onClick={() => handleMove(index, -1)}
                    aria-label={`Move ${item.game_name || item.game_uuid} up`}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="gt-collections__reorder"
                    disabled={reordering || index === items.length - 1}
                    onClick={() => handleMove(index, 1)}
                    aria-label={`Move ${item.game_name || item.game_uuid} down`}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="gt-collections__remove"
                    disabled={removingUuid === item.game_uuid}
                    onClick={() => handleRemove(item.game_uuid)}
                  >
                    {removingUuid === item.game_uuid ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!error && collection?.can_edit ? (
        <details className="gt-collection__add" open>
          <summary>Add a game</summary>
          <p>Search the library by title, then pick a result to add.</p>
          <label className="gt-collections__field">
            Search games
            <input
              type="search"
              value={query}
              placeholder="Start typing a title…"
              onChange={(event) => {
                setAddError(null)
                setQuery(event.target.value)
              }}
            />
          </label>
          {searching ? <p className="gt-collections__meta">Searching…</p> : null}
          {!searching && query.trim().length >= 2 && results.length === 0 ? (
            <p className="gt-collections__meta">No matching games.</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="gt-collection__picker">
              {results.map((game) => {
                const already = existingUuids.has(game.uuid)
                return (
                  <li key={game.uuid}>
                    <button
                      type="button"
                      className="gt-collection__picker-item"
                      disabled={already || addingUuid === game.uuid}
                      onClick={() => handleAdd(game)}
                    >
                      <strong>{game.name}</strong>
                      <span>
                        {already
                          ? 'Already added'
                          : addingUuid === game.uuid
                            ? 'Adding…'
                            : 'Add'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {addError ? (
            <p className="gt-collections__error" role="alert">
              {addError.message || 'Unable to add that game.'}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
    </>
  )
}
