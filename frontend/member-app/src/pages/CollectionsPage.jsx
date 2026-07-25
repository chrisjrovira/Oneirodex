import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createCollection, fetchCollections } from '../api/collections'
import './Collections.css'

export function CollectionsPage({ shellConfig: _shellConfig } = {}) {
  const [collections, setCollections] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

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

  return (
    <div className="gt-more-page gt-collections">
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
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create'}
        </button>
        {createError ? (
          <p className="gt-collections__error" role="alert">
            {createError.message || 'Unable to create collection.'}
          </p>
        ) : null}
      </form>

      {error ? (
        <div role="alert">
          <p>Unable to load collections.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !collections ? <p>Loading…</p> : null}

      {!error && collections && collections.length === 0 ? (
        <p>No collections yet. Create your first shelf with the form above.</p>
      ) : null}

      {!error && collections && collections.length > 0 ? (
        <ul className="gt-collections__list">
          {collections.map((collection) => (
            <li key={collection.uuid}>
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
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
