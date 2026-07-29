import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImagesPage } from './ImagesPage'
import { getJson, postJson } from './adminApi'
import { ART_STUDIO_SYSTEMS, skinForPlatform, systemLabel } from './platformSkins'

const TILE_SIZES = [
  { key: 'sm', width: 200, height: 300, label: '200×300' },
  { key: 'md', width: 400, height: 600, label: '400×600' },
]

function initialTab() {
  if (typeof window === 'undefined') return 'studio'
  const hash = (window.location.hash || '').replace('#', '')
  if (hash === 'images' || hash === 'queue' || hash === 'picker') return 'images'
  return 'studio'
}

export function ArtStudioPage() {
  const [tab, setTab] = useState(initialTab)
  const [title, setTitle] = useState('')
  const [system, setSystem] = useState('')
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

  const skin = useMemo(() => skinForPlatform(system), [system])
  const systemText = systemLabel(system)
  // Short platform id (SNES, PSX, …) matches Backend SYSTEM_TEMPLATES keys.
  const systemForApi = system || undefined

  const selectTab = (next) => {
    setTab(next)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', next === 'images' ? '#images' : '#studio')
    }
  }

  useEffect(() => {
    const onHash = () => setTab(initialTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const runPreview = useCallback(async () => {
    setBusy('preview')
    setError('')
    setMessage('')
    try {
      const next = {}
      for (const size of TILE_SIZES) {
        const data = await postJson('/admin/api/art-studio/preview', {
          title,
          system: systemForApi,
          width: size.width,
          height: size.height,
        })
        next[size.key] = data.preview
      }
      setPreviews(next)
      setPreviewUrl('')
      setMessage('Preview refreshed at library tile sizes.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [title, systemForApi])

  // Re-preview when system changes and we already have a title + preview.
  useEffect(() => {
    if (!title.trim() || !Object.keys(previews).length) return undefined
    let cancelled = false
    setBusy('preview-system')
    ;(async () => {
      try {
        const next = {}
        for (const size of TILE_SIZES) {
          const data = await postJson('/admin/api/art-studio/preview', {
            title,
            system: systemForApi,
            width: size.width,
            height: size.height,
          })
          if (cancelled) return
          next[size.key] = data.preview
        }
        if (!cancelled) {
          setPreviews(next)
          setMessage(`Preview updated for ${systemText || 'generic aurora'}.`)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Preview refresh failed')
      } finally {
        if (!cancelled) setBusy((b) => (b === 'preview-system' ? '' : b))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [system, systemForApi, systemText])

  const runGenerate = useCallback(async () => {
    setBusy('generate')
    setError('')
    setMessage('')
    try {
      const data = await postJson('/admin/api/art-studio/generate', {
        title,
        system: systemForApi,
        format: 'webp',
      })
      setPackId(data.pack_id)
      setPreviewUrl(data.preview_url)
      setPreviews({})
      setMessage(`Generated pack ${data.pack_id} (${data.files?.length || 0} sizes).`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [title, systemForApi])

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
    } catch (err) {
      setError(err.message)
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
      setMessage('Fallback pack installed (default_cover.jpg + default_library.jpg). Hard-refresh browsers.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [packId])

  const loadMissing = useCallback(async () => {
    setBusy('missing')
    setError('')
    try {
      const data = await getJson('/api/health/library?limit=200')
      const worst = Array.isArray(data.worst) ? data.worst : []
      const rows = worst.filter((g) => (g.issues || []).some((i) => i.code === 'missing_cover'))
      setMissingCovers(rows)
      setBatchSelected(new Set(rows.map((r) => r.uuid)))
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
        const failLines = (batch.errors || [])
          .map((r) => `✗ ${r.name || r.game_uuid}: ${r.error || 'failed'}`)
        setBatchLog(
          [
            'Used POST /admin/api/art-studio/batch-generate.',
            ...failLines,
          ].join('\n'),
        )
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
        boxShadow: `0 0 0 2px ${skin.accent}55, 0 8px 24px rgba(0,0,0,0.35)`,
      }
    : undefined

  return (
    <div className="gt-admin-page">
      <h1>Art studio</h1>
      <p className="gt-admin-lede">
        Placeholders and artwork picking for admins — aurora tokens, no cloud AI. Use{' '}
        <strong>Pick &amp; queue</strong> for SteamGridDB/IGDB search and mass downloads.
      </p>

      <div className="gt-art-tabs" role="tablist" aria-label="Art studio sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'studio'}
          className={`gt-art-tabs__btn${tab === 'studio' ? ' is-active' : ''}`}
          onClick={() => selectTab('studio')}
        >
          Placeholders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'images'}
          className={`gt-art-tabs__btn${tab === 'images' ? ' is-active' : ''}`}
          onClick={() => selectTab('images')}
        >
          Pick &amp; queue
        </button>
      </div>

      {tab === 'images' ? <ImagesPage embedded /> : null}

      {tab === 'studio' ? (
        <>
          {error ? (
            <div role="alert" className="gt-admin-alert">
              {error}
            </div>
          ) : null}
          {message ? <p className="gt-admin-lede">{message}</p> : null}

          <div className="gt-admin-panel gt-art-studio">
            <div className="gt-art-studio__form">
              <label>
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chrono Trigger"
                  maxLength={120}
                />
              </label>
              <label>
                System / platform
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
              <p className="gt-admin-lede">
                {skin ? (
                  <>
                    Preview chrome: <strong>{skin.label}</strong> family
                    {system ? <> · {systemText}</> : null}. System selector re-renders tiles at
                    200×300 and 400×600 so title readability matches the library grid.
                  </>
                ) : (
                  <>Generic aurora template (no platform accent).</>
                )}
              </p>
              <div className="gt-admin-actions-row">
                <button
                  type="button"
                  className="gt-btn"
                  disabled={!title || busy === 'preview' || busy === 'preview-system'}
                  onClick={runPreview}
                >
                  {busy === 'preview' || busy === 'preview-system' ? 'Previewing…' : 'Preview tiles'}
                </button>
                <button
                  type="button"
                  className="gt-btn gt-btn--primary"
                  disabled={!title || busy === 'generate'}
                  onClick={runGenerate}
                >
                  Generate all sizes
                </button>
              </div>
            </div>

            <div className="gt-art-studio__preview-stack" aria-busy={busy === 'preview' || busy === 'preview-system'}>
              {TILE_SIZES.map((size) => {
                const src = previews[size.key] || (size.key === 'md' ? previewUrl : '')
                return (
                  <figure
                    key={size.key}
                    className={`gt-art-studio__tile gt-art-studio__tile--${size.key}${
                      skin ? ` gt-art-studio__tile--${skin.family}` : ''
                    }`}
                    style={previewChromeStyle}
                    data-platform={system || undefined}
                  >
                    <figcaption>
                      {size.label}
                      {system ? ` · ${systemText}` : ''}
                    </figcaption>
                    {src ? (
                      <img
                        src={src}
                        alt={`${title || 'Cover'} preview ${size.label}`}
                        width={size.width}
                        height={size.height}
                        style={{ width: size.width, height: size.height }}
                      />
                    ) : (
                      <div
                        className="gt-art-studio__tile-placeholder"
                        style={{ width: size.width, height: size.height }}
                      >
                        <span>
                          {busy === 'preview' || busy === 'preview-system'
                            ? 'Loading…'
                            : `Empty ${size.label}`}
                        </span>
                      </div>
                    )}
                  </figure>
                )
              })}
              <p className="gt-admin-lede">
                Tiles render at real pixel sizes (200×300 / 400×600) so title readability matches the
                library grid.
              </p>
            </div>
          </div>

          {packId ? (
            <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
              <h2>Pack {packId}</h2>
              <p className="gt-admin-lede">
                Includes 2:3 tiles, 16:9 wides, 1:1 squares, and 1280×720 hero under{' '}
                <code>static/library/generated/{packId}/</code>.
              </p>
              <div className="gt-admin-actions-row">
                {downloadZip ? (
                  <a className="gt-btn" href={downloadZip}>
                    Download ZIP
                  </a>
                ) : null}
                <button
                  type="button"
                  className="gt-btn"
                  disabled={busy === 'apply-fallback'}
                  onClick={applyFallback}
                >
                  Set as fallback pack
                </button>
              </div>
              <label style={{ display: 'block', marginTop: '1rem' }}>
                Attach to game UUID
                <input
                  type="text"
                  value={gameUuid}
                  onChange={(e) => setGameUuid(e.target.value)}
                  placeholder="game uuid"
                />
              </label>
              <button
                type="button"
                className="gt-btn gt-btn--primary"
                style={{ marginTop: '0.5rem' }}
                disabled={busy === 'apply-game'}
                onClick={applyToGame}
              >
                Apply cover to game
              </button>
            </div>
          ) : null}

          <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
            <h2>Batch placeholders for no-cover titles</h2>
            <p className="gt-admin-lede">
              Loads the library health sample, then applies procedural placeholders for checked
              titles via <code>POST /admin/api/art-studio/batch-generate</code>, falling back to{' '}
              <code>covers/batch/apply</code> (<code>policy=generate_only</code>) then per-title
              generate/apply.
            </p>
            <div className="gt-admin-actions-row">
              <button type="button" className="gt-btn" disabled={busy === 'missing'} onClick={loadMissing}>
                Load no-cover list
              </button>
              <button
                type="button"
                className="gt-btn gt-btn--primary"
                disabled={busy === 'batch' || !batchSelected.size}
                onClick={batchApplyPlaceholders}
              >
                Apply placeholders ({batchSelected.size})
              </button>
            </div>
            {missingCovers.length ? (
              <ul className="gt-art-studio__batch-list">
                {missingCovers.map((g) => (
                  <li key={g.uuid}>
                    <label>
                      <input
                        type="checkbox"
                        checked={batchSelected.has(g.uuid)}
                        onChange={() => toggleBatch(g.uuid)}
                      />
                      {g.name} <code className="gt-mono">{g.uuid}</code>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            {batchLog ? (
              <pre className="gt-art-studio__batch-log" aria-live="polite">
                {batchLog}
              </pre>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
