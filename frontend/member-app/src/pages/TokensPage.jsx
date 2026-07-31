import { useEffect, useRef, useState } from 'react'
import { createToken, listTokens, revokeToken } from '../api/tokens'
import { copyText } from '../utils/copyText'
import { showToast } from '../utils/toast'
import './TokensPage.css'

const PRESET_FALLBACK = {
  companion: {
    label: 'Desktop companion',
    scopes: ['read:library', 'write:download'],
    hint: 'Library browse + download for the full Tauri companion.',
  },
  thin: {
    label: 'Thin client',
    scopes: ['read:library', 'read:social', 'write:presence'],
    hint: 'Library + social/presence — no download scope.',
  },
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

export function TokensPage() {
  const [tokens, setTokens] = useState([])
  const [presets, setPresets] = useState(PRESET_FALLBACK)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('companion')
  const [createdSecret, setCreatedSecret] = useState(null)
  const [copyState, setCopyState] = useState('idle')
  const [retryCount, setRetryCount] = useState(0)
  const secretCodeRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)

    listTokens({ signal: controller.signal })
      .then((data) => {
        if (!active) return
        setTokens(Array.isArray(data.tokens) ? data.tokens : [])
        if (data.scope_presets && typeof data.scope_presets === 'object') {
          setPresets({ ...PRESET_FALLBACK, ...data.scope_presets })
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  async function refresh() {
    const data = await listTokens()
    setTokens(Array.isArray(data.tokens) ? data.tokens : [])
    if (data.scope_presets && typeof data.scope_presets === 'object') {
      setPresets({ ...PRESET_FALLBACK, ...data.scope_presets })
    }
  }

  async function onCreate(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setCopyState('idle')
    try {
      const result = await createToken({ name: trimmed, preset })
      setCreatedSecret({
        secret: result.secret,
        warning: result.warning || 'Store this secret now; it will not be shown again.',
        name: result.token?.name || trimmed,
        prefix: result.token?.token_prefix || '',
      })
      setName('')
      await refresh()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onRevoke(tokenId, tokenName) {
    if (busy) return
    const ok = window.confirm(`Revoke token “${tokenName}”? Clients using it will stop working.`)
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await revokeToken(tokenId)
      await refresh()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function copySecret() {
    if (!createdSecret?.secret) return
    const ok = await copyText(createdSecret.secret, { selectEl: secretCodeRef.current })
    if (ok) {
      setCopyState('copied')
      showToast('Token secret copied', 'success')
      return
    }
    setCopyState('failed')
    showToast('Clipboard unavailable — select the secret and copy manually', 'warn')
  }

  const activeTokens = tokens.filter((row) => !row.revoked)
  const presetMeta = presets[preset] || PRESET_FALLBACK[preset] || PRESET_FALLBACK.companion

  return (
    <div className="gt-more-page gt-tokens">
      <div className="gt-page-header">
        <h1>API tokens</h1>
      </div>
      <p className="gt-more-page__lede">
        Create personal access tokens for the desktop companion. The full secret is shown once —
        paste it into the companion Connect screen; it is stored in the OS keyring, not in this UI.
        Format is <code>gt_&lt;prefix&gt;_&lt;secret&gt;</code> (secret may include <code>-</code> /{' '}
        <code>_</code>). Copy prefers HTTPS; on plain HTTP LAN, use Copy (fallback) or select the
        secret manually.
      </p>

      {error ? (
        <p role="alert">
          {error.message || 'Unable to load tokens.'}{' '}
          <button type="button" className="gt-btn" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </p>
      ) : null}

      {createdSecret ? (
        <section className="gt-tokens__secret" aria-labelledby="gt-tokens-secret-heading">
          <h2 id="gt-tokens-secret-heading">New token secret</h2>
          <p className="gt-tokens__warning" role="status">
            {createdSecret.warning}
          </p>
          <p className="gt-tokens__secret-meta">
            {createdSecret.name}
            {createdSecret.prefix ? ` · prefix ${createdSecret.prefix}…` : null}
          </p>
          <code ref={secretCodeRef} className="gt-tokens__secret-value" tabIndex={0}>
            {createdSecret.secret}
          </code>
          <div className="gt-tokens__secret-actions">
            <button type="button" className="gt-btn gt-btn--primary" onClick={() => void copySecret()}>
              {copyState === 'copied' ? 'Copied' : 'Copy secret'}
            </button>
            <button
              type="button"
              className="gt-btn"
              onClick={() => {
                setCreatedSecret(null)
                setCopyState('idle')
              }}
            >
              Done
            </button>
          </div>
          {copyState === 'copied' ? (
            <p role="status" className="gt-tokens__copy-status">
              Secret copied. Paste the full token into the companion Connect screen.
            </p>
          ) : null}
          {copyState === 'failed' ? (
            <p role="alert" className="gt-tokens__copy-status">
              Clipboard unavailable (common on plain HTTP). Triple-click or focus the secret above
              and press Ctrl+C / ⌘C — paste the full <code>gt_…</code> string without trimming.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="gt-tokens__create" aria-labelledby="gt-tokens-create-heading">
        <h2 id="gt-tokens-create-heading">Create token</h2>
        <form className="gt-tokens__form" onSubmit={(event) => void onCreate(event)}>
          <label className="gt-tokens__field">
            <span>Name</span>
            <input
              type="text"
              name="token-name"
              maxLength={100}
              autoComplete="off"
              placeholder="My PC"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </label>
          <fieldset className="gt-tokens__presets" disabled={busy}>
            <legend>Preset</legend>
            {Object.entries(presets).map(([key, meta]) => (
              <label key={key} className="gt-tokens__preset">
                <input
                  type="radio"
                  name="token-preset"
                  value={key}
                  checked={preset === key}
                  onChange={() => setPreset(key)}
                />
                <span>
                  <strong>{meta.label || key}</strong>
                  <span className="gt-tokens__preset-scopes">
                    {(meta.scopes || []).join(', ') || '—'}
                  </span>
                  {PRESET_FALLBACK[key]?.hint ? (
                    <span className="gt-tokens__preset-hint">{PRESET_FALLBACK[key].hint}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>
          <p className="gt-tokens__preset-summary">
            Selected scopes: {(presetMeta.scopes || []).join(', ') || '—'}
          </p>
          <button
            type="submit"
            className="gt-btn gt-btn--primary"
            disabled={busy || !name.trim()}
          >
            {busy ? 'Working…' : 'Create token'}
          </button>
        </form>
      </section>

      <section className="gt-tokens__list-wrap" aria-labelledby="gt-tokens-list-heading">
        <h2 id="gt-tokens-list-heading">Your tokens</h2>
        {activeTokens.length === 0 ? (
          <p className="gt-more-page__lede">No active tokens yet.</p>
        ) : (
          <ul className="gt-tokens__list">
            {activeTokens.map((row) => (
              <li key={row.id} className="gt-tokens__row">
                <div className="gt-tokens__row-main">
                  <strong>{row.name}</strong>
                  <span className="gt-tokens__prefix">{row.token_prefix}…</span>
                  <span className="gt-tokens__scopes">{(row.scopes || []).join(', ')}</span>
                  <span className="gt-tokens__meta">
                    Created {formatWhen(row.created_at)}
                    {row.last_used_at ? ` · Last used ${formatWhen(row.last_used_at)}` : ' · Never used'}
                  </span>
                </div>
                <button
                  type="button"
                  className="gt-btn"
                  disabled={busy}
                  onClick={() => void onRevoke(row.id, row.name)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
