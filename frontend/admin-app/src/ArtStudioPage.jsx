import { useCallback, useState } from 'react'

async function postJson(url, body) {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || ''
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
    },
    body: JSON.stringify(body),
  })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `${url} ${response.status}`)
  }
  return data
}

export function ArtStudioPage() {
  const [title, setTitle] = useState('')
  const [system, setSystem] = useState('')
  const [preview, setPreview] = useState('')
  const [packId, setPackId] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [gameUuid, setGameUuid] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const runPreview = useCallback(async () => {
    setBusy('preview')
    setError('')
    setMessage('')
    try {
      const data = await postJson('/admin/api/art-studio/preview', {
        title,
        system: system || undefined,
        width: 400,
        height: 600,
      })
      setPreview(data.preview)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [title, system])

  const runGenerate = useCallback(async () => {
    setBusy('generate')
    setError('')
    setMessage('')
    try {
      const data = await postJson('/admin/api/art-studio/generate', {
        title,
        system: system || undefined,
        format: 'webp',
      })
      setPackId(data.pack_id)
      setPreviewUrl(data.preview_url)
      setPreview('')
      setMessage(`Generated pack ${data.pack_id} (${data.files?.length || 0} sizes).`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [title, system])

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

  const downloadZip = packId
    ? `/admin/api/art-studio/download/${encodeURIComponent(packId)}`
    : null

  return (
    <div className="gt-admin-page">
      <h1>Art studio</h1>
      <p className="gt-admin-lede">
        Generate on-brand cover placeholders (aurora tokens) at all library sizes. Admin/ops only —
        local Pillow render, no cloud AI.
      </p>

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
            System (optional)
            <input
              type="text"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="e.g. SNES"
              maxLength={40}
            />
          </label>
          <div className="gt-admin-actions-row">
            <button type="button" className="gt-btn" disabled={!title || busy === 'preview'} onClick={runPreview}>
              Preview tile
            </button>
            <button type="button" className="gt-btn gt-btn--primary" disabled={!title || busy === 'generate'} onClick={runGenerate}>
              Generate all sizes
            </button>
          </div>
        </div>

        <div className="gt-art-studio__preview">
          {preview ? (
            <img src={preview} alt="Preview tile" width={400} height={600} />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Generated tile" width={400} height={600} />
          ) : (
            <p className="gt-admin-lede">Preview appears here (400×600 tile).</p>
          )}
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
            <button type="button" className="gt-btn" disabled={busy === 'apply-fallback'} onClick={applyFallback}>
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
    </div>
  )
}
