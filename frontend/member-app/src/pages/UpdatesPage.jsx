import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCalendar } from '../api/calendar'
import { ContextBar } from '../chrome/ContextBar'
import { RailIcon } from '../chrome/railIcons'
import { queueClientCommand } from '../api/clientCommands'
import {
  addWantedUpdate,
  fetchStoreSearch,
  fetchUpdatesInbox,
  scanLibraryUpdates,
} from '../api/updates'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import { showToast } from '../utils/toast'
import { PageStatus } from '../components/PageStatus'
import '../styles/panelGrid.css'

const INBOX_POLL_MS = 50000

const CALENDAR_TEASER_LIMIT = 5

export function UpdatesPage({ shellConfig = {} } = {}) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [statusByUuid, setStatusByUuid] = useState({})
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [calendarTeaser, setCalendarTeaser] = useState(null)
  // Library sweep, separate from the inbox refresh. Refresh re-reads what the
  // last probe found; this makes a new probe happen. Conflating them is what
  // left a member with no way to fill an empty inbox — see POST /api/updates/scan.
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const searchRequestId = useRef(0)
  const hasItemsRef = useRef(false)
  const inboxRequestRef = useRef({ id: 0, controller: null })

  const refreshInbox = useCallback((sourceMode = 'boot') => {
    const isManual = sourceMode === 'manual'
    const isBoot = sourceMode === 'boot' || sourceMode === 'retry'
    inboxRequestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = inboxRequestRef.current.id + 1
    inboxRequestRef.current = { id, controller }

    if (isManual) setManualRefreshing(true)
    if (isBoot) {
      setError(null)
      if (!hasItemsRef.current) setItems(null)
    }

    return fetchUpdatesInbox({ signal: controller.signal, limit: 100 })
      .then((data) => {
        if (inboxRequestRef.current.id !== id || controller.signal.aborted) return
        const next = Array.isArray(data.items) ? data.items : []
        setItems(next)
        setError(null)
        setLastUpdatedAt(new Date())
        hasItemsRef.current = true
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (inboxRequestRef.current.id !== id) return
        setError(err)
        if (isBoot && !hasItemsRef.current) setItems(null)
      })
      .finally(() => {
        if (inboxRequestRef.current.id === id && isManual) {
          setManualRefreshing(false)
        }
      })
  }, [])

  useEffect(() => {
    void refreshInbox(retryCount === 0 ? 'boot' : 'retry')
    return () => {
      inboxRequestRef.current.controller?.abort()
    }
  }, [retryCount, refreshInbox])

  useEffect(() => {
    let timer = 0

    function clearPoll() {
      if (timer) {
        window.clearInterval(timer)
        timer = 0
      }
    }

    function startPoll() {
      clearPoll()
      if (document.visibilityState === 'hidden') return
      timer = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return
        void refreshInbox('poll')
      }, INBOX_POLL_MS)
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void refreshInbox('poll')
        startPoll()
      } else {
        clearPoll()
      }
    }

    startPoll()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearPoll()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshInbox])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetchCalendar({
      signal: controller.signal,
      daysAhead: 45,
      daysBehind: 0,
      limit: CALENDAR_TEASER_LIMIT,
    })
      .then((data) => {
        if (!active) return
        const releases = Array.isArray(data.releases) ? data.releases : []
        setCalendarTeaser(releases.slice(0, CALENDAR_TEASER_LIMIT))
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setCalendarTeaser([])
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  async function handleSearch(event) {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      return
    }
    const requestId = ++searchRequestId.current
    setSearching(true)
    setSearchError(null)
    setHits(null)
    try {
      const data = await fetchStoreSearch({ q, source })
      if (requestId !== searchRequestId.current) {
        return
      }
      setHits(Array.isArray(data.results) ? data.results : [])
    } catch (err) {
      if (requestId !== searchRequestId.current) {
        return
      }
      setSearchError(err)
    } finally {
      if (requestId === searchRequestId.current) {
        setSearching(false)
      }
    }
  }

  async function applyPack(game, pack) {
    if (!pack?.uuid) {
      return
    }
    const key = `${game.uuid}:${pack.uuid}`
    setBusyKey(key)
    try {
      await queueClientCommand(game.uuid, 'update', {
        kind: pack.kind,
        versionUuid: pack.uuid,
      })
      setStatusByUuid((prev) => ({
        ...prev,
        [game.uuid]: `${pack.kind} queued for companion`,
      }))
      showToast(`${pack.label} queued for companion`, 'success')
    } catch (err) {
      setStatusByUuid((prev) => ({
        ...prev,
        [game.uuid]: err?.message || 'Failed to queue apply',
      }))
    } finally {
      setBusyKey(null)
    }
  }

  async function runLibraryScan() {
    if (scanning) return
    setScanning(true)
    setScanResult(null)
    try {
      const data = await scanLibraryUpdates({})
      setScanResult(data)
      const found = Number(data?.behind_count) || 0
      const checked = Number(data?.checked) || 0
      showToast(
        found > 0
          ? `Checked ${checked} title${checked === 1 ? '' : 's'} · ${found} behind`
          : `Checked ${checked} title${checked === 1 ? '' : 's'} · nothing behind`,
        found > 0 ? 'info' : 'success',
      )
      // The probe writes freshness rows; the inbox reads them. Without this the
      // member sees a toast saying titles are behind and a list that has not
      // changed.
      await refreshInbox('manual')
    } catch (err) {
      showToast(err?.message || 'Could not check for updates.', 'error')
    } finally {
      setScanning(false)
    }
  }

  // Either half of the round trip counts as busy: the probe and the inbox
  // re-read are one action from the member's side now.
  const busyRefreshing = manualRefreshing || scanning

  return (
    <>
    {useNewChrome ? (
        /* Refresh and its timestamp moved down to the inbox they describe
           (W28) — up here the time was in the bar's trail slot and the button
           was in its centre, so the readout and the control that produces it
           sat at opposite ends of the same row. */
        <ContextBar
          summary={
            items && items.length > 0
              ? `${items.length} behind`
              : items
                ? 'Nothing behind'
                : null
          }
        />
      ) : null}
    <div className="gt-more-page gt-updates gt-panels">
      {useNewChrome ? null : (
        <>
        <div className="gt-page-header gt-updates__header gt-panels__full">
          <div>
            <h1>Updates</h1>
            <p className="gt-more-page__lede">
              Library titles that look behind store versions. Download local Update/DLC packs from your
              library, or queue the companion to apply them. Store search is discovery-only (Steam / GOG
              links).
            </p>
          </div>
        </div>
        </>
      )}

      {/* The inbox leads, and takes the whole width.
          "Search stores" used to be the first thing on a page called Updates,
          which put a two-field discovery form above the list of titles you
          actually came to see — and in the two-column panel grid that form got
          exactly as much width as the list of rows. The inbox is the page: it
          is a table of titles, versions and actions, and it is the only thing
          here that benefits from width. Store search and the calendar teaser
          are both lookups, so they pair up underneath it. */}
      <section className="gt-updates__inbox gt-panels__wide">
        {/* The refresh control sits on the heading of the thing it refreshes.
            In bar two it was a word ("Refresh") a long way from the list it
            acted on, and nothing said *what* it would refresh. As a symbol on
            the inbox rule it is unambiguous and costs no width. The label lives
            in the hover tooltip rather than on the button. */}
        <div className="gt-updates__section-head">
          <h2>Library freshness inbox</h2>
          <div className="gt-updates__inbox-tools">
            {/* Time first, then the glyph: the timestamp is what the button
                changes, so it reads left-to-right as "this is how old it is,
                here is how to fix that". */}
            {busyRefreshing ? (
              <span className="gt-updates__refresh-status" role="status" aria-live="polite">
                {scanning ? 'Checking library…' : 'Refreshing…'}
              </span>
            ) : lastUpdatedAt ? (
              <span className="gt-updates__refresh-status gt-updates__refresh-status--muted">
                Updated {lastUpdatedAt.toLocaleTimeString()}
              </span>
            ) : null}
            {/* One refresh control, not two.
                This row used to carry a glyph that re-read the stored inbox and
                a full-width button that ran a fresh probe — two controls that
                both read as "refresh this list", sitting on the same rule, one
                of which silently did less than the other. Nobody could be
                expected to know which one they wanted.

                They collapse into the glyph, wired to the probe, because the
                probe was already the superset: `runLibraryScan` re-reads the
                inbox itself once it finishes writing the freshness rows (see
                the call at the end of it). So the surviving control does
                everything the deleted one did and more, and "refresh" means one
                thing on this page again. */}
            <span className="gt-tip">
              <button
                type="button"
                className="gt-iconbtn gt-updates__refresh-btn"
                aria-label="Check the library against store versions"
                aria-busy={busyRefreshing ? 'true' : undefined}
                disabled={busyRefreshing}
                onClick={() => void runLibraryScan()}
              >
                <RailIcon name="updates" size={16} />
              </button>
              <span className="gt-tip__bubble" role="tooltip">
                {busyRefreshing
                  ? 'Checking your library against store versions…'
                  : 'Check your library against store versions. Runs on its own periodically; this asks now.'}
              </span>
            </span>
          </div>
        </div>
        {scanResult ? (
          <p className="gt-updates__scan-result" role="status">
            Checked {scanResult.checked} title
            {scanResult.checked === 1 ? '' : 's'} ·{' '}
            {scanResult.behind_count > 0
              ? `${scanResult.behind_count} behind`
              : 'nothing behind'}
            {scanResult.remaining > 0
              ? ` · ${scanResult.remaining} still to check — press again to continue`
              : ' · whole library checked'}
            {scanResult.errors?.length
              ? ` · ${scanResult.errors.length} could not be checked`
              : ''}
          </p>
        ) : null}
        <PageStatus
          loading={!error && !items}
          error={error}
          errorMessage="Unable to load updates."
          loadingMessage="Checking for updates…"
          onRetry={() => setRetryCount((n) => n + 1)}
        />

        {!error && items && items.length === 0 ? (
          <p>No outdated titles detected. Nice.</p>
        ) : null}

        {!error && items && items.length > 0 ? (
          <ul className="gt-updates__list gt-updates__inbox-list">
            {items.map((game) => {
              const pack = game.latest_update || game.latest_extra
              const applyKey = pack ? `${game.uuid}:${pack.uuid}` : null
              return (
                <li key={game.uuid} className="gt-updates__inbox-item">
                  <div className="gt-updates__inbox-main">
                    <Link to={`/game_details/${game.uuid}`}>
                      <strong>{game.name}</strong>
                    </Link>
                    <span>
                      {[
                        game.freshness_status,
                        `${game.local_version || 'local?'} → ${game.remote_version_summary || 'store?'}`,
                        game.updates_count
                          ? `${game.updates_count} local update${game.updates_count === 1 ? '' : 's'}`
                          : null,
                        game.dlc?.missing_count != null
                          ? `DLC gap ${game.dlc.missing_count}`
                          : game.dlc?.store_count != null
                            ? `Store DLC ${game.dlc.store_count}`
                            : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {statusByUuid[game.uuid] ? (
                      <span className="gt-updates__status" role="status">
                        {statusByUuid[game.uuid]}
                      </span>
                    ) : null}
                  </div>
                  <div className="gt-updates__inbox-actions">
                    {pack?.download_url ? (
                      <a className="gt-btn" href={pack.download_url}>
                        Download {pack.kind}
                      </a>
                    ) : null}
                    {pack && game.client_connected ? (
                      <button
                        type="button"
                        className="gt-btn"
                        disabled={busyKey === applyKey}
                        onClick={() => {
                          void applyPack(game, pack)
                        }}
                      >
                        {busyKey === applyKey ? 'Queuing…' : 'Apply with companion'}
                      </button>
                    ) : null}
                    <Link className="gt-btn" to={`/game_details/${game.uuid}`}>
                      Details
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <section className="gt-updates__search">
        <div className="gt-updates__section-head">
          <h2>Search stores</h2>
        </div>
        <form className="gt-updates__search-form" onSubmit={handleSearch}>
          <label>
            Game name
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Hades II"
              required
            />
          </label>
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">Steam + GOG</option>
              <option value="steam">Steam</option>
              <option value="gog">GOG</option>
            </select>
          </label>
          <button className="gt-btn" type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchError ? (
          <PageStatus
            error={searchError}
            errorMessage={`Store search failed: ${String(searchError.message || searchError)}`}
          />
        ) : null}
        {hits && hits.length === 0 ? <p>No store hits.</p> : null}
        {hits && hits.length > 0 ? (
          <ul className="gt-updates__list">
            {hits.map((hit, index) => (
              <li key={`${hit.source}-${hit.steam_app_id || hit.gog_id || hit.url || index}`}>
                <div className="gt-updates__inbox-item">
                  <div className="gt-updates__inbox-main">
                    {hit.url ? (
                      <a href={hit.url} target="_blank" rel="noreferrer">
                        <strong>{hit.name}</strong>
                        <span>{hit.source}</span>
                      </a>
                    ) : (
                      <>
                        <strong>{hit.name}</strong>
                        <span>{hit.source}</span>
                      </>
                    )}
                    {hit.matched_game_uuid ? (
                      <span>
                        Matched library:{' '}
                        <Link to={`/game_details/${hit.matched_game_uuid}`}>
                          {hit.matched_game_name || 'Open'}
                        </Link>
                      </span>
                    ) : (
                      <span>No library match</span>
                    )}
                  </div>
                  <div className="gt-updates__inbox-actions">
                    {hit.matched_game_uuid ? (
                      <button
                        type="button"
                        className="gt-btn"
                        onClick={() => {
                          void addWantedUpdate({
                            game_uuid: hit.matched_game_uuid,
                            kind: 'update',
                            label: hit.name,
                            store: hit.source,
                            store_id: String(hit.steam_app_id || hit.gog_id || ''),
                          })
                            .then(() => {
                              showToast('Added to wanted updates', 'success')
                            })
                            .catch((err) => {
                              showToast(err?.message || 'Wanted failed', 'error')
                            })
                        }}
                      >
                        Want pack
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="gt-updates__calendar" aria-labelledby="updates-calendar-heading">
        {/* Same head as Search stores and the inbox — it was the one section
            with its own heading markup, so its title sat on a different
            baseline and its link on a different line from the controls the
            other two put there. */}
        <div className="gt-updates__section-head">
          <h2 id="updates-calendar-heading">Upcoming releases</h2>
          <Link className="gt-updates__calendar-link" to="/calendar">
            Open calendar
          </Link>
        </div>
        {calendarTeaser === null ? <p className="gt-updates__calendar-empty">Loading releases…</p> : null}
        {calendarTeaser && calendarTeaser.length === 0 ? (
          <p className="gt-updates__calendar-empty">
            No upcoming releases in the next window.{' '}
            <Link to="/calendar">Browse the full calendar</Link>
          </p>
        ) : null}
        {calendarTeaser && calendarTeaser.length > 0 ? (
          <ul className="gt-updates__calendar-list">
            {calendarTeaser.map((item, index) => (
              <li key={`${item.igdb_id || item.slug || item.name}-${item.first_release_date || index}`}>
                <time dateTime={item.first_release_date || undefined}>
                  {formatLocaleDate(item.first_release_date, { fallback: 'TBA' })}
                </time>
                <span>{item.name || 'Untitled'}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
    </>
  )
}
