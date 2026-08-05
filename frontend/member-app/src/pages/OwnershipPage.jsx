import { useEffect, useRef, useState } from 'react'
import {
  connectEpic,
  connectGog,
  connectSteam,
  disconnectEpic,
  disconnectGog,
  disconnectSteam,
  fetchOwnership,
  importCsv,
  syncSteam,
} from '../api/ownership'
import { LoadingOverlay } from '../components/LoadingOverlay'
import './OwnershipPage.css'

const STORES = [
  {
    key: 'steam',
    label: 'Steam',
    meta: 'Live sync via Steam Web API when configured, or CSV import.',
    fieldLabel: 'Steam ID (64-bit)',
    fieldPlaceholder: '7656119…',
    numericField: true,
    saveLabel: 'Save Steam ID',
    connect: connectSteam,
    disconnect: disconnectSteam,
    disconnectPrompt: 'Remove Steam link and clear synced Steam ownership?',
    csvLabel: 'Or import app IDs (CSV, one per line)',
    csvPlaceholder: 'appid\n570\n730',
    csvNoun: 'app IDs',
    canSync: true,
  },
  {
    key: 'gog',
    label: 'GOG',
    meta: 'Register-only — import product IDs or id,name rows via CSV. No live GOG download.',
    fieldLabel: 'GOG user ID or note (optional)',
    fieldPlaceholder: 'Optional label for your GOG link',
    numericField: false,
    saveLabel: 'Save GOG link',
    connect: connectGog,
    disconnect: disconnectGog,
    disconnectPrompt: 'Remove GOG link and clear imported GOG ownership?',
    csvLabel: 'Import owned titles (CSV: product ID or id,name per line)',
    csvPlaceholder: 'product_id,name\n1207658924,The Witcher 3',
    csvNoun: 'GOG titles',
    canSync: false,
  },
  {
    key: 'epic',
    label: 'Epic Games',
    meta: 'Register-only — import catalog item IDs or id,name rows via CSV. No live Epic download.',
    fieldLabel: 'Epic account ID or note (optional)',
    fieldPlaceholder: 'Optional label for your Epic link',
    numericField: false,
    saveLabel: 'Save Epic link',
    connect: connectEpic,
    disconnect: disconnectEpic,
    disconnectPrompt: 'Remove Epic link and clear imported Epic ownership?',
    csvLabel: 'Import owned titles (CSV: catalog item ID or id,name per line)',
    csvPlaceholder: 'catalog_item_id,name\nfn,Fortnite',
    csvNoun: 'Epic titles',
    canSync: false,
  },
]

const EMPTY_DRAFTS = { steam: '', gog: '', epic: '' }

function accountDraftsFrom(summary, current) {
  const stores = summary?.stores || {}
  const next = { ...current }
  for (const store of STORES) {
    const id = stores[store.key]?.external_account_id
    if (id) {
      next[store.key] = String(id)
    }
  }
  return next
}

