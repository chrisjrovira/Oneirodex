import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageStatus } from './PageStatus'
import { ImagesPage } from './ImagesPage'
import { StockPicker } from './StockPicker'
import { SystemMarksPanel } from './SystemMarksPanel'
import { getJson, postJson } from './adminApi'
import { ART_STUDIO_SYSTEMS, skinForPlatform, systemLabel } from './platformSkins'
import { showToast } from './utils/toast'

const PREVIEW_VARIANTS = [
  { key: 'sm', width: 200, height: 300, label: '200×300', kind: 'tile' },
  { key: 'md', width: 400, height: 600, label: '400×600', kind: 'tile' },
  { key: 'wide', width: 960, height: 540, label: '960×540', kind: 'wide' },
]

const DEFAULT_TITLE_SCALE = 1.3
const TITLE_SCALE_MIN = 0.85
const TITLE_SCALE_MAX = 2

const FALLBACK_ASSETS = [
  {
    key: 'cover',
    label: 'Default cover',
    path: '/static/newstyle/default_cover.jpg',
    hint: 'Library tiles · missing covers',
  },
  {
    key: 'library',
    label: 'Default library',
    path: '/static/newstyle/default_library.jpg',
    hint: 'Wide / hero surfaces',
  },
]

const PREVIEW_DEBOUNCE_MS = 420

function initialTab() {
  if (typeof window === 'undefined') return 'studio'
  const hash = (window.location.hash || '').replace('#', '')
  if (hash === 'images' || hash === 'queue' || hash === 'picker') return 'images'
  if (hash === 'stock' || hash === 'backup') return 'stock'
  if (hash === 'marks' || hash === 'system-marks') return 'marks'
  return 'studio'
}

function tabHash(tab) {
  if (tab === 'images') return '#images'
  if (tab === 'stock') return '#stock'
  if (tab === 'marks') return '#marks'
  return '#studio'
}

