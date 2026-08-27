import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ContextBar, Popover } from '../chrome/ContextBar'
import { RailIcon } from '../chrome/railIcons'
import { createCollection, deleteCollection, fetchCollections } from '../api/collections'
import { PageStatus } from '../components/PageStatus'
import './Collections.css'

function itemCountLabel(collection) {
  const count = Number(collection.item_count)
  if (!Number.isFinite(count)) {
    return null
  }
  return count === 1 ? '1 game' : `${count} games`
}

export function CollectionsPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [collections, setCollections] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [deletingUuid, setDeletingUuid] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setCollections(null)

    fetchCollections({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setCollections(Array.isArray(data.collections) ? data.collections : [])
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

  async function handleCreate(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || creating) {
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      const created = await createCollection({
        name: trimmedName,
        description: description.trim(),
        isPublic,
      })
      setCollections((current) => [created, ...(current || [])])
      setName('')
      setDescription('')
      setIsPublic(true)
    } catch (submitError) {
      setCreateError(submitError)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(collection) {
    if (!collection?.can_edit || collection.is_system || deletingUuid) {
      return
    }
    const confirmed = window.confirm(
      `Delete collection “${collection.name}”? This cannot be undone.`,
    )
    if (!confirmed) {
      return
    }
    setDeletingUuid(collection.uuid)
    try {
      await deleteCollection(collection.uuid)
      setCollections((current) =>
        (current || []).filter((row) => row.uuid !== collection.uuid),
      )
    } catch (deleteError) {
      window.alert(deleteError.message || 'Unable to delete that collection.')
    } finally {
      setDeletingUuid(null)
    }
  }

  return (
    <>
    {useNewChrome ? (
        <ContextBar
          summary={collections ? `${collections.length} shelves` : null}
          actions={
            /* "New shelf", with the same glyph the rail uses for Collections.
               The page calls them shelves in its own copy and its own count, so
               a button labelled "New collection" was the only place the word
               changed — which is why there appeared to be "no way to make
               shelves". A Collection *is* a shelf; see models.Collection. */
            <Popover label="New shelf" icon={<RailIcon name="collections" size={16} />}>
          <form className="gt-collections__form" onSubmit={handleCreate}>
            <label className="gt-collections__field">
              Name
              <input
                type="text"
                maxLength={120}
                required
                placeholder="Cozy co-op nights"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="gt-collections__field">
              Description
              <input
                type="text"
                maxLength={400}
                placeholder="Optional"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="gt-collections__check">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              Public
            </label>
            <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create shelf'}
            </button>
            {createError ? (
              <PageStatus
                error={createError}
                errorMessage={createError.message || 'Unable to create collection.'}
                className="gt-collections__error"
              />
            ) : null}
          </form>
            </Popover>
          }
        />
      ) : null}
    <div className="gt-more-page gt-collections">
      {useNewChrome ? null : (
        <>
        <div className="gt-page-header">
          <h1>Collections</h1>
        </div>
        <p className="gt-more-page__lede">
          Curated shelves you and others share across the library.
        </p>

        <form className="gt-collections__form" onSubmit={handleCreate}>
          <label className="gt-collections__field">
            Name
            <input
              type="text"
              maxLength={120}
              required
              placeholder="Cozy co-op nights"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="gt-collections__field">
            Description
            <input
              type="text"
              maxLength={400}
              placeholder="Optional"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="gt-collections__check">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            Public
          </label>
          <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create shelf'}
          </button>
          {createError ? (
            <PageStatus
              error={createError}
              errorMessage={createError.message || 'Unable to create collection.'}
              className="gt-collections__error"
            />
          ) : null}
        </form>
        </>
      )}

      <PageStatus
        loading={!error && !collections}
        error={error}
        errorMessage="Unable to load collections."
        loadingMessage="Loading shelves…"
        onRetry={() => setRetryCount((n) => n + 1)}
      />

      {!error && collections && collections.length === 0 ? (
        <p>
          {useNewChrome
            ? 'No collections yet. Create your first one from New shelf above.'
            : 'No collections yet. Create your first shelf with the form above.'}
        </p>
      ) : null}

      {!error && collections && collections.length > 0 ? (
        <ul className="gt-collections__list">
          {collections.map((collection) => {
            const countLabel = itemCountLabel(collection)
            return (
              <li key={collection.uuid} className="gt-collections__row">
                <Link
                  className="gt-collections__card"
                  to={`/collections/${collection.uuid}`}
                >
                  <strong>{collection.name}</strong>
                  <span className="gt-collections__card-desc">
                    {collection.description || 'No description'}
                  </span>
                  <span className="gt-collections__meta">
                    {collection.is_public ? 'Public' : 'Private'}
                    {collection.is_system ? ' · System' : ''}
                    {countLabel ? ` · ${countLabel}` : ''}
                  </span>
                </Link>
                {collection.can_edit && !collection.is_system ? (
                  <button
                    type="button"
                    className="gt-collections__delete"
                    disabled={deletingUuid === collection.uuid}
                    onClick={() => handleDelete(collection)}
                  >
                    {deletingUuid === collection.uuid ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
    </>
  )
}
