import { useEffect, useState } from 'react'
import { getJson, postJson } from './adminApi'
import { MetricStrip } from './opsWidgets'
import { PageStatus } from './PageStatus'

const EMPTY_STATUS = {
  helpers_enabled: false,
  allow_apply: false,
  games_path: '',
  games_exists: false,
  games_readable: false,
  games_writable: false,
  degrade_reason: null,
}

function formatBytes(n) {
  const value = Number(n) || 0
  if (value <= 0) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StoragePage() {
  const [status, setStatus] = useState(EMPTY_STATUS)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [statusError, setStatusError] = useState(null)
  const [source, setSource] = useState('')
  const [dest, setDest] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [result, setResult] = useState(null)
  const [resultKind, setResultKind] = useState(null)

  useEffect(() => {
    let cancelled = false
    getJson('/api/storage/status')
      .then((data) => {
        if (cancelled) return
        setStatus({
          helpers_enabled: Boolean(data?.helpers_enabled),
          allow_apply: Boolean(data?.allow_apply),
          games_path: data?.games_path || '',
          games_exists: Boolean(data?.games_exists),
          games_readable: Boolean(data?.games_readable),
          games_writable: Boolean(data?.games_writable),
          degrade_reason: data?.degrade_reason || null,
        })
        setStatusError(null)
      })
      .catch((err) => {
        if (cancelled) return
        // Soft-fail: keep form usable; banners degrade to unknown/off.
        setStatus(EMPTY_STATUS)
        setStatusError(err.message || 'Could not load storage status')
      })
      .finally(() => {
        if (!cancelled) setStatusLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runAction(kind) {
    const path =
      kind === 'apply' ? '/api/storage/hardlink/apply' : '/api/storage/hardlink/preview'
    if (busy) return
    setBusy(true)
    setActionError(null)
    setResult(null)
    setResultKind(null)
    try {
      const data = await postJson(path, {
        source: source.trim(),
        dest: dest.trim(),
      })
      setResult(data)
      setResultKind(kind)
    } catch (err) {
      setActionError(err.message || `${kind} failed`)
    } finally {
      setBusy(false)
    }
  }

  const helpersOn = status.helpers_enabled
  const allowApply = status.allow_apply
  const gamesRo = status.games_exists && !status.games_writable
  const previewDisabled = busy || !helpersOn
  const applyDisabled = busy || !allowApply

  return (
    <div className="od-admin-page">
      <h1>Storage / hardlinks</h1>
      <p className="od-admin-lede">
        Preview same-volume hardlinks. Apply requires{' '}
        <code>ALLOW_HARDLINK_APPLY=true</code>. Docker read-only games mounts fail writability
        checks — preview still explains why.
      </p>

      {/* UID-014. This page's metrics are readiness states, not counts, so the
          strip answers "can I actually do anything here" before the banners
          explain why not.

          Gated on `!statusError` as well as `statusLoaded`: statusLoaded is set
          in a `finally`, so it becomes true on a failed read too, with `status`
          reset to EMPTY_STATUS. Gating on it alone rendered "Games mount:
          Missing" in alarm red for a status we simply could not fetch — the
          same rule the Ops tiles follow (`na`, never a confident colour, for a
          value we could not read), broken in the alarming direction. The banner
          below already says the API is unavailable; the strip stays out of the
          way rather than contradicting it. */}
      {statusLoaded && !statusError ? (
        <MetricStrip
          label="Storage readiness"
          items={[
            {
              id: 'helpers',
              label: 'Helpers',
              value: helpersOn ? 'On' : 'Off',
              hint: 'hardlink preview',
              tone: helpersOn ? 'good' : 'warning',
            },
            {
              id: 'apply',
              label: 'Apply',
              value: allowApply ? 'Allowed' : 'Preview only',
              hint: 'ALLOW_HARDLINK_APPLY',
              tone: allowApply ? 'good' : 'info',
            },
            {
              id: 'games',
              label: 'Games mount',
              value: !status.games_exists ? 'Missing' : gamesRo ? 'Read-only' : 'Writable',
              hint: 'destination volume',
              tone: !status.games_exists ? 'action' : gamesRo ? 'warning' : 'good',
            },
          ]}
        />
      ) : null}

      {/* GT-B33: shared status block. The five `od-admin-banner` blocks below
          deliberately stay as they are — those disclose persistent
          configuration (helpers off, apply gated, mount read-only), which is
          page content, not a transient loading/error state. */}
      <PageStatus loading={!statusLoaded} loadingMessage="Loading storage status…" />

      {statusError ? (
        <div className="od-admin-banner od-admin-banner--warn" role="status">
          Status API unavailable ({statusError}). Preview/Apply may still work if helpers are on;
          banners below assume helpers off until status loads.
        </div>
      ) : null}

      {statusLoaded && !helpersOn ? (
        <div className="od-admin-banner od-admin-banner--warn" role="status">
          Hardlink helpers are <strong>off</strong>. Set{' '}
          <code>ENABLE_HARDLINK_HELPERS=true</code> (and restart) before preview or apply will work.
          Apply also needs <code>ALLOW_HARDLINK_APPLY=true</code> — both stay env-only safety gates.
        </div>
      ) : null}

      {statusLoaded && helpersOn && !allowApply ? (
        <div className="od-admin-banner od-admin-banner--info" role="status">
          Helpers are <strong>on</strong>, but Apply is disabled until{' '}
          <code>ALLOW_HARDLINK_APPLY=true</code> is set (safety default). Preview still works.
        </div>
      ) : null}

      {statusLoaded && helpersOn && allowApply ? (
        <div className="od-admin-banner od-admin-banner--ok" role="status">
          Helpers and Apply are both <strong>enabled</strong> via environment flags.
        </div>
      ) : null}

      {statusLoaded && gamesRo ? (
        <div className="od-admin-banner od-admin-banner--warn" role="status">
          Games mount is <strong>read-only</strong>
          {status.games_path ? (
            <>
              {' '}
              (<code>{status.games_path}</code>)
            </>
          ) : null}
          . Hardlink apply into that tree will fail writability checks; preview can still show
          reasons.
        </div>
      ) : null}

      {statusLoaded && status.degrade_reason ? (
        <p className="od-admin-lede od-admin-lede--warn" aria-live="polite">
          {status.degrade_reason}
        </p>
      ) : null}

      <div className="od-admin-panel">
        <label className="od-admin-field">
          Source file
          <input
            className="od-admin-input"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="C:\\games\\Title\\setup.exe"
            aria-label="Source file"
          />
        </label>
        <label className="od-admin-field">
          Destination path
          <input
            className="od-admin-input"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="C:\\library\\Title\\setup.exe"
            aria-label="Destination path"
          />
        </label>
        <div className="od-admin-actions-row">
          <button
            type="button"
            className="od-btn"
            onClick={() => runAction('preview')}
            disabled={previewDisabled}
            title={!helpersOn ? 'ENABLE_HARDLINK_HELPERS is off' : undefined}
          >
            Preview
          </button>
          <button
            type="button"
            className="od-btn"
            onClick={() => runAction('apply')}
            disabled={applyDisabled}
            title={!allowApply ? 'ALLOW_HARDLINK_APPLY is off' : undefined}
          >
            Apply
          </button>
          <a className="od-btn" href="/admin/settings">
            Back to settings
          </a>
        </div>
        <PageStatus error={actionError} />
      </div>

      {result ? (
        <div className="od-admin-panel" style={{ marginTop: 'var(--od-space-5)' }}>
          <h2 className="od-admin-panel-title">
            {resultKind === 'apply' ? 'Apply result' : 'Preview result'}
          </h2>
          <ul className="od-storage-result-list" aria-live="polite">
            <li>
              Outcome:{' '}
              <strong>
                {result.applied
                  ? 'Applied'
                  : result.would_succeed || result.ok
                    ? 'Would succeed'
                    : 'Would not succeed'}
              </strong>
            </li>
            <li>
              Same volume:{' '}
              <strong>{result.same_volume ? 'Yes' : 'No'}</strong>
            </li>
            <li>
              Bytes estimate:{' '}
              <strong>{formatBytes(result.bytes_saved_estimate)}</strong>
            </li>
            {(result.reasons || []).length ? (
              <li>
                Reasons:
                <ul>
                  {(result.reasons || []).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ) : (
              <li>Reasons: none</li>
            )}
            {result.source ? (
              <li>
                Source: <code>{result.source}</code>
              </li>
            ) : null}
            {result.dest ? (
              <li>
                Dest: <code>{result.dest}</code>
              </li>
            ) : null}
          </ul>
          <details className="od-storage-raw">
            <summary>Raw JSON</summary>
            <pre className="od-admin-output">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  )
}
