import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageStatus } from './PageStatus'
import { postJson } from './adminApi'
import { showToast } from './utils/toast'

const STOCK_CATALOG_URL = '/admin/api/art-studio/stock'
const STOCK_GENERATE_URL = '/admin/api/art-studio/stock/generate'
const APPLY_URL = '/admin/api/art-studio/apply'

/**
 * Normalize Backend catalog payloads.
 * Contract: GET /admin/api/art-studio/stock → { items, count }
 * Item: { id, label, kind, platform?, pack_id, path, urls{tile,wide,hero}, generated }
 */
export function normalizeStockCatalog(data) {
  if (!data) return []
  const raw = Array.isArray(data)
    ? data
    : data.items || data.catalog || data.stock || data.packs || []
  if (!Array.isArray(raw)) return []
  return raw
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null
      const id = String(row.id || row.pack_id || row.key || `item-${index}`)
      const urls = row.urls && typeof row.urls === 'object' ? row.urls : {}
      const generated = Boolean(row.generated)
      const thumb = generated
        ? urls.tile || urls.thumb || urls.wide || row.thumb_url || row.preview_url || ''
        : ''
      const preview = generated
        ? urls.wide || urls.hero || urls.tile || row.preview_url || thumb || ''
        : ''
      return {
        id,
        label: String(row.label || row.name || row.title || id),
        kind:
          row.kind === 'platform'
            ? 'platform'
            : row.kind === 'era'
              ? 'era'
              : 'stock',
        platform: row.platform ? String(row.platform) : '',
        packId: String(row.pack_id || row.packId || id),
        thumb,
        preview,
        generated,
        hint: row.hint || row.description || '',
      }
    })
    .filter(Boolean)
}

async function fetchStockCatalog() {
  const response = await fetch(STOCK_CATALOG_URL, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (response.status === 404) {
    return { unavailable: true, items: [] }
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `stock catalog ${response.status}`)
  }
  return { unavailable: false, items: normalizeStockCatalog(data) }
}

/**
 * Platform + stock motif grid for Art Studio Backup & stock tab.
 * Soft-empty when catalog API returns 404.
 */