export function ArtStudioPage() {
  const [tab, setTab] = useState(initialTab)
  const [title, setTitle] = useState('')
  const [system, setSystem] = useState('')
  const [variantKey, setVariantKey] = useState('md')
  const [previews, setPreviews] = useState({})
  const [packId, setPackId] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [gameUuid, setGameUuid] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [missingCovers, setMissingCovers] = useState([])
  const [batchSelected, setBatchSelected] = useState(() => new Set())
  const [batchLog, setBatchLog] = useState('')
  const [fallbackBust, setFallbackBust] = useState(() => Date.now())
  const [batchOpen, setBatchOpen] = useState(false)
  const [previewArtistic, setPreviewArtistic] = useState(true)
  /* FEAT-D4 overrides. The API has accepted `headline`, `subtitle` and
     `title_scale` since the artwork wave and nothing ever sent them, so
     "the text is still tiny and not legible, it should be editable in the art
     studio" (UID-011) was a frontend gap rather than missing capability.
     Empty headline means "derive it from the title", which is what the route
     already does with an absent key. */
  const [headline, setHeadline] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [titleScale, setTitleScale] = useState(DEFAULT_TITLE_SCALE)
  const previewReqId = useRef(0)

  const skin = useMemo(() => skinForPlatform(system), [system])
  const systemText = systemLabel(system)
  // Short platform id (SNES, PSX, …) matches Backend SYSTEM_TEMPLATES keys.
  const systemForApi = system || undefined
  const activeVariant = PREVIEW_VARIANTS.find((v) => v.key === variantKey) || PREVIEW_VARIANTS[1]
  const heroSrc =
    previews[activeVariant.key] ||
    (activeVariant.key === 'md' ? previewUrl : '') ||
    ''
  const hasTitle = Boolean(title.trim())
  const previewBusy = busy === 'preview' || busy === 'preview-system' || busy === 'preview-live'

  const selectTab = (next) => {
    setTab(next)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', tabHash(next))
    }
  }

  const onStockApplied = useCallback(() => {
    setFallbackBust(Date.now())
    setMessage('Library default covers updated from stock pack. Hard-refresh member browsers.')
  }, [])

  useEffect(() => {
    const onHash = () => setTab(initialTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const fetchPreviews = useCallback(
    async (sizes, { soft = false, busyKey = 'preview', titleOverride } = {}) => {
      const trimmed = (titleOverride ?? title).trim()
      if (!trimmed) return
      const reqId = ++previewReqId.current
      setBusy(busyKey)
      if (!soft) {
        setError('')
        setMessage('')
      }
      try {
        const next = {}
        for (const size of sizes) {
          const data = await postJson('/admin/api/art-studio/preview', {
            title: trimmed,
            system: systemForApi,
            width: size.width,
            height: size.height,
            // Absent keys keep the derived text, so only send what was set.
            // An explicit empty subtitle means "no subtitle" to the renderer,
            // which is a different instruction from leaving it out.
            ...(headline.trim() ? { headline: headline.trim() } : {}),
            ...(subtitle !== '' ? { subtitle } : {}),
            title_scale: titleScale,
          })
          if (reqId !== previewReqId.current) return
          next[size.key] = data.preview
          if (typeof data.artistic === 'boolean') setPreviewArtistic(data.artistic)
        }
        if (reqId !== previewReqId.current) return
        setPreviews((prev) => ({ ...prev, ...next }))
        setPreviewUrl('')
        if (!soft) setMessage('Artistic preview refreshed.')
      } catch (err) {
        if (reqId !== previewReqId.current) return
        const text = err.message || 'Preview failed'
        if (soft) {
          showToast(text, 'warn')
        } else {
          setError(text)
          showToast(text, 'error')
        }
      } finally {
        if (reqId === previewReqId.current) {
          setBusy((b) => (b === busyKey ? '' : b))
        }
      }
    },
    [title, systemForApi, headline, subtitle, titleScale],
  )

  const runPreview = useCallback(async () => {
    const sizes = PREVIEW_VARIANTS.filter((v) => v.kind === 'tile' || v.key === variantKey)
    await fetchPreviews(sizes, { soft: false, busyKey: 'preview' })
  }, [fetchPreviews, variantKey])

  // Live preview: title typing feels like painting a cover (debounced).
  // System changes re-paint the active variant via the same debounce path.
  useEffect(() => {
    const trimmed = title.trim()
    if (!trimmed) {
      previewReqId.current += 1
      setPreviews({})
      setBusy((b) => (b.startsWith('preview') ? '' : b))
      return undefined
    }
    const timer = window.setTimeout(() => {
      fetchPreviews([activeVariant], {
        soft: true,
        busyKey: 'preview-live',
        titleOverride: trimmed,
      })
    }, PREVIEW_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [title, variantKey, system, systemForApi, activeVariant, fetchPreviews])

  const runGenerate = useCallback(async () => {
    setBusy('generate')
    setError('')
    setMessage('')
    try {
      const data = await postJson('/admin/api/art-studio/generate', {
        title: title.trim(),
        system: systemForApi,
        format: 'webp',
        // Must match the preview payload exactly, or Generate writes something
        // other than what was on screen when it was clicked.
        ...(headline.trim() ? { headline: headline.trim() } : {}),
        ...(subtitle !== '' ? { subtitle } : {}),
        title_scale: titleScale,
      })
      setPackId(data.pack_id)
      setPreviewUrl(data.preview_url)
      setPreviews({})
      setMessage(`Generated pack ${data.pack_id} (${data.files?.length || 0} sizes).`)
      showToast('Art pack ready', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message || 'Generate failed', 'error')
    } finally {
      setBusy('')
    }
  }, [title, systemForApi, headline, subtitle, titleScale])

  const applyToGame = useCallback(async () => {
    if (!packId || !gameUuid.trim()) {
      setError('Generate a pack and enter a game UUID first.')
      return
    }
    setBusy('apply-game')
    setError('')
    try {
      const data = await postJson('/admin/api/art-studio/apply', {
        pack_id: packId,
        mode: 'game',
        game_uuid: gameUuid.trim(),
      })
      setMessage(`Cover applied to ${data.game_uuid}.`)
      showToast('Cover applied to game', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message || 'Apply failed', 'error')
    } finally {
      setBusy('')
    }
  }, [packId, gameUuid])

  const applyFallback = useCallback(async () => {
    if (!packId) {
      setError('Generate a pack first.')
      return
    }
    setBusy('apply-fallback')
    setError('')
    try {
      await postJson('/admin/api/art-studio/apply', {
        pack_id: packId,
        mode: 'fallback',
      })
      setFallbackBust(Date.now())
      setMessage('Library default covers updated. Hard-refresh member browsers.')
      showToast('Fallback pack installed', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message || 'Fallback apply failed', 'error')
    } finally {
      setBusy('')
    }
  }, [packId])

  const regenerateDefaults = useCallback(async () => {
    const seed = title.trim() || 'Oneirodex'
    setBusy('regen-fallback')
    setError('')
    try {
      const data = await postJson('/admin/api/art-studio/generate', {
        title: seed,
        system: systemForApi,
        format: 'webp',
      })
      setPackId(data.pack_id)
      setPreviewUrl(data.preview_url)
      await postJson('/admin/api/art-studio/apply', {
        pack_id: data.pack_id,
        mode: 'fallback',
      })
      setFallbackBust(Date.now())
      setMessage(
        `Library defaults regenerated from “${seed}” (pack ${data.pack_id}). Hard-refresh browsers.`,
      )
      showToast('Library defaults refreshed', 'success')
    } catch (err) {
      setError(err.message)
      showToast(err.message || 'Could not regenerate defaults', 'error')
    } finally {
      setBusy('')
    }
  }, [title, systemForApi])

  const loadMissing = useCallback(async () => {
    setBusy('missing')
    setError('')
    try {
      const data = await getJson('/api/health/library?limit=200')
      const worst = Array.isArray(data.worst) ? data.worst : []
      const rows = worst.filter((g) => (g.issues || []).some((i) => i.code === 'missing_cover'))
      setMissingCovers(rows)
      setBatchSelected(new Set(rows.map((r) => r.uuid)))
      setBatchOpen(true)
      setMessage(
        rows.length
          ? `${rows.length} no-cover title(s) in health sample.`
          : 'No missing-cover titles in the health sample.',
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [])

  const toggleBatch = (uuid) => {
    setBatchSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  const batchApplyPlaceholders = useCallback(async () => {
    const targets = missingCovers.filter((g) => batchSelected.has(g.uuid))
    if (!targets.length) {
      setError('Select at least one no-cover title.')
      return
    }
    setBusy('batch')
    setError('')
    setBatchLog('')
    const lines = []
    const uuids = targets.map((t) => t.uuid)
    try {
      try {
        const batch = await postJson('/admin/api/art-studio/batch-generate', {
          game_uuids: uuids,
          missing_cover: true,
          system: systemForApi,
        })
        const applied = batch.applied ?? (Array.isArray(batch.results) ? batch.results.length : 0)
        const failed = batch.failed ?? (Array.isArray(batch.errors) ? batch.errors.length : 0)
        setMessage(`Batch generate finished — applied ${applied}, failed ${failed}.`)
        const failLines = (batch.errors || []).map(
          (r) => `✗ ${r.name || r.game_uuid}: ${r.error || 'failed'}`,
        )
        setBatchLog(['Used POST /admin/api/art-studio/batch-generate.', ...failLines].join('\n'))
        if (applied > 0) return
        lines.push('Batch-generate returned zero applies — trying covers/batch/apply generate_only…')
      } catch {
        lines.push('batch-generate unavailable — trying covers/batch/apply policy=generate_only…')
      }

      try {
        const batch = await postJson('/admin/api/covers/batch/apply', {
          policy: 'generate_only',
          game_uuids: uuids,
          missing_cover: true,
        })
        const applied = batch.applied ?? 0
        const failed = batch.failed ?? 0
        setMessage(`Placeholder apply finished — applied ${applied}, failed ${failed}.`)
        const failLines = (batch.results || [])
          .filter((r) => r.status === 'failed')
          .map((r) => `✗ ${r.name || r.game_uuid}: ${r.error || 'failed'}`)
        setBatchLog(
          [...lines, 'Used POST /admin/api/covers/batch/apply policy=generate_only.', ...failLines].join(
            '\n',
          ),
        )
        if (applied > 0) return
        lines.push('Batch apply returned zero applies — generating per selected title…')
      } catch {
        lines.push('Batch apply unavailable — generating per title via art-studio APIs…')
      }

      let ok = 0
      for (const game of targets) {
        try {
          const pack = await postJson('/admin/api/art-studio/generate', {
            title: game.name,
            system: systemForApi,
            format: 'webp',
          })
          await postJson('/admin/api/art-studio/apply', {
            pack_id: pack.pack_id,
            mode: 'game',
            game_uuid: game.uuid,
          })
          ok += 1
          lines.push(`✓ ${game.name}`)
        } catch (err) {
          lines.push(`✗ ${game.name}: ${err.message}`)
        }
      }
      setMessage(`Applied placeholders to ${ok}/${targets.length} title(s).`)
      setBatchLog(lines.join('\n'))
    } finally {
      setBusy('')
    }
  }, [missingCovers, batchSelected, systemForApi])

  const downloadZip = packId
    ? `/admin/api/art-studio/download/${encodeURIComponent(packId)}`
    : null

  const previewChromeStyle = skin?.accent
    ? {
        borderColor: skin.accent,
        boxShadow: `0 0 0 1px ${skin.accent}66, 0 18px 48px rgba(0,0,0,0.45)`,
      }
    : undefined

  return (
    <div className="od-admin-page">
      <header className="od-art-studio-head">
        <div>
          <p className="od-art-studio-kicker">Admin · Cover atelier</p>
          <h1>Art studio</h1>
          <p className="od-admin-lede od-art-studio-lede">
            Type a title — watch an <strong>artistic</strong> cover form (motifs, bezels, initials).
            Local Pillow renderer, aurora tokens, no cloud AI. Use{' '}
            <strong>Pick &amp; queue</strong> for SteamGridDB / IGDB art.
          </p>
        </div>
        {skin ? (
          <span
            className={`od-art-studio-skin od-art-studio-skin--${skin.family}`}
            style={{ '--od-art-skin': skin.accent }}
          >
            {skin.label}
            {systemText ? ` · ${systemText}` : ''}
          </span>
        ) : (
          <span className="od-art-studio-skin">Generic aurora</span>
        )}
      </header>

      <div className="od-art-tabs" role="tablist" aria-label="Art studio sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'studio'}
          className={`od-art-tabs__btn${tab === 'studio' ? ' is-active' : ''}`}
          onClick={() => selectTab('studio')}
        >
          Studio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stock'}
          className={`od-art-tabs__btn${tab === 'stock' ? ' is-active' : ''}`}
          onClick={() => selectTab('stock')}
        >
          Backup &amp; stock
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'marks'}
          className={`od-art-tabs__btn${tab === 'marks' ? ' is-active' : ''}`}
          onClick={() => selectTab('marks')}
        >
          System marks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'images'}
          className={`od-art-tabs__btn${tab === 'images' ? ' is-active' : ''}`}
          onClick={() => selectTab('images')}
        >
          Pick &amp; queue
        </button>
      </div>

      {tab === 'images' ? <ImagesPage embedded /> : null}

      {tab === 'marks' ? (
        <div className="od-art-stock-tab">
          <SystemMarksPanel />
        </div>
      ) : null}

      {tab === 'stock' ? (
        <div className="od-art-stock-tab">
          <StockPicker onApplied={onStockApplied} showLibraryUuid />
          <section className="od-admin-panel od-art-studio-fallbacks" aria-label="Current library defaults">
            <div className="od-art-studio-fallbacks__head">
              <div>
                <h2 className="od-admin-panel-title">Current library defaults</h2>
                <p className="od-admin-lede">
                  Live fallback assets after apply. Hard-refresh member browsers to see updates.
                </p>
              </div>
            </div>
            <div className="od-art-studio-fallbacks__grid">
              {FALLBACK_ASSETS.map((asset) => (
                <figure key={asset.key} className="od-art-studio-fallbacks__card">
                  <img
                    src={`${asset.path}?v=${fallbackBust}`}
                    alt={asset.label}
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                  <figcaption>
                    <strong>{asset.label}</strong>
                    <span>{asset.hint}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'studio' ? (
        <>
          <PageStatus error={error} />
          {message ? (
            <p className="od-admin-lede" role="status">
              {message}
            </p>
          ) : null}

          <section className="od-art-studio od-art-studio--workspace" aria-label="Cover studio">
            <div
              className={`od-art-studio__stage${skin ? ` od-art-studio__stage--${skin.family}` : ''}`}
              style={previewChromeStyle}
              aria-busy={previewBusy}
            >
              {heroSrc ? (
                <figure className="od-art-studio__hero">
                  {previewArtistic ? (
                    <span className="od-art-studio__mode-badge">Artistic</span>
                  ) : null}
                  <img
                    src={heroSrc}
                    alt={`${title || 'Cover'} preview ${activeVariant.label}`}
                    width={activeVariant.width}
                    height={activeVariant.height}
                  />
                  <figcaption>
                    {activeVariant.label}
                    {systemText ? ` · ${systemText}` : ''}
                    {previewArtistic ? ' · artistic' : ''}
                    {previewBusy ? ' · painting…' : ''}
                  </figcaption>
                </figure>
              ) : (
                <div className="od-art-studio__empty" data-testid="art-studio-empty">
                  <div className="od-art-studio__empty-glow" aria-hidden="true" />
                  <p className="od-art-studio__empty-title">
                    {previewBusy ? 'Painting cover…' : 'Name a title to paint a cover'}
                  </p>
                  <p className="od-art-studio__empty-hint">
                    Title-first atelier — Backend artistic compositions by default (motifs · bezels ·
                    watermark), not gray placeholders.
                  </p>
                </div>
              )}

              <div className="od-art-studio__thumbs" aria-label="Other tile sizes">
                {PREVIEW_VARIANTS.filter((v) => v.key !== activeVariant.key && v.kind === 'tile').map(
                  (size) => {
                    const src = previews[size.key]
                    return (
                      <button
                        key={size.key}
                        type="button"
                        className="od-art-studio__thumb"
                        onClick={() => setVariantKey(size.key)}
                        title={`Show ${size.label}`}
                      >
                        {src ? (
                          <img src={src} alt="" width={size.width} height={size.height} />
                        ) : (
                          <span>{size.label}</span>
                        )}
                      </button>
                    )
                  },
                )}
              </div>
            </div>

            <div className="od-art-studio__controls">
              <label className="od-art-studio__title-field">
                <span className="od-art-studio__label">Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chrono Trigger"
                  maxLength={120}
                  autoComplete="off"
                  aria-describedby="od-art-title-hint"
                />
              </label>
              <p id="od-art-title-hint" className="od-art-studio__hint">
                Typing refreshes the live artistic preview. Generate writes the full size pack with
                the same renderer.
              </p>

              <label>
                <span className="od-art-studio__label">System / platform</span>
                <select
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  aria-label="System for art template"
                >
                  {ART_STUDIO_SYSTEMS.map((s) => (
                    <option key={s.id || 'generic'} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* FEAT-D4 text overrides (UID-011). The renderer has always
                  accepted these; there was simply no way to reach them, so the
                  only answer to "the text is too small" was to change a default
                  for every cover at once. */}
              <fieldset className="od-art-studio__text">
                <legend className="od-art-studio__label">Cover text</legend>

                <label>
                  <span className="od-art-studio__label">Headline</span>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Derived from the title"
                    maxLength={120}
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span className="od-art-studio__label">Subtitle</span>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Derived from the title"
                    maxLength={120}
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span className="od-art-studio__label">
                    Title size — {titleScale.toFixed(2)}×
                  </span>
                  <input
                    type="range"
                    min={TITLE_SCALE_MIN}
                    max={TITLE_SCALE_MAX}
                    step="0.05"
                    value={titleScale}
                    onChange={(e) => setTitleScale(Number(e.target.value))}
                    aria-describedby="od-art-scale-hint"
                  />
                </label>
                <p id="od-art-scale-hint" className="od-art-studio__hint">
                  Clamped {TITLE_SCALE_MIN}×–{TITLE_SCALE_MAX}× by the renderer, which also refuses to overflow the
                  canvas — the slider asks for a size, it does not override the fit.
                  Leave the fields empty to keep the text derived from the title; an
                  empty subtitle is kept as “no subtitle”.
                </p>
              </fieldset>

              <fieldset className="od-art-studio__variants">
                <legend className="od-art-studio__label">Preview size</legend>
                <div className="od-art-studio__variant-row" role="group" aria-label="Preview size">
                  {PREVIEW_VARIANTS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      className={`od-art-studio__variant${variantKey === v.key ? ' is-active' : ''}`}
                      aria-pressed={variantKey === v.key}
                      onClick={() => setVariantKey(v.key)}
                    >
                      {v.label}
                      <span className="od-art-studio__variant-kind">{v.kind}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="od-admin-actions-row od-art-studio__primary-actions">
                <button
                  type="button"
                  className="od-btn"
                  disabled={!hasTitle || previewBusy}
                  onClick={runPreview}
                >
                  {previewBusy ? 'Previewing…' : 'Preview'}
                </button>
                <button
                  type="button"
                  className="od-btn od-btn--primary"
                  disabled={!hasTitle || busy === 'generate'}
                  onClick={runGenerate}
                >
                  {busy === 'generate' ? 'Generating…' : 'Generate pack'}
                </button>
              </div>

              <div className="od-art-studio__pack-actions">
                {downloadZip ? (
                  <a className="od-btn" href={downloadZip}>
                    Download ZIP
                  </a>
                ) : (
                  <button type="button" className="od-btn" disabled>
                    Download ZIP
                  </button>
                )}
                <button
                  type="button"
                  className="od-btn"
                  disabled={!packId || busy === 'apply-fallback'}
                  onClick={applyFallback}
                >
                  Set as fallback
                </button>
              </div>

              <label className="od-art-studio__uuid-field">
                <span className="od-art-studio__label">Apply to game UUID</span>
                <input
                  type="text"
                  value={gameUuid}
                  onChange={(e) => setGameUuid(e.target.value)}
                  placeholder="game uuid"
                  disabled={!packId}
                />
              </label>
              <button
                type="button"
                className="od-btn od-btn--primary"
                disabled={!packId || !gameUuid.trim() || busy === 'apply-game'}
                onClick={applyToGame}
              >
                Apply cover to game
              </button>

              {packId ? (
                <p className="od-art-studio__pack-meta">
                  Pack <code className="od-mono">{packId}</code> · tiles, wides, squares, hero under{' '}
                  <code>static/library/generated/</code>
                </p>
              ) : null}
            </div>
          </section>

          <section className="od-admin-panel od-art-studio-fallbacks" aria-label="Library default covers">
            <div className="od-art-studio-fallbacks__head">
              <div>
                <h2 className="od-admin-panel-title">Library default covers</h2>
                <p className="od-admin-lede">
                  Site-wide fallbacks when a title has no downloaded art. Generate a pack above, then
                  set as fallback — or open{' '}
                  <button type="button" className="od-art-inline-link" onClick={() => selectTab('stock')}>
                    Backup &amp; stock
                  </button>{' '}
                  for platform packs and stock motifs.
                </p>
              </div>
              <button
                type="button"
                className="od-btn od-btn--primary"
                disabled={busy === 'regen-fallback'}
                onClick={regenerateDefaults}
              >
                {busy === 'regen-fallback' ? 'Regenerating…' : 'Regenerate defaults'}
              </button>
            </div>
            <div className="od-art-studio-fallbacks__grid">
              {FALLBACK_ASSETS.map((asset) => (
                <figure key={asset.key} className="od-art-studio-fallbacks__card">
                  <img
                    src={`${asset.path}?v=${fallbackBust}`}
                    alt={asset.label}
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                  <figcaption>
                    <strong>{asset.label}</strong>
                    <span>{asset.hint}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="od-admin-panel od-art-studio-batch">
            <button
              type="button"
              className="od-art-studio-batch__toggle"
              aria-expanded={batchOpen}
              onClick={() => setBatchOpen((o) => !o)}
            >
              <h2 className="od-admin-panel-title">Batch placeholders for no-cover titles</h2>
              <span aria-hidden="true">{batchOpen ? '▾' : '▸'}</span>
            </button>
            {batchOpen ? (
              <>
                <p className="od-admin-lede">
                  Loads the library health sample, then applies procedural covers for checked titles
                  via <code>POST /admin/api/art-studio/batch-generate</code>, falling back to{' '}
                  <code>covers/batch/apply</code> (<code>policy=generate_only</code>) then per-title
                  generate/apply.
                </p>
                <div className="od-admin-actions-row">
                  <button
                    type="button"
                    className="od-btn"
                    disabled={busy === 'missing'}
                    onClick={loadMissing}
                  >
                    Load no-cover list
                  </button>
                  <button
                    type="button"
                    className="od-btn od-btn--primary"
                    disabled={busy === 'batch' || !batchSelected.size}
                    onClick={batchApplyPlaceholders}
                  >
                    Apply placeholders ({batchSelected.size})
                  </button>
                </div>
                {missingCovers.length ? (
                  <ul className="od-art-studio__batch-list">
                    {missingCovers.map((g) => (
                      <li key={g.uuid}>
                        <label>
                          <input
                            type="checkbox"
                            checked={batchSelected.has(g.uuid)}
                            onChange={() => toggleBatch(g.uuid)}
                          />
                          {g.name} <code className="od-mono">{g.uuid}</code>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {batchLog ? (
                  <pre className="od-art-studio__batch-log" aria-live="polite">
                    {batchLog}
                  </pre>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
