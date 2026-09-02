import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageStatus } from './PageStatus'
import { useSearchParams } from 'react-router-dom'
import { ArtworkPicker } from './ArtworkPicker'
import { DataTable } from './DataTable'
import { deleteJson, getJson, postJson } from './adminApi'
import { ART_STUDIO_SYSTEMS } from './platformSkins'

/** Backend policy for “best available” mass cover apply. */
const BEST_AVAILABLE_POLICY = 'sgdb_then_igdb_then_generate'

/** Store/service labels useful as covers/batch `service` filters (library-name match). */
const SERVICE_SOURCE_IDS = new Set(['steam', 'gog', 'epic', 'itch', 'meta_quest'])

/** Locked image kind taxonomy (BE-DET-10) — keep in sync with oneirodex/utils/image_kinds.py. */
const IMAGE_KIND_OPTIONS = [
  { id: 'cover', label: 'Covers' },
  { id: 'screenshot', label: 'Screenshots' },
  { id: 'box', label: 'Box' },
  { id: 'cart', label: 'Cart/disc label' },
  { id: 'disc', label: 'Disc' },
  { id: 'logo', label: 'Logo' },
  { id: 'hero', label: 'Hero' },
  { id: 'fanart', label: 'Fan art' },
]

function groupByGame(images) {
  const groups = new Map()
  for (const image of images) {
    const key = image.game_uuid || 'unknown'
    if (!groups.has(key)) {
      groups.set(key, {
        name: image.game_name || 'Unknown',
        uuid: image.game_uuid || '',
        items: [],
      })
    }
    groups.get(key).items.push(image)
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function queueFailureText(image) {
  return image.failure_reason || image.last_error || ''
}

export function ImagesPage({ embedded = false }) {
  const [params, setParams] = useSearchParams()
  const [gameUuid, setGameUuid] = useState(params.get('game') || '')
  const [gameName, setGameName] = useState(params.get('name') || '')
  const [gameQuery, setGameQuery] = useState('')
  const [gameHits, setGameHits] = useState([])

  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('cover')
  const [groupToggle, setGroupToggle] = useState(true)
  const [images, setImages] = useState([])
  const [pathStatus, setPathStatus] = useState(null)
  const [queueError, setQueueError] = useState('')
  const [queueMsg, setQueueMsg] = useState('')
  const [queueBusy, setQueueBusy] = useState('')
  const [loadingQueue, setLoadingQueue] = useState(true)

  const [missingCovers, setMissingCovers] = useState([])
  const [missingError, setMissingError] = useState('')
  const [libraries, setLibraries] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [serviceOptions, setServiceOptions] = useState([])
  const [libraryFilter, setLibraryFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')

  const syncGameParam = useCallback(
    (uuid, name) => {
      setGameUuid(uuid)
      setGameName(name || '')
      const next = new URLSearchParams(params)
      if (uuid) {
        next.set('game', uuid)
        if (name) next.set('name', name)
      } else {
        next.delete('game')
        next.delete('name')
      }
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true)
    setQueueError('')
    try {
      const qs = new URLSearchParams({
        page: '1',
        per_page: groupToggle ? '500' : '50',
        status: statusFilter,
        type: typeFilter,
      })
      const data = await getJson(`/admin/api/image_queue_list?${qs}`)
      setImages(Array.isArray(data.images) ? data.images : [])
      setPathStatus(data.image_save_path || null)
    } catch (err) {
      setQueueError(err.message || String(err))
      setImages([])
      setPathStatus(null)
    } finally {
      setLoadingQueue(false)
    }
  }, [statusFilter, typeFilter, groupToggle])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  useEffect(() => {
    getJson('/api/get_libraries')
      .then((rows) => setLibraries(Array.isArray(rows) ? rows : []))
      .catch(() => setLibraries([]))
    getJson('/api/library_platforms')
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) {
          setPlatforms(
            rows.map((p) => ({
              id: p.id || p.value || p.name,
              label: p.name || p.id || p.value,
            })),
          )
          return
        }
        setPlatforms(
          ART_STUDIO_SYSTEMS.filter((s) => s.id).map((s) => ({ id: s.id, label: s.label })),
        )
      })
      .catch(() => {
        setPlatforms(
          ART_STUDIO_SYSTEMS.filter((s) => s.id).map((s) => ({ id: s.id, label: s.label })),
        )
      })
    getJson('/api/search_metadata/sources')
      .then((data) => {
        const sources = Array.isArray(data.sources) ? data.sources : []
        setServiceOptions(
          sources
            .filter((s) => SERVICE_SOURCE_IDS.has(s.id))
            .map((s) => ({ id: s.id, label: s.name || s.id })),
        )
      })
      .catch(() => setServiceOptions([]))
  }, [])

  const loadMissing = useCallback(async () => {
    setMissingError('')
    try {
      const qs = new URLSearchParams({ limit: '200' })
      if (libraryFilter) qs.set('library_uuid', libraryFilter)
      const data = await getJson(`/api/health/library?${qs}`)
      const worst = Array.isArray(data.worst) ? data.worst : []
      setMissingCovers(
        worst.filter((g) => (g.issues || []).some((i) => i.code === 'missing_cover')),
      )
    } catch (err) {
      setMissingError(err.message || String(err))
      setMissingCovers([])
    }
  }, [libraryFilter])

  useEffect(() => {
    loadMissing()
  }, [loadMissing])

  const searchGames = useCallback(async () => {
    const q = gameQuery.trim()
    if (!q) {
      setGameHits([])
      return
    }
    try {
      const rows = await getJson(`/api/search?query=${encodeURIComponent(q)}`)
      setGameHits(Array.isArray(rows) ? rows.slice(0, 12) : [])
    } catch {
      setGameHits([])
    }
  }, [gameQuery])

  const groups = useMemo(
    () => (groupToggle ? groupByGame(images) : null),
    [groupToggle, images],
  )

  const downloadBatch = async (size) => {
    setQueueBusy(`batch-${size}`)
    setQueueMsg('')
    setQueueError('')
    try {
      const result = await postJson('/admin/api/download_images', { batch_size: size })
      setQueueMsg(result.message || `Downloaded ${result.downloaded || 0}`)
      await loadQueue()
    } catch (err) {
      setQueueError(err.message || String(err))
    } finally {
      setQueueBusy('')
    }
  }

  const retryFailed = async () => {
    setQueueBusy('retry')
    setQueueMsg('')
    setQueueError('')
    try {
      const result = await postJson('/admin/api/download_images', { retry_failed: true })
      setQueueMsg(result.message || 'Retry finished')
      if (result.errors?.length) {
        const first = result.errors[0]
        setQueueError(`Sample failure: ${first.error || 'unknown'}`)
      }
      await loadQueue()
    } catch (err) {
      setQueueError(err.message || String(err))
    } finally {
      setQueueBusy('')
    }
  }

  const downloadOne = async (imageId) => {
    setQueueBusy(`img-${imageId}`)
    setQueueError('')
    try {
      const result = await postJson('/admin/api/download_images', { image_ids: [imageId] })
      if (result.downloaded > 0) {
        setQueueMsg(result.message || 'Downloaded')
      } else {
        const reason = result.errors?.[0]?.error || result.message || 'unknown reason'
        setQueueError(`Download failed: ${reason}`)
      }
      await loadQueue()
    } catch (err) {
      setQueueError(err.message || String(err))
    } finally {
      setQueueBusy('')
    }
  }

  const removeOne = async (imageId) => {
    if (!window.confirm('Delete this image row from the queue?')) return
    setQueueBusy(`del-${imageId}`)
    try {
      await deleteJson(`/admin/api/delete_image/${imageId}`)
      setQueueMsg('Image deleted')
      await loadQueue()
    } catch (err) {
      setQueueError(err.message || String(err))
    } finally {
      setQueueBusy('')
    }
  }

  // FEAT-D3 — generate art for the selected title. Off unless the operator
  // enabled it and configured an endpoint; the 403/502 split tells them which.
  const generateArtwork = async () => {
    if (!gameUuid) {
      setQueueError('Select a game first.')
      return
    }
    setQueueBusy('generate')
    setQueueError('')
    setQueueMsg('')
    try {
      const result = await postJson('/admin/api/artwork/generate', {
        game_uuid: gameUuid,
        image_type: 'cover',
      })
      setQueueMsg(
        `Generated cover for ${gameName || gameUuid}` +
          (result.generated_by ? ` via ${result.generated_by}` : ''),
      )
      await loadQueue()
      await loadMissing()
    } catch (err) {
      setQueueError(
        `${err.message || String(err)} — set ENABLE_AI_ARTWORK and AI_ARTWORK_URL, ` +
          'and start the artwork profile.',
      )
    } finally {
      setQueueBusy('')
    }
  }

  const autoPick = async () => {
    setQueueBusy('autopick')
    setQueueError('')
    setQueueMsg('')
    try {
      const result = await postJson('/admin/api/covers/batch/apply', {
        policy: BEST_AVAILABLE_POLICY,
        missing_cover: true,
        limit_games: 25,
        library_uuid: libraryFilter || undefined,
        platform: platformFilter || undefined,
        service: serviceFilter || undefined,
      })
      if (result.image_save_path?.error) {
        setQueueError(`IMAGE_SAVE_PATH: ${result.image_save_path.error}`)
      }
      const applied = result.applied ?? 0
      const failed = result.failed ?? 0
      setQueueMsg(
        `Auto-pick finished — applied ${applied}, failed ${failed}` +
          (result.policy ? ` · policy ${Array.isArray(result.policy) ? result.policy.join('→') : result.policy}` : ''),
      )
      if (failed && result.results?.length) {
        const firstFail = result.results.find((r) => r.status === 'failed')
        if (firstFail?.error) {
          setQueueError(`Sample failure (${firstFail.name || firstFail.game_uuid}): ${firstFail.error}`)
        }
      }
      await loadQueue()
      await loadMissing()
    } catch (err) {
      setQueueError(
        `Auto-pick failed calling POST /admin/api/covers/batch/apply (policy=${BEST_AVAILABLE_POLICY}). ${err.message}`,
      )
    } finally {
      setQueueBusy('')
    }
  }

  const massSearch = async () => {
    setQueueBusy('mass-search')
    setQueueError('')
    setQueueMsg('')
    try {
      const result = await postJson('/admin/api/covers/batch/search', {
        missing_cover: true,
        limit_games: 25,
        library_uuid: libraryFilter || undefined,
        platform: platformFilter || undefined,
        service: serviceFilter || undefined,
      })
      const games = Array.isArray(result.games) ? result.games : Array.isArray(result.results) ? result.results : []
      const withHits = games.filter((g) => (g.candidates || []).length > 0).length
      setQueueMsg(
        `Mass cover search — ${games.length} title(s), ${withHits} with candidates` +
          (serviceFilter ? ` · service ${serviceFilter}` : ''),
      )
      if (result.errors?.length) {
        setQueueError(`Sample search error: ${result.errors[0].error || 'unknown'}`)
      }
    } catch (err) {
      setQueueError(`Mass search failed (POST /admin/api/covers/batch/search). ${err.message}`)
    } finally {
      setQueueBusy('')
    }
  }

  return (
    <div className={embedded ? 'od-images-embedded' : 'od-admin-page'}>
      {!embedded ? (
        <>
          <h1>Art &amp; images</h1>
          <p className="od-admin-lede">
            Pick artwork for one title, manage the download queue, and open the classic Image Queue
            when you need the full scan-mgmt table. Admin only.
          </p>
        </>
      ) : (
        <p className="od-admin-lede">
          Search provider art for one library title, then manage pending/failed downloads in bulk.
        </p>
      )}

      <div className="od-admin-actions-row">
        <a className="od-btn" href="/scan_management?active_tab=image_queue">
          Classic Image Queue
        </a>
        {!embedded ? (
          <a className="od-btn" href="/admin/art_studio">
            Art studio
          </a>
        ) : null}
        <a className="od-btn" href="/admin/integrations#steamgriddb">
          SteamGridDB settings
        </a>
      </div>

      <section className="od-admin-panel" style={{ marginTop: 'var(--od-space-5)' }}>
        <h2 className="od-admin-panel-title">Single title</h2>
        <div className="od-images-game-search">
          <label className="od-images-game-search__field">
            Find game in library
            <input
              type="search"
              value={gameQuery}
              onChange={(e) => setGameQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  searchGames()
                }
              }}
              placeholder="Type a title…"
            />
          </label>
          <button type="button" className="od-btn" onClick={searchGames}>
            Find
          </button>
          {gameUuid ? (
            <button type="button" className="od-btn" onClick={() => syncGameParam('', '')}>
              Clear target
            </button>
          ) : null}
          {gameUuid ? (
            <a className="od-btn" href={`/edit_game_images/${encodeURIComponent(gameUuid)}`}>
              Classic edit images
            </a>
          ) : null}
        </div>
        {gameHits.length ? (
          <ul className="od-images-game-hits">
            {gameHits.map((g) => (
              <li key={g.uuid}>
                <button
                  type="button"
                  className="od-btn od-btn--ghost"
                  onClick={() => {
                    syncGameParam(g.uuid, g.name)
                    setGameHits([])
                    setGameQuery(g.name || '')
                  }}
                >
                  {g.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <ArtworkPicker
          gameUuid={gameUuid}
          gameName={gameName}
          onApplied={() => {
            loadQueue()
            loadMissing()
          }}
        />
      </section>

      <section className="od-admin-panel" style={{ marginTop: 'var(--od-space-5)' }}>
        <h2 className="od-admin-panel-title">Mass image queue</h2>
        <p className="od-admin-lede">
          Filter pending/failed downloads, retry, and batch download. Library / platform / service
          scope auto-pick and mass search for missing covers (SteamGridDB → IGDB → generate). Queue
          list itself is not yet filterable by platform — needs Backend enrichment on{' '}
          <code>image_queue_list</code>.
        </p>

        {pathStatus?.error ? (
          <PageStatus
            error={pathStatus.error}
            errorMessage={
              pathStatus.path
                ? `IMAGE_SAVE_PATH: ${pathStatus.error} (${pathStatus.path})`
                : `IMAGE_SAVE_PATH: ${pathStatus.error}`
            }
          />
        ) : null}
        <PageStatus error={queueError} />
        {queueMsg ? (
          <p className="od-admin-lede" aria-live="polite">
            {queueMsg}
          </p>
        ) : null}

        <div className="od-images-filters">
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="downloaded">Downloaded</option>
            </select>
          </label>
          <label>
            Type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              {IMAGE_KIND_OPTIONS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Library (auto-pick / missing)
            <select value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value)}>
              <option value="">All libraries</option>
              {libraries.map((lib) => (
                <option key={lib.uuid} value={lib.uuid}>
                  {lib.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Platform (auto-pick)
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Platform filter for mass auto-pick"
            >
              <option value="">All platforms</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Service (auto-pick / search)
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              aria-label="Service filter for mass cover tools"
            >
              <option value="">All services</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="od-images-filters__check">
            <input
              type="checkbox"
              checked={groupToggle}
              onChange={(e) => setGroupToggle(e.target.checked)}
            />
            Group by game
          </label>
        </div>

        <div className="od-admin-actions-row">
          <button
            type="button"
            className="od-btn"
            disabled={Boolean(queueBusy)}
            onClick={() => downloadBatch(10)}
          >
            Download 10
          </button>
          <button
            type="button"
            className="od-btn"
            disabled={Boolean(queueBusy)}
            onClick={() => downloadBatch(50)}
          >
            Download 50
          </button>
          <button
            type="button"
            className="od-btn od-btn--primary"
            disabled={Boolean(queueBusy)}
            onClick={retryFailed}
          >
            Retry failed
          </button>
          <button
            type="button"
            className="od-btn"
            disabled={Boolean(queueBusy)}
            onClick={massSearch}
            title="POST /admin/api/covers/batch/search"
          >
            {queueBusy === 'mass-search' ? 'Searching…' : 'Mass cover search'}
          </button>
          <button
            type="button"
            className="od-btn"
            disabled={Boolean(queueBusy)}
            onClick={autoPick}
            title={`POST /admin/api/covers/batch/apply policy=${BEST_AVAILABLE_POLICY}`}
          >
            {queueBusy === 'autopick' ? 'Auto-picking…' : 'Auto-pick best available'}
          </button>
          <button
            type="button"
            className="od-btn"
            disabled={Boolean(queueBusy) || !gameUuid}
            onClick={generateArtwork}
            title={
              gameUuid
                ? 'POST /admin/api/artwork/generate — needs ENABLE_AI_ARTWORK + AI_ARTWORK_URL'
                : 'Select a title above first'
            }
          >
            {queueBusy === 'generate' ? 'Generating…' : 'Generate artwork'}
          </button>
          <button type="button" className="od-btn" disabled={Boolean(queueBusy)} onClick={loadQueue}>
            Refresh
          </button>
        </div>

        {loadingQueue ? (
          <PageStatus loading inline loadingMessage="Loading queue…" />
        ) : images.length === 0 ? (
          <p className="od-admin-lede">No images match these filters.</p>
        ) : groups ? (
          <div className="od-images-groups">
            {groups.map((group) => {
              const failed = group.items.filter((i) => i.status === 'failed').length
              const pending = group.items.filter((i) => i.status === 'pending').length
              return (
                <div key={group.uuid || group.name} className="od-images-group">
                  <div className="od-images-group__head">
                    <div>
                      <strong>{group.name}</strong>{' '}
                      <code className="od-mono">{group.uuid}</code>
                      {failed ? (
                        <span className="od-badge od-badge--danger">{failed} failed</span>
                      ) : null}
                      {pending ? (
                        <span className="od-badge od-badge--warn">{pending} pending</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="od-btn od-btn--ghost"
                      onClick={() => syncGameParam(group.uuid, group.name)}
                    >
                      Open picker
                    </button>
                  </div>
                  <ul className="od-images-group__list">
                    {group.items.map((image) => (
                      <QueueRow
                        key={image.id}
                        image={image}
                        busy={queueBusy}
                        onDownload={downloadOne}
                        onDelete={removeOne}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          /* Flat mode is a real table (UX-C7): sortable + filterable like the
             other admin pages, instead of an unsorted list you scroll. */
          <DataTable
            columns={[
              {
                key: 'thumb',
                label: '',
                sortable: false,
                filterable: false,
                render: (image) =>
                  image.local_url ? (
                    <img
                      src={image.local_url}
                      alt=""
                      className="od-images-row__thumb"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="od-images-row__thumb od-images-row__thumb--empty"
                      aria-hidden="true"
                    />
                  ),
              },
              { key: 'game_name', label: 'Game' },
              { key: 'image_type', label: 'Kind' },
              {
                key: 'status',
                label: 'Status',
                value: (image) =>
                  image.status || (image.is_downloaded ? 'downloaded' : 'pending'),
              },
              {
                key: 'failure',
                label: 'Detail',
                value: (image) =>
                  queueFailureText(image) || (image.file_missing ? 'file missing' : ''),
              },
              {
                key: 'actions',
                label: '',
                sortable: false,
                filterable: false,
                render: (image) => {
                  const status =
                    image.status || (image.is_downloaded ? 'downloaded' : 'pending')
                  return (
                    <span className="od-images-row__actions">
                      {status === 'pending' || status === 'failed' || image.file_missing ? (
                        <button
                          type="button"
                          className="od-btn od-btn--ghost"
                          disabled={Boolean(queueBusy)}
                          onClick={() => downloadOne(image.id)}
                        >
                          {status === 'failed' || image.file_missing ? 'Retry' : 'Download'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="od-btn od-btn--ghost"
                        disabled={Boolean(queueBusy)}
                        onClick={() => removeOne(image.id)}
                      >
                        Delete
                      </button>
                    </span>
                  )
                },
              },
            ]}
            rows={images}
            getRowKey={(image) => image.id}
            emptyMessage="No images match these filters."
            dense
          />
        )}
      </section>

      <section className="od-admin-panel" style={{ marginTop: 'var(--od-space-5)' }}>
        <h2 className="od-admin-panel-title">Missing covers (health)</h2>
        <p className="od-admin-lede">
          From <code>/api/health/library</code> worst list — open picker or generate placeholders in
          Art studio. Full “missing cover” filter on the download queue needs Backend.
        </p>
        <PageStatus error={missingError} />
        {!missingCovers.length && !missingError ? (
          <p className="od-admin-lede">No missing-cover titles in the health sample.</p>
        ) : (
          <ul className="od-images-missing">
            {missingCovers.map((g) => (
              <li key={g.uuid}>
                <button
                  type="button"
                  className="od-btn od-btn--ghost"
                  onClick={() => syncGameParam(g.uuid, g.name)}
                >
                  {g.name}
                </button>
                <span className="od-admin-lede">score {g.score}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function QueueRow({ image, busy, onDownload, onDelete, showGame = false }) {
  const status = image.status || (image.is_downloaded ? 'downloaded' : 'pending')
  const failure = queueFailureText(image)
  return (
    <li className="od-images-row">
      {image.local_url ? (
        <img src={image.local_url} alt="" className="od-images-row__thumb" loading="lazy" />
      ) : (
        <span className="od-images-row__thumb od-images-row__thumb--empty" aria-hidden="true" />
      )}
      <div className="od-images-row__meta">
        {showGame ? <strong>{image.game_name}</strong> : null}
        <span>
          {image.image_type} · {status}
          {image.file_missing ? ' · file missing' : ''}
          {failure ? (
            <span className="od-images-row__error" title={failure}>
              {' '}
              — {failure}
            </span>
          ) : null}
        </span>
      </div>
      <div className="od-images-row__actions">
        {status === 'pending' || status === 'failed' || image.file_missing ? (
          <button
            type="button"
            className="od-btn od-btn--ghost"
            disabled={Boolean(busy)}
            onClick={() => onDownload(image.id)}
          >
            {status === 'failed' || image.file_missing ? 'Retry' : 'Download'}
          </button>
        ) : null}
        <button
          type="button"
          className="od-btn od-btn--ghost"
          disabled={Boolean(busy)}
          onClick={() => onDelete(image.id)}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