export function StockPicker({
  onApplied,
  heading = 'Platform & stock art',
  lede = 'Original GameTheca packs — pick a decade room, platform look, or stock motif, then set as library default / fallback.',
  showLibraryUuid = false,
} = {}) {
  const [items, setItems] = useState([])
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [libraryUuid, setLibraryUuid] = useState('')
  const [busy, setBusy] = useState('')
  const [status, setStatus] = useState('')

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchStockCatalog()
      setUnavailable(Boolean(result.unavailable))
      setItems(result.items)
      if (result.unavailable) {
        setStatus('Stock catalog API not available yet — use Studio generate + Set as fallback.')
      } else if (!result.items.length) {
        setStatus('Catalog is empty. Generate platform packs on the server, then refresh.')
      } else {
        const pending = result.items.filter((i) => !i.generated).length
        setStatus(
          pending
            ? `${result.items.length} packs · ${pending} need generate before preview files exist.`
            : '',
        )
      }
    } catch (err) {
      setError(err.message || 'Could not load stock catalog')
      setItems([])
      setUnavailable(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  )

  const visible = useMemo(() => {
    if (filter === 'platform') return items.filter((i) => i.kind === 'platform')
    if (filter === 'stock') return items.filter((i) => i.kind === 'stock')
    if (filter === 'era') return items.filter((i) => i.kind === 'era')
    return items
  }, [items, filter])

  const ensureGenerated = useCallback(async (item) => {
    if (item.generated) return item
    await postJson(STOCK_GENERATE_URL, { ids: [item.packId || item.id] })
    const refreshed = await fetchStockCatalog()
    if (!refreshed.unavailable) {
      setItems(refreshed.items)
      const next = refreshed.items.find((row) => row.id === item.id)
      if (next) return next
    }
    return { ...item, generated: true }
  }, [])

  const applySelected = useCallback(
    async (mode) => {
      if (!selected) {
        setError('Select an image first.')
        return
      }
      if (mode === 'library' && !libraryUuid.trim()) {
        setError('Enter a library UUID to apply.')
        return
      }
      setBusy(mode)
      setError('')
      setStatus('')
      try {
        const ready = await ensureGenerated(selected)
        const packId = ready.packId || ready.id
        const body = { pack_id: packId, id: packId, mode }
        if (mode === 'library') body.library_uuid = libraryUuid.trim()
        await postJson(APPLY_URL, body)
        const label =
          mode === 'library'
            ? `Applied “${ready.label}” to library`
            : `Set “${ready.label}” as library default / fallback`
        setStatus(label)
        showToast(label, 'success')
        onApplied?.({ item: ready, mode })
        await loadCatalog()
      } catch (err) {
        const text = err.message || 'Apply failed'
        setError(text)
        showToast(text, 'error')
      } finally {
        setBusy('')
      }
    },
    [selected, libraryUuid, onApplied, ensureGenerated, loadCatalog],
  )

  const generateSelected = useCallback(async () => {
    if (!selected) {
      setError('Select an image first.')
      return
    }
    setBusy('generate')
    setError('')
    try {
      await postJson(STOCK_GENERATE_URL, { ids: [selected.packId || selected.id] })
      showToast(`Generated “${selected.label}”`, 'success')
      await loadCatalog()
      setStatus(`Pack “${selected.label}” ready.`)
    } catch (err) {
      const text = err.message || 'Generate failed'
      setError(text)
      showToast(text, 'error')
    } finally {
      setBusy('')
    }
  }, [selected, loadCatalog])

  return (
    <section className="gt-stock-picker" aria-label={heading} data-testid="stock-picker">
      <div className="gt-stock-picker__head">
        <div>
          <h2 className="gt-admin-panel-title">{heading}</h2>
          <p className="gt-admin-lede">{lede}</p>
        </div>
        <button
          type="button"
          className="gt-btn"
          disabled={loading || Boolean(busy)}
          onClick={loadCatalog}
        >
          Refresh
        </button>
      </div>

      {/* The `status` line below is progress text for one action, not a page
          state, so it stays as it is. */}
      <PageStatus error={error} />
      {status ? (
        <p className="gt-admin-lede" role="status">
          {status}
        </p>
      ) : null}

      <div className="gt-stock-picker__filters" role="group" aria-label="Catalog filter">
        {[
          { id: 'all', label: 'All' },
          { id: 'era', label: 'Decade rooms' },
          { id: 'platform', label: 'Platforms' },
          { id: 'stock', label: 'Stock motifs' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`gt-stock-picker__filter${filter === f.id ? ' is-active' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="gt-stock-picker__empty">Loading catalog…</p>
      ) : unavailable ? (
        <div className="gt-stock-picker__empty" data-testid="stock-picker-unavailable">
          <p className="gt-stock-picker__empty-title">Stock catalog coming online</p>
          <p>
            <code>GET {STOCK_CATALOG_URL}</code> is not available yet. Use Studio generate + Set as
            fallback until the pack list ships.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="gt-stock-picker__empty" data-testid="stock-picker-empty">
          <p className="gt-stock-picker__empty-title">No packs in this filter</p>
          <p>Try All, or regenerate stock packs on the server.</p>
        </div>
      ) : (
        <div className="gt-stock-picker__grid" data-testid="stock-picker-grid">
          {visible.map((item) => {
            const selectedNow = item.id === selectedId
            return (
              <button
                key={item.id}
                type="button"
                className={`gt-stock-picker__card${selectedNow ? ' is-selected' : ''}${
                  item.generated ? '' : ' is-pending'
                }`}
                aria-label={item.label}
                aria-pressed={selectedNow}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="gt-stock-picker__thumb">
                  {item.thumb ? (
                    <img
                      src={item.thumb}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="gt-stock-picker__thumb-ph" aria-hidden="true">
                      {item.kind === 'platform' ? '◆' : item.kind === 'era' ? '▣' : '◇'}
                    </span>
                  )}
                </span>
                <span className="gt-stock-picker__meta">
                  <strong>{item.label}</strong>
                  <span className="gt-stock-picker__kind">
                    {item.kind === 'platform'
                      ? item.platform
                        ? `Platform · ${item.platform}`
                        : 'Platform'
                      : item.kind === 'era'
                        ? 'Decade room'
                        : 'Stock motif'}
                    {item.generated ? '' : ' · needs generate'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selected ? (
        <div className="gt-stock-picker__preview" data-testid="stock-picker-preview">
          <figure>
            {selected.preview ? (
              <img src={selected.preview} alt={`Preview of ${selected.label}`} />
            ) : (
              <div className="gt-stock-picker__thumb-ph gt-stock-picker__thumb-ph--lg">
                {selected.generated
                  ? selected.label
                  : `${selected.label} — generate to paint files`}
              </div>
            )}
            <figcaption>
              <strong>{selected.label}</strong>
              <span>
                {selected.kind === 'platform' ? 'Platform pack' : 'Stock motif'}
                {selected.platform ? ` · ${selected.platform}` : ''}
              </span>
              {selected.hint ? <span>{selected.hint}</span> : null}
            </figcaption>
          </figure>
          <div className="gt-stock-picker__actions">
            {!selected.generated ? (
              <button
                type="button"
                className="gt-btn"
                disabled={Boolean(busy)}
                onClick={generateSelected}
              >
                {busy === 'generate' ? 'Generating…' : 'Generate pack'}
              </button>
            ) : null}
            <button
              type="button"
              className="gt-btn gt-btn--primary"
              disabled={Boolean(busy)}
              onClick={() => applySelected('fallback')}
            >
              {busy === 'fallback' ? 'Applying…' : 'Use as library default'}
            </button>
            <button
              type="button"
              className="gt-btn"
              disabled={Boolean(busy)}
              onClick={() => applySelected('fallback')}
            >
              {busy === 'fallback' ? 'Applying…' : 'Set fallback'}
            </button>
            {showLibraryUuid ? (
              <>
                <label className="gt-stock-picker__uuid">
                  <span>Library UUID</span>
                  <input
                    type="text"
                    value={libraryUuid}
                    onChange={(e) => setLibraryUuid(e.target.value)}
                    placeholder="library uuid"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  className="gt-btn"
                  disabled={Boolean(busy) || !libraryUuid.trim()}
                  onClick={() => applySelected('library')}
                >
                  {busy === 'library' ? 'Applying…' : 'Apply to library'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
