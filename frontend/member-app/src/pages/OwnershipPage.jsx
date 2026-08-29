import { useEffect, useRef, useState } from 'react'
import {
  connectAmazon,
  connectEpic,
  connectGog,
  connectSteam,
  disconnectAmazon,
  disconnectEpic,
  disconnectGog,
  disconnectSteam,
  fetchOwnership,
  importCsv,
  syncAmazon,
  syncEpic,
  syncGog,
  syncSteam,
} from '../api/ownership'
import { ContextBar } from '../chrome/ContextBar'
import { LoadingOverlay } from '../components/LoadingOverlay'
import { PageStatus } from '../components/PageStatus'
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
    sync: syncSteam,
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
    meta: 'Live register sync via the unofficial GOG Galaxy client when a refresh token is saved. CSV still works. Oneirodex never downloads GOG titles.',
    fieldLabel: 'GOG user ID or note (optional)',
    fieldPlaceholder: 'Optional label for your GOG link',
    tokenLabel: 'GOG refresh token (from Heroic / Galaxy)',
    tokenPlaceholder: 'Paste refresh token — never shown again after save',
    tokenKind: 'password',
    numericField: false,
    saveLabel: 'Save GOG link',
    connect: (id, extras) => connectGog(id, extras),
    sync: syncGog,
    disconnect: disconnectGog,
    disconnectPrompt: 'Remove GOG link and clear imported GOG ownership?',
    csvLabel: 'Import owned titles (CSV: product ID or id,name per line)',
    csvPlaceholder: 'product_id,name\n1207658924,The Witcher 3',
    csvNoun: 'GOG titles',
    canSync: true,
  },
  {
    key: 'epic',
    label: 'Epic Games',
    meta: 'Live register sync via unofficial Epic device auth (Legendary / Heroic) when saved. CSV still works. Oneirodex never downloads Epic titles.',
    fieldLabel: 'Epic account ID or note (optional)',
    fieldPlaceholder: 'Optional label for your Epic link',
    tokenLabel: 'Epic device auth JSON',
    tokenPlaceholder: '{"account_id":"…","device_id":"…","secret":"…"}',
    tokenKind: 'textarea',
    numericField: false,
    saveLabel: 'Save Epic link',
    connect: (id, extras) => connectEpic(id, extras),
    sync: syncEpic,
    disconnect: disconnectEpic,
    disconnectPrompt: 'Remove Epic link and clear imported Epic ownership?',
    csvLabel: 'Import owned titles (CSV: catalog item ID or id,name per line)',
    csvPlaceholder: 'catalog_item_id,name\nfn,Fortnite',
    csvNoun: 'Epic titles',
    canSync: true,
  },
  {
    key: 'amazon',
    label: 'Amazon Games',
    meta: 'Live register sync via unofficial Nile / Heroic when a token blob is saved. CSV still works. Oneirodex never downloads Amazon titles.',
    fieldLabel: 'Amazon user ID or note (optional)',
    fieldPlaceholder: 'Optional label for your Amazon link',
    tokenLabel: 'Nile / Heroic token JSON',
    tokenPlaceholder:
      '{"refresh_token":"…","device_serial":"…"} or paste Heroic/Nile user.json',
    tokenKind: 'textarea',
    numericField: false,
    saveLabel: 'Save Amazon link',
    connect: (id, extras) => connectAmazon(id, extras),
    sync: syncAmazon,
    disconnect: disconnectAmazon,
    disconnectPrompt: 'Remove Amazon link and clear imported Amazon ownership?',
    csvLabel: 'Import owned Amazon titles (CSV: product ID or id,name per line)',
    csvNoun: 'Amazon titles',
    canSync: true,
  },
]

const EMPTY_DRAFTS = { steam: '', gog: '', epic: '', amazon: '' }
const EMPTY_TOKENS = { steam: '', gog: '', epic: '', amazon: '' }

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

