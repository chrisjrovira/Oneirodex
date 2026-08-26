import { useCallback, useEffect, useState } from 'react'
import { PageStatus } from './PageStatus'
import { getJson, postJson } from './adminApi'

const ARTWORK_PROVIDERS = [
  { id: 'steamgriddb', label: 'SteamGridDB', kinds: ['cover', 'logo', 'hero'] },
  { id: 'igdb', label: 'IGDB', kinds: ['cover'] },
  { id: 'giantbomb', label: 'Giant Bomb', kinds: ['cover'] },
]

/** Identify/metadata sources shown as chips (cover apply when hit has cover_url). */
const IDENTIFY_CHIP_IDS = new Set([
  'meta_quest',
  'epic',
  'itch',
  'giantbomb',
  'mobygames',
  'thegamesdb',
])

/**
 * Admin artwork search + apply for one game.
 * Covers: POST /admin/api/covers/search|apply (multi-provider).
 * Identify chips: GET /api/search_metadata/sources + GET /api/search_metadata?source=
 * Logo/hero: GET /api/providers/steamgriddb/search + POST /api/games/:uuid/artwork/steamgriddb.
 */
export function ArtworkPicker({
  gameUuid,
  gameName = '',
  onApplied,
  compact = false,
}) {
  const [provider, setProvider] = useState('steamgriddb')
  const [imageType, setImageType] = useState('cover')
  const [query, setQuery] = useState(gameName || '')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [providersMeta, setProvidersMeta] = useState(null)
  const [identifySources, setIdentifySources] = useState([])
  const [identifySource, setIdentifySource] = useState('')

  useEffect(() => {
    setQuery(gameName || '')
  }, [gameName])

  useEffect(() => {
    let cancelled = false
    getJson('/api/providers')
      .then((data) => {
        if (!cancelled) setProvidersMeta(Array.isArray(data.providers) ? data.providers : [])
      })
      .catch(() => {
        if (!cancelled) setProvidersMeta([])
      })
    getJson('/api/search_metadata/sources')
      .then((data) => {
        if (cancelled) return
        const sources = Array.isArray(data.sources) ? data.sources : []
        setIdentifySources(sources.filter((s) => IDENTIFY_CHIP_IDS.has(s.id)))
      })
      .catch(() => {
        if (!cancelled) setIdentifySources([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const providerMeta = ARTWORK_PROVIDERS.find((p) => p.id === provider) || ARTWORK_PROVIDERS[0]
  const enabledMap = Object.fromEntries(
    (providersMeta || []).map((p) => [p.id, Boolean(p.enabled)]),
  )
  const identifyMode = Boolean(identifySource)

  useEffect(() => {
    if (!providerMeta.kinds.includes(imageType)) {
      setImageType(providerMeta.kinds[0] || 'cover')
    }
  }, [provider, providerMeta.kinds, imageType])

  const selectIdentifyChip = (sourceId) => {
    setIdentifySource((prev) => (prev === sourceId ? '' : sourceId))
    setResults([])
    setStatus('')
    setError('')
    if (sourceId) setImageType('cover')
  }

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (!q && !gameUuid) {
      setError('Enter a search title or select a game.')
      return
    }
    if (
      !identifyMode &&
      providersMeta &&
      enabledMap[provider] === false &&
      imageType !== 'cover'
    ) {
      setError(`${providerMeta.label} is not configured.`)
      setResults([])
      return
    }
    setBusy('search')
    setError('')
    setStatus('Searching…')
    setResults([])
    try {
      let rows = []
      if (identifyMode) {
        const qs = new URLSearchParams({
          name: q || gameName || '',
          source: identifySource,
        })
        const data = await getJson(`/api/search_metadata?${qs}`)
        const hits = Array.isArray(data.results) ? data.results : Array.isArray(data.games) ? data.games : []
        const softNote = typeof data.note === 'string' ? data.note.trim() : ''
        rows = hits
          .map((hit, idx) => ({
            id: hit.id || hit.app_id || hit.store_id || `${identifySource}-${idx}`,
            url: hit.cover_url || hit.image_url || hit.url || '',
            thumb_url: hit.cover_url || hit.image_url || hit.thumb_url || '',
            game_name: hit.name || hit.title || q,
            provider: identifySource,
            ownership_only: Boolean(hit.ownership_only ?? data.ownership_only),
          }))
          .filter((r) => r.url || r.thumb_url)
        if (!rows.length && hits.length) {
          setStatus(
            softNote ||
              `${hits.length} identify hit(s) from ${identifySource} — no cover URLs to apply. Ownership/metadata only.`,
          )
          setResults([])
          return
        }
        if (!rows.length) {
          setStatus(
            softNote ||
              (data.needs_key && data.key_configured === false
                ? 'API key not configured — empty results.'
                : 'No results for that query.'),
          )
          setResults([])
          return
        }
      } else if (imageType === 'cover') {
        const data = await postJson('/admin/api/covers/search', {
          game_uuid: gameUuid || undefined,
          query: q || undefined,
          providers: [provider],
          limit: 16,
        })
        if (data.image_save_path?.error) {
          setError(`IMAGE_SAVE_PATH: ${data.image_save_path.error}`)
        }
        rows = data.candidates || data.results || []
        if (!rows.length && Array.isArray(data.by_provider)) {
          rows = data.by_provider.flatMap((p) => p.results || p.candidates || [])
        }
      } else {
        const qs = new URLSearchParams({
          q: q || gameName || '',
          limit: '16',
          image_type: imageType,
        })
        const data = await getJson(`/api/providers/${provider}/search?${qs}`)
        rows = data.results || []
      }
      setResults(rows)
      setStatus(
        rows.length
          ? `${rows.length} result(s) — click to apply as ${identifyMode ? 'cover' : imageType}.`
          : 'No results for that query.',
      )
    } catch (err) {
      setError(err.message || String(err))
      setStatus('')
    } finally {
      setBusy('')
    }
  }, [
    query,
    provider,
    imageType,
    providersMeta,
    enabledMap,
    providerMeta.label,
    gameUuid,
    gameName,
    identifyMode,
    identifySource,
  ])

  const applyResult = useCallback(
    async (item) => {
      if (!gameUuid) {
        setError('Select a game first.')
        return
      }
      if (!item.url) {
        setError('This hit has no cover URL to apply.')
        return
      }
      const itemProvider = item.provider || provider
      const applyType = identifyMode ? 'cover' : imageType
      setBusy(`apply-${item.id || item.url}`)
      setError('')
      setStatus(`Applying ${applyType}…`)
      try {
        let data
        if (applyType === 'cover') {
          data = await postJson('/admin/api/covers/apply', {
            game_uuid: gameUuid,
            url: item.url,
            provider: itemProvider,
          })
        } else {
          data = await postJson(`/api/games/${gameUuid}/artwork/steamgriddb`, {
            url: item.url,
            image_type: applyType,
            provider: itemProvider,
          })
        }
        if (data.image_save_path?.error) {
          setError(`IMAGE_SAVE_PATH: ${data.image_save_path.error}`)
        }
        setStatus(
          `${applyType.charAt(0).toUpperCase() + applyType.slice(1)} applied${
            data.filename ? ` (${data.filename})` : ''
          }.`,
        )
        onApplied?.(data)
      } catch (err) {
        setError(err.message || String(err))
        setStatus('')
      } finally {
        setBusy('')
      }
    },
    [gameUuid, imageType, provider, onApplied, identifyMode],
  )

  return (
    <div className={`gt-artwork-picker${compact ? ' gt-artwork-picker--compact' : ''}`}>
      {!compact ? (
        <h2 className="gt-admin-panel-title">Artwork search</h2>
      ) : null}
      <p className="gt-admin-lede">
        Search SteamGridDB / IGDB / Giant Bomb and apply cover, logo, or hero. Identify chips
        (Meta Quest / Epic / itch / Giant Bomb / MobyGames / TheGamesDB) use metadata sources — apply
        only when a cover URL is present. Artwork only — never downloads games.
      </p>

      {!gameUuid ? (
        <p className="gt-admin-lede" role="status">
          Select a library title (search above, or Open picker from a queue group) to enable Apply.
        </p>
      ) : (
        <p className="gt-admin-lede">
          Target: <strong>{gameName || gameUuid}</strong>{' '}
          <code className="gt-mono">{gameUuid}</code>
        </p>
      )}

      <PageStatus error={error} />
      {status ? (
        <p className="gt-admin-lede" aria-live="polite">
          {status}
        </p>
      ) : null}

      {identifySources.length ? (
        <div className="gt-artwork-picker__chips" role="group" aria-label="Identify metadata sources">
          <span className="gt-artwork-picker__chips-label">Identify</span>
          {identifySources.map((src) => {
            const active = identifySource === src.id
            return (
              <button
                key={src.id}
                type="button"
                className={`gt-chip${active ? ' is-active' : ''}`}
                aria-pressed={active}
                title={src.note || src.name}
                onClick={() => selectIdentifyChip(src.id)}
              >
                {src.name || src.id}
                {src.ownership_only ? ' · own' : ''}
                {src.needs_key && src.key_configured === false ? ' · key' : ''}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="gt-artwork-picker__controls">
        <label>
          Provider
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value)
              setIdentifySource('')
            }}
            aria-label="Artwork provider"
            disabled={identifyMode}
          >
            {ARTWORK_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {providersMeta && enabledMap[p.id] === false ? ' (disabled)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            value={imageType}
            onChange={(e) => setImageType(e.target.value)}
            aria-label="Image type"
            disabled={identifyMode || providerMeta.kinds.length <= 1}
          >
            {providerMeta.kinds.map((k) => (
              <option key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="gt-artwork-picker__query">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
            placeholder="Game title"
            maxLength={120}
          />
        </label>
        <button
          type="button"
          className="gt-btn gt-btn--primary"
          disabled={busy === 'search' || (!query.trim() && !gameUuid)}
          onClick={runSearch}
        >
          {busy === 'search' ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div className="gt-artwork-picker__grid" role="list">
        {results.map((item) => {
          const key = item.id || item.url
          const applying = busy === `apply-${key}`
          const label = item.game_name || item.name || imageType
          const canApply = Boolean(gameUuid && item.url)
          return (
            <div key={key} role="listitem">
              <button
                type="button"
                className="gt-artwork-picker__card"
                title={canApply ? label : `${label} (no cover URL)`}
                disabled={!canApply || Boolean(busy)}
                onClick={() => applyResult(item)}
              >
                {item.thumb_url || item.url ? (
                  <img
                    src={item.thumb_url || item.url}
                    alt={label}
                    loading="lazy"
                    className={
                      imageType === 'hero' && !identifyMode
                        ? 'gt-artwork-picker__thumb gt-artwork-picker__thumb--hero'
                        : 'gt-artwork-picker__thumb'
                    }
                  />
                ) : (
                  <span className="gt-artwork-picker__thumb gt-artwork-picker__thumb--empty" />
                )}
                <span className="gt-artwork-picker__caption">
                  {applying ? 'Applying…' : label}
                </span>
              </button>
            </div>
          )
        })}
      </div>
      {!results.length && !busy && !error && status === '' ? (
        <p className="gt-admin-lede">Results appear here after Search.</p>
      ) : null}
    </div>
  )
}