export function OwnershipPage({ shellConfig: _shellConfig } = {}) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [busyAction, setBusyAction] = useState(null)
  const [messages, setMessages] = useState({})
  const [accountDrafts, setAccountDrafts] = useState(EMPTY_DRAFTS)
  const [csvDrafts, setCsvDrafts] = useState(EMPTY_DRAFTS)
  const fileInputs = useRef({})

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setSummary(null)

    fetchOwnership({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setSummary(data)
          setAccountDrafts((current) => accountDraftsFrom(data, current))
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

  function setMessage(storeKey, message) {
    setMessages((current) => ({ ...current, [storeKey]: message }))
  }

  async function runAction(actionKey, storeKey, run) {
    setBusyAction(actionKey)
    setMessage(storeKey, null)
    try {
      const result = await run()
      if (result?.summary) {
        setSummary(result.summary)
        setAccountDrafts((current) => accountDraftsFrom(result.summary, current))
      }
      return result || {}
    } catch (actionError) {
      setMessage(storeKey, { tone: 'error', text: actionError.message })
      return null
    } finally {
      setBusyAction(null)
    }
  }

  async function handleConnect(store, event) {
    event.preventDefault()
    const result = await runAction(`${store.key}:connect`, store.key, () =>
      store.connect(accountDrafts[store.key]),
    )
    if (result) {
      setMessage(store.key, { tone: 'ok', text: `${store.label} link saved.` })
    }
  }

  async function handleDisconnect(store) {
    if (!window.confirm(store.disconnectPrompt)) {
      return
    }
    const result = await runAction(`${store.key}:disconnect`, store.key, () =>
      store.disconnect(),
    )
    if (result) {
      setAccountDrafts((current) => ({ ...current, [store.key]: '' }))
      setMessage(store.key, { tone: 'ok', text: `${store.label} link removed.` })
    }
  }

  async function handleSync(store) {
    const result = await runAction(`${store.key}:sync`, store.key, () => syncSteam())
    if (result) {
      setMessage(store.key, {
        tone: 'ok',
        text: `Synced ${result.synced ?? 0} titles (${result.matched ?? 0} matched to library).`,
      })
    }
  }

  async function handleCsv(store, event) {
    event.preventDefault()
    const fileInput = fileInputs.current[store.key]
    const file = fileInput?.files?.[0] || null
    const csv = csvDrafts[store.key]

    if (!file && !csv.trim()) {
      setMessage(store.key, {
        tone: 'error',
        text: 'Paste CSV rows or choose a CSV file first.',
      })
      return
    }

    const result = await runAction(`${store.key}:csv`, store.key, () =>
      importCsv(store.key, { csv, file }),
    )
    if (result) {
      setCsvDrafts((current) => ({ ...current, [store.key]: '' }))
      if (fileInput) {
        fileInput.value = ''
      }
      setMessage(store.key, {
        tone: 'ok',
        text: `Imported ${result.imported ?? 0} ${store.csvNoun} (${result.matched ?? 0} matched).`,
      })
    }
  }

  if (error) {
    return (
      <div className="gt-more-page gt-ownership">
        <div className="gt-page-header">
          <h1>Store Ownership</h1>
        </div>
        <div role="alert">
          <p>Unable to load store ownership.</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const stores = summary?.stores || {}
  const enabled = summary ? summary.enabled !== false : false

  return (
    <div className="gt-more-page gt-ownership">
      <div className="gt-page-header">
        <h1>Store Ownership</h1>
      </div>
      <p className="gt-more-page__lede">
        Link store accounts and import owned-title lists to show which library games you
        also own elsewhere. Register-only sync — GameTheca never downloads games or DRM
        from stores.
      </p>

      {/* Floating, so the panel below does not jump when the fetch resolves.
          delayMs=0 — this is the initial load, so the page would otherwise sit
          blank with nothing explaining why. */}
      <LoadingOverlay active={!summary} label="Loading ownership status…" delayMs={0} />

      <div className="gt-ownership__status" aria-live="polite">

        {summary && !enabled ? (
          <p className="gt-ownership__empty">
            Store ownership sync is disabled by your administrator.
          </p>
        ) : null}

        {summary && enabled && (summary.total_owned ?? 0) === 0 ? (
          <p className="gt-ownership__empty">
            No owned titles synced yet. Connect a store or import a CSV below.
          </p>
        ) : null}

        {summary && enabled ? (
          <article className="gt-ownership__card">
            <strong>Owned titles (register-only)</strong>
            <span>
              {summary.total_owned ?? 0} synced · {summary.total_matched ?? 0} matched to
              library
            </span>
            {STORES.map((store) => {
              const state = stores[store.key] || {}
              return (
                <span key={store.key} className="gt-ownership__meta">
                  {store.label}: {state.connected ? 'connected' : 'not connected'} ·{' '}
                  {state.owned_count ?? 0} titles · {state.matched_count ?? 0} matched
                </span>
              )
            })}
            <span className="gt-ownership__meta">
              {summary.has_steam_api_key
                ? 'Steam API key configured'
                : 'Steam: no API key — use CSV import'}
            </span>
            <span className="gt-ownership__meta">
              GOG/Epic: CSV import only — no store downloads
            </span>
          </article>
        ) : null}
      </div>

      {summary && enabled
        ? STORES.map((store) => {
            const state = stores[store.key] || {}
            const message = messages[store.key]
            const busy = busyAction?.startsWith(`${store.key}:`)
            return (
              <section key={store.key} className="gt-ownership__section">
                <h2>{store.label}</h2>
                <p className="gt-ownership__meta">{store.meta}</p>

                {message ? (
                  <p
                    className="gt-ownership__message"
                    data-tone={message.tone}
                    role={message.tone === 'error' ? 'alert' : 'status'}
                  >
                    {message.text}
                  </p>
                ) : null}

                <form onSubmit={(event) => handleConnect(store, event)}>
                  <label>
                    {store.fieldLabel}
                    <input
                      type="text"
                      value={accountDrafts[store.key]}
                      placeholder={store.fieldPlaceholder}
                      inputMode={store.numericField ? 'numeric' : undefined}
                      pattern={store.numericField ? '[0-9]+' : undefined}
                      onChange={(event) =>
                        setAccountDrafts((current) => ({
                          ...current,
                          [store.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    {busyAction === `${store.key}:connect` ? 'Saving…' : store.saveLabel}
                  </button>
                </form>

                <div className="gt-ownership__actions">
                  {store.canSync ? (
                    <button type="button" disabled={busy} onClick={() => handleSync(store)}>
                      {busyAction === `${store.key}:sync`
                        ? `Syncing from ${store.label}…`
                        : `Sync from ${store.label}`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !state.connected}
                    onClick={() => handleDisconnect(store)}
                  >
                    {busyAction === `${store.key}:disconnect`
                      ? 'Disconnecting…'
                      : `Disconnect ${store.label}`}
                  </button>
                </div>

                <form onSubmit={(event) => handleCsv(store, event)}>
                  <label>
                    {store.csvLabel}
                    <textarea
                      rows={4}
                      value={csvDrafts[store.key]}
                      placeholder={store.csvPlaceholder}
                      onChange={(event) =>
                        setCsvDrafts((current) => ({
                          ...current,
                          [store.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Or upload a CSV file
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      ref={(node) => {
                        fileInputs.current[store.key] = node
                      }}
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    {busyAction === `${store.key}:csv` ? 'Importing…' : 'Import CSV'}
                  </button>
                </form>
              </section>
            )
          })
        : null}
    </div>
  )
}