export function OwnershipPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  // Nothing selected on arrival: the summary is what most visits are for, and
  // opening a connect form nobody asked for buries it again.
  const [activeStore, setActiveStore] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [busyAction, setBusyAction] = useState(null)
  const [messages, setMessages] = useState({})
  const [accountDrafts, setAccountDrafts] = useState(EMPTY_DRAFTS)
  const [tokenDrafts, setTokenDrafts] = useState(EMPTY_TOKENS)
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
    const extras = {}
    if (store.key === 'gog' && tokenDrafts.gog.trim()) {
      extras.refreshToken = tokenDrafts.gog.trim()
    }
    if (store.key === 'epic' && tokenDrafts.epic.trim()) {
      extras.deviceAuth = tokenDrafts.epic.trim()
    }
    if (store.key === 'amazon' && tokenDrafts.amazon.trim()) {
      extras.credential = tokenDrafts.amazon.trim()
    }
    const result = await runAction(`${store.key}:connect`, store.key, () =>
      store.connect(accountDrafts[store.key], extras),
    )
    if (result) {
      setTokenDrafts((current) => ({ ...current, [store.key]: '' }))
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
      setTokenDrafts((current) => ({ ...current, [store.key]: '' }))
      setMessage(store.key, { tone: 'ok', text: `${store.label} link removed.` })
    }
  }

  async function handleSync(store) {
    const result = await runAction(`${store.key}:sync`, store.key, () => store.sync())
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
        <PageStatus
          error={error}
          errorMessage="Unable to load store ownership."
          onRetry={() => setRetryCount((count) => count + 1)}
        />
      </div>
    )
  }

  const stores = summary?.stores || {}
  const enabled = summary ? summary.enabled !== false : false
  const selectedStore = STORES.find((store) => store.key === activeStore) || null

  return (
    <>
    {useNewChrome ? (
      /* One store at a time, chosen from bar two.
         The page stacked a full connect/import panel for every store, so the
         owned-titles summary — the thing you came to read — sat above three
         long forms you were not using. The stores become views; the summary
         stays put and the chosen store's card opens under it. */
      <ContextBar
        views={STORES.map((store) => ({ id: store.key, label: store.label }))}
        activeView={activeStore || ''}
        onSelectView={(id) => setActiveStore((current) => (current === id ? null : id))}
        summary={
          summary && enabled
            ? `${summary.total_owned ?? 0} owned · ${summary.total_matched ?? 0} matched`
            : null
        }
      />
    ) : null}
    <div className="gt-more-page gt-ownership">
      {useNewChrome ? null : (
        <>
          <div className="gt-page-header">
            <h1>Store Ownership</h1>
          </div>
          <p className="gt-more-page__lede">
            Link store accounts and import owned-title lists to show which library games you
            also own elsewhere. Register-only sync — Oneirodex never downloads games or DRM
            from stores.
          </p>
        </>
      )}

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
            <header className="gt-ownership__card-head">
              <div className="gt-ownership__card-title">
                <strong>Owned titles</strong>
                <span className="gt-ownership__pill">register-only</span>
              </div>
              <span className="gt-ownership__card-counts">
                {summary.total_owned ?? 0} synced · {summary.total_matched ?? 0} matched
              </span>
            </header>
            <ul className="gt-ownership__store-grid">
              {STORES.map((store) => {
                const state = stores[store.key] || {}
                const connected = !!state.connected
                const owned = state.owned_count ?? 0
                const matched = state.matched_count ?? 0
                return (
                  <li
                    key={store.key}
                    className="gt-ownership__store-row"
                    data-connected={connected ? '1' : '0'}
                  >
                    <span className="gt-ownership__store-label">{store.label}</span>
                    <span className="gt-ownership__store-state">
                      {connected ? 'connected' : 'not connected'}
                    </span>
                    <span className="gt-ownership__store-counts">
                      {owned} titles · {matched} matched
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="gt-ownership__card-note">
              {summary.has_steam_api_key
                ? 'Steam API key configured'
                : 'Steam: no API key — use CSV import'}
              {' · '}
              GOG / Epic / Amazon: live register when a token is saved — no store downloads
            </p>
          </article>
        ) : null}
      </div>

      {summary && enabled && !useNewChrome ? (
        <p className="gt-ownership__meta">
          Pick a store above to connect it or import a list.
        </p>
      ) : null}

      {summary && enabled && useNewChrome && !selectedStore ? (
        <p className="gt-ownership__hint">
          Choose a store in the bar above to link it or import a list.
        </p>
      ) : null}

      {summary && enabled
        ? (useNewChrome ? (selectedStore ? [selectedStore] : []) : STORES).map((store) => {
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
                  {store.tokenKind === 'password' ? (
                    <label>
                      {store.tokenLabel}
                      <input
                        type="password"
                        autoComplete="off"
                        value={tokenDrafts[store.key]}
                        placeholder={store.tokenPlaceholder}
                        onChange={(event) =>
                          setTokenDrafts((current) => ({
                            ...current,
                            [store.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  {store.tokenKind === 'textarea' ? (
                    <label>
                      {store.tokenLabel}
                      <textarea
                        rows={3}
                        autoComplete="off"
                        value={tokenDrafts[store.key]}
                        placeholder={store.tokenPlaceholder}
                        onChange={(event) =>
                          setTokenDrafts((current) => ({
                            ...current,
                            [store.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  {state.has_credential ? (
                    <p className="gt-ownership__meta">A live-sync token is saved for this store.</p>
                  ) : null}
                  <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={busy}>
                    {busyAction === `${store.key}:connect` ? 'Saving…' : store.saveLabel}
                  </button>
                </form>

                <div className="gt-ownership__actions">
                  {store.canSync ? (
                    <button type="button" className="gt-cbtn" disabled={busy} onClick={() => handleSync(store)}>
                      {busyAction === `${store.key}:sync`
                        ? `Syncing from ${store.label}…`
                        : `Sync from ${store.label}`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="gt-cbtn"
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
                  <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={busy}>
                    {busyAction === `${store.key}:csv` ? 'Importing…' : 'Import CSV'}
                  </button>
                </form>
              </section>
            )
          })
        : null}
    </div>
    </>
  )
}
