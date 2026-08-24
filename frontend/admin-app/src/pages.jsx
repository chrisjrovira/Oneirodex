import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { csrfHeaders } from './adminApi'
import { DataTable } from './DataTable'
import { DupeGlance } from './DupeGlance'
import { HUB_LINKS, INTEGRATION_CARDS, SETTINGS_GROUPS } from './navConfig'
import { OpenPathModal } from './OpenPathModal'
import { ImportLeafLibraries } from './ImportLeafLibraries'
import { ProposeLeafLibraries } from './ProposeLeafLibraries'
import { ScanConflictModal } from './ScanConflictModal'
import {
  hasActiveScan,
  isScanBusyStatus,
  isScanQueuedStatus,
  isScanRunning,
  normalizeScanJobsList,
} from './scanQueuePolicy'
import { useLibraryRefreshAll } from './useLibraryRefreshAll'
import { useLibraryScan } from './useLibraryScan'
import { showToast } from './utils/toast'
import {
  MeterBar,
  MetricTile,
  OpsStatusBanner,
  companionKindRows,
  companionsTone,
  dbPingTone,
  formatBytes,
  formatLibraryHealthHint,
  formatLibraryHealthValue,
  formatLoadAvg,
  formatReadyz,
  libraryHealthTone,
  na,
  percentHealthTone,
  readyzTone,
  scansActiveTone,
} from './opsWidgets'

async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin' })
  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('unauthorized')
  }
  if (!response.ok) {
    throw new Error(`${url} ${response.status}`)
  }
  return response.json()
}

/**
 * Dashboard glance tables (UX-C8 · W27-C1). Hand-rolled `gt-ops-table` blocks
 * until now, which is why the dashboard's tables did not match the rest of
 * admin. `toolbar={false}` for the same reason as the Ops panels: these row
 * sets are capped at a handful, and a filter box over four errors is chrome
 * standing in front of the thing you came to read.
 */
const DASHBOARD_COMPANION_COLUMNS = [
  { key: 'kind', label: 'Kind' },
  { key: 'online', label: 'Online', align: 'right' },
  { key: 'registered', label: 'Registered', align: 'right' },
]

const DASHBOARD_ERROR_COLUMNS = [
  { key: 'event_type', label: 'Type', render: (event) => <code>{event.event_type}</code> },
  { key: 'text', label: 'Message' },
]

function Page({ title, lede, children }) {
  return (
    <div className="gt-admin-page">
      <h1>{title}</h1>
      {lede ? <p className="gt-admin-lede">{lede}</p> : null}
      {children}
    </div>
  )
}

/* LinkRow removed (GT-B7).
 *
 * It rendered a section's HUB_LINKS as a row of buttons on the page. The rail
 * now lists exactly those destinations whenever the section is active, so the
 * row was a duplicate nav that also made every admin page open with a wall of
 * buttons before its actual content.
 *
 * Note this is *not* the same as `.gt-admin-actions-row` generally — that class
 * is still used for real page actions (save, apply, submit) across ArtStudio,
 * QualityProfiles, Users and others, and those must stay.
 */

export function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [manualRefreshing, setManualRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const requestRef = useRef({ id: 0, controller: null })
  const hasSummaryRef = useRef(false)

  const refresh = useCallback((source = 'poll') => {
    const isManual = source === 'manual'
    const isBoot = source === 'boot'
    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = requestRef.current.id + 1
    requestRef.current = { id, controller }
    if (isManual) setManualRefreshing(true)
    getJson('/admin/api/ops/summary')
      .then((data) => {
        if (requestRef.current.id !== id || controller.signal.aborted) return
        setSummary(data)
        setError(null)
        setLastUpdatedAt(new Date())
        hasSummaryRef.current = true
        if (isBoot) setBootLoading(false)
        if (isManual) setManualRefreshing(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (requestRef.current.id !== id) return
        setError(err)
        if (isBoot || !hasSummaryRef.current) setBootLoading(false)
        if (isManual) setManualRefreshing(false)
      })
  }, [])

  useEffect(() => {
    refresh('boot')
    const timer = window.setInterval(() => refresh('poll'), 15000)
    return () => {
      window.clearInterval(timer)
      requestRef.current.controller?.abort()
    }
  }, [refresh])

  const library = summary?.library
  const scans = summary?.scans
  const host = summary?.host
  const services = summary?.services
  const issues = summary?.issues
  const disk = host?.disk_games || host?.disk_base
  const severity = issues?.overall || 'good'
  const companions = services?.companions
  const kindRows = companionKindRows(companions?.by_kind)

  const unmatched = library?.unmatched_folders
  const gamesTone =
    unmatched == null
      ? library?.games != null
        ? 'good'
        : 'na'
      : Number(unmatched) > 0
        ? 'warning'
        : 'good'

  return (
    <Page title="Dashboard" lede="Observability glance — libraries, host pulse, and open issues (~15s).">
      {error ? (
        <div role="alert" className="gt-admin-alert">
          Unable to load ops summary. Open System for details.
        </div>
      ) : null}

      {bootLoading && !summary ? (
        <p className="gt-admin-lede" role="status">
          Loading dashboard…
        </p>
      ) : null}

      <OpsStatusBanner
        severity={severity}
        asOf={summary?.as_of}
        items={issues?.items}
        ariaLabel="Health"
      />

      <div className="gt-ops-strip" aria-label="Key metrics">
        <MetricTile
          label="Libraries"
          value={na(library?.libraries)}
          hint="folders"
          tone={library?.libraries != null ? 'info' : 'na'}
        />
        <MetricTile
          label="Games"
          value={na(library?.games)}
          hint={
            library?.unmatched_folders != null
              ? `${library.unmatched_folders} unmatched`
              : 'catalogue'
          }
          tone={gamesTone}
        />
        <MetricTile
          label="Library health"
          value={formatLibraryHealthValue(library?.health)}
          hint={formatLibraryHealthHint(library?.health)}
          tone={libraryHealthTone(library?.health)}
        />
        <MetricTile
          label="Scans"
          value={na(scans?.active_count)}
          hint={
            (scans?.jobs || [])[0]
              ? `${scans.jobs[0].library || 'job'} · ${scans.jobs[0].progress}%`
              : 'active'
          }
          tone={scansActiveTone(scans?.active_count)}
        />
        <MetricTile
          label="Disk"
          value={disk?.percent != null ? `${disk.percent}%` : 'n/a'}
          hint="games volume"
          tone={percentHealthTone(disk?.percent)}
        />
        <MetricTile
          label="Load 1/5/15"
          value={formatLoadAvg(host?.load_avg)}
          tone={host?.load_avg ? 'info' : 'na'}
        />
        <MetricTile
          label="Process RSS"
          value={formatBytes(host?.process?.rss_bytes)}
          hint={host?.process?.pid != null ? `pid ${host.process.pid}` : 'n/a'}
          tone={host?.process?.rss_bytes != null ? 'info' : 'na'}
        />
        <MetricTile
          label="DB ping"
          value={host?.db_ping_ms != null ? `${host.db_ping_ms} ms` : 'n/a'}
          tone={dbPingTone(host?.db_ping_ms)}
        />
        <MetricTile
          label="Readyz"
          value={formatReadyz(services?.readyz)}
          tone={readyzTone(services?.readyz)}
        />
        <MetricTile
          label="Companions"
          value={`${companions?.online ?? 0} / ${companions?.registered ?? 0}`}
          hint={
            kindRows.length
              ? kindRows.map((r) => `${r.kind} ${r.online}/${r.registered}`).join(' · ')
              : 'by kind n/a'
          }
          tone={companionsTone(companions)}
        />
      </div>

      <div className="gt-ops-console">
        <section className="gt-ops-panel">
          <h2>Host meters</h2>
          {!host ? (
            <p className="gt-admin-lede">Host data unavailable.</p>
          ) : (
            <div className="gt-ops-meters">
              <MeterBar label="CPU" percent={host.cpu?.percent} />
              <MeterBar
                label="Memory"
                percent={host.memory?.percent}
                detail={
                  host.memory
                    ? `${formatBytes(host.memory.used)} / ${formatBytes(host.memory.total)}`
                    : null
                }
              />
              <MeterBar label="Games disk" percent={disk?.percent} />
            </div>
          )}
        </section>

        <section className="gt-ops-panel">
          <h2>Companions by kind</h2>
          {kindRows.length === 0 ? (
            <p className="gt-admin-lede">
              {companions
                ? `Online ${companions.online ?? 0} / ${companions.registered ?? 0} · last seen 1h ${companions.last_seen?.within_1h ?? 0}`
                : 'n/a'}
            </p>
          ) : (
            <DataTable
              columns={DASHBOARD_COMPANION_COLUMNS}
              rows={kindRows}
              getRowKey={(row) => row.kind}
              toolbar={false}
            />
          )}
        </section>

        {(summary?.recent_errors || []).length > 0 ? (
          <section className="gt-ops-panel gt-ops-panel--wide">
            <h2>Recent errors</h2>
            <DataTable
              columns={DASHBOARD_ERROR_COLUMNS}
              rows={summary.recent_errors.slice(0, 4)}
              getRowKey={(event) => event.id}
              toolbar={false}
            />
          </section>
        ) : null}
      </div>

      <div className="gt-admin-dashboard-footer">
        {/* The footer's five destination buttons are gone (GT-B7) — Ops, Scans,
            Libraries, Settings and Support are all rail entries, and repeating
            them under the dashboard was the duplicate nav. The refresh status
            stays: it is about *this* page, not about where to go next. */}
        <div className="gt-ops-refresh gt-ops-refresh--footer">
          {manualRefreshing ? (
            <span className="gt-ops-refresh__status" role="status" aria-live="polite">
              Refreshing…
            </span>
          ) : lastUpdatedAt ? (
            <span className="gt-ops-refresh__status gt-ops-refresh__status--muted">
              Updated {lastUpdatedAt.toLocaleTimeString()}
            </span>
          ) : null}
          <button
            type="button"
            className="gt-btn gt-btn--accent"
            onClick={() => refresh('manual')}
            disabled={manualRefreshing || bootLoading}
          >
            {manualRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
    </Page>
  )
}

export function LibrariesPage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const {
    conflictOpen,
    refreshing,
    startRefreshAll,
    onConflictChoose,
    onConflictClose,
  } = useLibraryRefreshAll()
  const {
    conflictOpen: scanConflictOpen,
    busyKey: scanBusyKey,
    startScan,
    onConflictChoose: onScanConflictChoose,
    onConflictClose: onScanConflictClose,
  } = useLibraryScan()

  useEffect(() => {
    getJson('/api/get_libraries')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(setError)
  }, [])

  return (
    <Page title="Libraries & scans" lede="Manage library folders and platforms. Classic Jinja surfaces share the same Libraries / Auto / Manual / Unmatched tabs.">
      {error ? <div role="alert">Unable to load libraries.</div> : null}
      <p className="gt-admin-lede">
        Prefer the unified classic page:{' '}
        <a href="/scan_management?active_tab=libraries">Libraries &amp; scans</a>
        {' · '}
        Library hero image:{' '}
        <a href="/admin/art_studio#stock">Choose image from Backup &amp; stock</a>
        {' · '}
        <a href="/libraries">Full library forms</a>
        {' · '}
        <a href="#propose-leaf">Propose leaf libraries</a>
        {' · '}
        <a href="#import-leaf">Import CSV/JSON</a>
      </p>
      <div className="gt-admin-panel">
        <div className="gt-admin-panel__toolbar" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="gt-btn gt-btn--accent"
            onClick={() => void startRefreshAll()}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh all libraries'}
          </button>
          <p className="gt-admin-lede" style={{ margin: '0.35rem 0 0' }}>
            Re-scans each library’s last scan folder. When a scan is already running, choose{' '}
            <strong>Queue</strong> (default) or <strong>Force run now</strong>.
          </p>
        </div>
        {!rows ? (
          <p>Loading…</p>
        ) : (
          // Loading and empty are different states, so only the first stays a
          // bare paragraph: DataTable owns "no rows" itself, and routing it
          // through emptyMessage keeps the toolbar and frame in place instead
          // of collapsing the table to a sentence.
          <DataTable
            rows={rows}
            getRowKey={(lib) => lib.uuid}
            emptyMessage="No libraries yet. Add one to start scanning."
            initialSort={{ key: 'name', dir: 'asc' }}
            dense
            columns={[
              { key: 'name', label: 'Name' },
              {
                key: 'uuid',
                label: 'UUID',
                render: (lib) => <code>{lib.uuid}</code>,
              },
              {
                key: 'last_scan_folder',
                label: 'Last scan folder',
                value: (lib) => lib.last_scan_folder || '',
                render: (lib) =>
                  lib.last_scan_folder ? <code>{lib.last_scan_folder}</code> : '—',
              },
              {
                // Scanning one library is the thing this page is for, and it
                // was only reachable from the Jinja surface. Same endpoint and
                // same Queue / Force conflict handling as Refresh all.
                key: 'scan',
                label: 'Scan',
                sortable: false,
                render: (lib) => (
                  <button
                    type="button"
                    className="gt-btn gt-btn--sm"
                    disabled={scanBusyKey === lib.uuid || !lib.last_scan_folder}
                    title={
                      lib.last_scan_folder
                        ? `Re-scan ${lib.last_scan_folder}`
                        : 'No last scan folder — run one Auto Scan from Libraries & scans first.'
                    }
                    onClick={() =>
                      void startScan({
                        key: lib.uuid,
                        libraryUuid: lib.uuid,
                        label: lib.name,
                      })
                    }
                  >
                    {scanBusyKey === lib.uuid ? 'Starting…' : 'Scan'}
                  </button>
                ),
              },
            ]}
          />
        )}
      </div>
      <div id="propose-leaf">
        <ProposeLeafLibraries />
      </div>
      <div id="import-leaf">
        <ImportLeafLibraries />
      </div>
      <ScanConflictModal
        open={conflictOpen}
        busy={refreshing}
        onChoose={onConflictChoose}
        onClose={onConflictClose}
      />
      {/* A second instance rather than one shared modal: the two buttons post
          to different endpoints with different bodies, and the choice the
          operator makes has to go back to the request that was refused. */}
      <ScanConflictModal
        open={scanConflictOpen}
        busy={Boolean(scanBusyKey)}
        onChoose={onScanConflictChoose}
        onClose={onScanConflictClose}
      />
    </Page>
  )
}

function ModuleBadge({ status }) {
  if (!status) return null
  const on = Boolean(status.on)
  return (
    <span
      className={`settings-shell-badge settings-shell-badge--${on ? 'on' : 'off'}`}
      data-testid="settings-module-badge"
    >
      {status.label || (on ? 'On' : 'Off')}
      {status.detail ? ` · ${status.detail}` : ''}
    </span>
  )
}

export function SettingsPage() {
  // Grouped rows, not a card grid (UX-C9): cards forced every module to the
  // same visual weight and spread a short list over a lot of empty space.
  //
  // The on/off badges are the Jinja hub's, restored: the template rendered them
  // from a `module_status` variable, and when the body moved to React the
  // variable kept being computed with nothing left to read it.
  const [moduleStatus, setModuleStatus] = useState(null)

  useEffect(() => {
    getJson('/api/settings/module-status')
      .then((data) => setModuleStatus(data && typeof data === 'object' ? data : null))
      // A failed badge fetch must not blank the hub — the links are the page.
      .catch(() => setModuleStatus(null))
  }, [])

  return (
    <Page title="Settings" lede="Server modules, matching policy, presentation, and extensions.">
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.id} className="gt-admin-panel gt-settings-group">
          <h2 className="gt-admin-panel-title">{group.title}</h2>
          <ul className="gt-settings-list">
            {group.items.map((item) => (
              <li key={item.to}>
                <a className="gt-settings-row" href={item.to}>
                  <span className="gt-settings-row__title">
                    {item.title}
                    {item.statusKey ? <ModuleBadge status={moduleStatus?.[item.statusKey]} /> : null}
                  </span>
                  <span className="gt-settings-row__blurb">{item.blurb}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  )
}

export function HubPage({ title, lede }) {
  return (
    <Page title={title} lede={lede}>
      <div className="gt-admin-panel">
        <p>
          This admin surface runs in the React shell. Use the actions above for the full workflow.
          Form POSTs still hit the existing Flask endpoints.
        </p>
      </div>
    </Page>
  )
}

const INVENTORY_CATEGORY_ORDER = [
  'metadata',
  'artwork',
  'email',
  'auth',
  'support',
  'social',
  'rtc',
  'acquire',
  'ownership',
]

const INVENTORY_CATEGORY_LABELS = {
  metadata: 'Metadata',
  artwork: 'Artwork',
  email: 'Email',
  auth: 'Auth / SSO',
  support: 'Support',
  social: 'Social',
  rtc: 'Voice / RTC',
  acquire: 'Acquire',
  ownership: 'Ownership',
}

function groupInventoryByCategory(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.category || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const ordered = INVENTORY_CATEGORY_ORDER.filter((id) => groups.has(id)).map((id) => ({
    id,
    label: INVENTORY_CATEGORY_LABELS[id] || id,
    rows: groups.get(id),
  }))
  for (const [id, groupRows] of groups) {
    if (!INVENTORY_CATEGORY_ORDER.includes(id)) {
      ordered.push({ id, label: INVENTORY_CATEGORY_LABELS[id] || id, rows: groupRows })
    }
  }
  return ordered
}

function inventoryHref(row) {
  return row.settings_href || row.admin_href || '/admin/integrations'
}

export function IntegrationsPage() {
  const [inventory, setInventory] = useState(null)
  const [inventoryError, setInventoryError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getJson('/api/admin/integrations/inventory')
      .then((data) => {
        if (!controller.signal.aborted) {
          setInventory(Array.isArray(data?.integrations) ? data.integrations : [])
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setInventoryError(true)
        }
      })
    return () => controller.abort()
  }, [])

  const inventoryGroups = inventory ? groupInventoryByCategory(inventory) : []

  return (
    <Page
      title="Integrations"
      lede="All providers in one place — metadata, artwork, mail, SSO, voice, acquire, ownership, and export packs. Classic Jinja forms stay behind these deep links."
    >
      {/* Rows, not a card grid (UX-C11): providers carry wildly different link
          counts, so an even grid left tall gaps beside the short ones. Same
          dense treatment as Settings / Libraries. */}
      <div className="gt-admin-panel gt-provider-list">
        {INTEGRATION_CARDS.map((card) => (
          // id={card.id} is the anchor the nav actually links to. Every
          // `/admin/integrations#<id>` link in navConfig was dead because the
          // only id on the page was the heading's `int-<id>`, which nothing
          // links to — so all nine deep links landed at the top of the page
          // and looked like they did nothing (W27-A8). The heading keeps its
          // prefixed id for aria-labelledby, which needs to stay unique.
          <section
            key={card.id}
            id={card.id}
            className="gt-provider-row"
            aria-labelledby={`int-${card.id}`}
          >
            <div className="gt-provider-row__head">
              <h2 id={`int-${card.id}`} className="gt-provider-row__title">
                <a href={card.href}>{card.title}</a>
              </h2>
              <p className="gt-provider-row__blurb">{card.blurb}</p>
            </div>
            <ul className="gt-provider-row__links">
              {(card.links || []).map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {!inventory && !inventoryError ? (
        <div className="gt-admin-panel gt-admin-inventory" style={{ marginTop: '1rem' }}>
          <p>Loading provider inventory…</p>
        </div>
      ) : null}

      {inventory && inventory.length > 0 ? (
        <div className="gt-admin-panel gt-admin-inventory" style={{ marginTop: '1rem' }}>
          <h2>Provider inventory</h2>
          <p>
            Live status from <code>GET /api/admin/integrations/inventory</code> — every provider
            with a deep link (not IGDB-only).
          </p>
          {inventoryGroups.map((group) => (
            <div key={group.id} className="gt-admin-inventory__group">
              <h3 className="gt-admin-inventory__category">{group.label}</h3>
              <ul className="gt-admin-inventory__list" aria-label={`${group.label} integrations`}>
                {group.rows.map((row) => (
                  <li key={row.id || row.name}>
                    <a href={inventoryHref(row)}>{row.name}</a>
                    {' — '}
                    <span className="gt-admin-inventory__status">
                      {row.status || (row.configured ? 'configured' : 'available')}
                    </span>
                    {row.notes ? (
                      <span className="gt-admin-inventory__notes"> · {row.notes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {inventory && inventory.length === 0 && !inventoryError ? (
        <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
          <p>Provider inventory returned no rows — use the cards above.</p>
        </div>
      ) : null}

      {inventoryError ? (
        <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
          <p>Provider inventory unavailable — use the cards above.</p>
        </div>
      ) : null}

      <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
        <p>
          Full Integrations tabs (SMTP · IGDB · community · artwork · ownership · OIDC · indexers)
          still render when Jinja content is present. This React hub is the fallback chrome when the
          classic body is empty. Member Systems also lists export packs under a secondary{' '}
          <strong>Export packs</strong> section (not buried in the page intro).
        </p>
      </div>
    </Page>
  )
}

export function ThemesPage() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function resetThemes() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/admin/themes/reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
      })
      // Reset Themes is the action operators are told to run after every theme
      // CSS change, and it gave no feedback outside a small inline line.
      const ok = response.ok
      // No hard-refresh step: `theme_asset` versions each URL by mtime+size and
      // a reset clears the memo, so replaced bytes come back on a normal reload.
      // See docs/admin/themes-reset.md.
      setMessage(ok ? 'Default themes reset. Reload to see them.' : 'Reset failed.')
      showToast(
        ok ? 'Default themes reset — reload to pick them up.' : 'Theme reset failed.',
        ok ? 'success' : 'error',
      )
    } catch {
      setMessage('Reset failed.')
      showToast('Theme reset failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Themes" lede="Apply presets from the volume; reset when tokens change after deploy.">
      <div className="gt-admin-actions-row">
        <button type="button" className="gt-btn" disabled={busy} onClick={resetThemes}>
          Reset Default Themes
        </button>
        <a className="gt-btn" href="/admin/themes/readme">
          Theme authoring readme
        </a>
      </div>
      {message ? <p>{message}</p> : null}
      <div className="gt-admin-panel">
        <p>
          After Unraid <code>build --no-cache</code>, run Reset Default Themes once so{' '}
          <code>gt-tokens.css</code> (green accent, glass) syncs onto the library volume.
        </p>
      </div>
    </Page>
  )
}

export function HelpPage() {
  return (
    <Page title="Admin help" lede="Ops chrome is a React top bar — no member left nav.">
      <ul>
        <li>
          Dashboard and Ops are an observability console (~15s poll) from{' '}
          <code>/admin/api/ops/summary</code> — status strip, meters, issues list, services/scans tables.
        </li>
        <li>Libraries list comes from <code>/api/get_libraries</code>.</li>
        <li>Settings cards open module pages (Arr, AI, Themes, Storage, …).</li>
        <li>
          Wave 7–11 flags: <code>ENABLE_ARR_MODULE</code>, <code>ENABLE_DEBRID</code>,{' '}
          <code>ENABLE_GAME_ASSISTS</code>, <code>ENABLE_MOD_TRACKING</code>,{' '}
          <code>ENABLE_ACTIVITY_FEED</code>, <code>ENABLE_PCDOS_BROWSER</code> (on by default; needs vendored dosbox WASM).
        </li>
        <li>
          Integrations hub lists every provider via{' '}
          <code>GET /api/admin/integrations/inventory</code> (metadata · artwork · mail · SSO ·
          voice · acquire · ownership) — not IGDB-only. Cards deep-link classic forms.
        </li>
        <li>
          Export packs (ES-DE <code>gamelist.xml</code> · Pegasus metadata): Admin → Integrations →{' '}
          <strong>Export packs</strong>, or member Systems secondary section. Endpoints:{' '}
          <code>/api/export/esde</code>, <code>/api/export/pegasus</code>. Paths stay portable.
        </li>
        <li>
          Plugins registry: <code>GET /api/plugins</code>. Emulator health:{' '}
          <code>/api/emulator/health</code>.
        </li>
        <li>
          Emulator: BIOS + <code>.cht</code> via <code>/api/emulator/*</code>; WebRetro play bar
          for cloud save and cheats; companion RetroArch profiles for heavy systems.
        </li>
        <li>Themes: Reset Default Themes after image rebuilds that change design tokens.</li>
        <li>
          Art studio (<code>/admin/art_studio</code>): placeholders + <strong>Pick &amp; queue</strong>{' '}
          (<code>#images</code>) for SteamGridDB/IGDB search, mass downloads, and auto-pick via{' '}
          <code>/admin/api/covers/batch/apply</code>.
        </li>
        <li>Member Systems hub lives at <code>/systems</code> with platform skins.</li>
      </ul>
    </Page>
  )
}

export function PluginsPage() {
  const [plugins, setPlugins] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getJson('/api/plugins')
      .then((data) => setPlugins(data.plugins || []))
      .catch(setError)
  }, [])

  return (
    <Page title="Plugins & connectors" lede="Built-in registry of metadata, acquire, emu, and export hooks.">
      {error ? <div role="alert">Unable to load plugins.</div> : null}
      <div className="gt-admin-panel">
        {!plugins ? (
          <p>Loading…</p>
        ) : (
          // Category and status are exactly what someone comes here to group
          // by, so this is the table that most wanted sorting and had none.
          <DataTable
            rows={plugins}
            getRowKey={(plugin) => plugin.id}
            emptyMessage="No plugins registered."
            initialSort={{ key: 'category', dir: 'asc' }}
            dense
            columns={[
              {
                key: 'id',
                label: 'ID',
                render: (plugin) => <code>{plugin.id}</code>,
              },
              { key: 'name', label: 'Name' },
              { key: 'category', label: 'Category' },
              { key: 'status', label: 'Status' },
            ]}
          />
        )}
      </div>
    </Page>
  )
}

export function ScansPage() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [pathModal, setPathModal] = useState(null)
  const {
    conflictOpen,
    refreshing,
    startRefreshAll,
    onConflictChoose,
    onConflictClose,
  } = useLibraryRefreshAll()
  const {
    conflictOpen: scanConflictOpen,
    busyKey: scanBusyKey,
    startScan,
    onConflictChoose: onScanConflictChoose,
    onConflictClose: onScanConflictClose,
  } = useLibraryScan()

  useEffect(() => {
    let cancelled = false
    const load = () => {
      getJson('/api/scan_jobs_status')
        .then((data) => {
          if (cancelled) return
          setStatus(data)
          setError(null)
          setUpdatedAt(new Date())
        })
        .catch((err) => {
          if (!cancelled) setError(err)
        })
    }
    load()
    const timer = window.setInterval(load, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const jobs = normalizeScanJobsList(status)
  // A bare `running` flag with no jobs behind it is a phantom scan (GT-B13).
  const running = isScanRunning(status)
  const queuedJobs = jobs.filter((job) => isScanQueuedStatus(job?.status))
  const recentJobs = jobs.slice(0, 12)
  const progress = status?.progress ?? status?.percent ?? null
  const message = status?.message || status?.status_message || status?.phase || null
  const scanMotifActive = running || queuedJobs.length > 0

  return (
    <Page title="Libraries & scans" lede="Scan jobs, identify workbench, and image queue. Start / queue / force from Scan jobs (Jinja Libraries & scans) or Refresh all here.">
      {error ? <div role="alert">Unable to load scan status.</div> : null}
      <div className="gt-admin-panel">
        <div className="gt-admin-panel__toolbar" style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="gt-btn gt-btn--accent"
            onClick={() => void startRefreshAll()}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh all libraries'}
          </button>
          {scanMotifActive ? (
            <span className="gt-admin-scan-live" role="status" aria-live="polite" data-state={running ? 'running' : 'queued'}>
              <span className="gt-spinner gt-spinner--sm" aria-hidden="true" />
              {running ? 'Scanning…' : `Queued… (${queuedJobs.length})`}
            </span>
          ) : null}
        </div>
        {!status ? (
          <p>Loading…</p>
        ) : (
          <>
            <p>
              Running: {running ? 'yes' : 'no'}
              {queuedJobs.length ? <> · queued {queuedJobs.length}</> : null}
              {status.job_id ? (
                <>
                  {' '}
                  · job <code>{status.job_id}</code>
                </>
              ) : null}
              {progress != null ? <> · progress {String(progress)}</> : null}
            </p>
            {message ? <p className="gt-admin-lede">{message}</p> : null}
            {/* Scan jobs sort and filter like every other table now (W27-C2).
                Each column declares `value` where what it renders is not what
                it should sort on: Job renders a truncated code element, and
                Status renders a queue position alongside the word — sorting on
                the rendered markup would order by the wrong thing entirely. */}
            <DataTable
              rows={recentJobs}
              getRowKey={(job) => job.id}
              emptyMessage="No scan jobs yet."
              initialSort={{ key: 'status', dir: 'asc' }}
              dense
              columns={[
                {
                  key: 'id',
                  label: 'Job',
                  value: (job) => String(job.id),
                  render: (job) => <code>{String(job.id).slice(0, 8)}</code>,
                },
                {
                  key: 'library',
                  label: 'Library',
                  value: (job) => job.library_name || job.library || '',
                  render: (job) => job.library_name || job.library || '—',
                },
                {
                  key: 'status',
                  label: 'Status',
                  value: (job) => job.status,
                  render: (job) =>
                    `${job.status}${
                      job.queue_position != null && isScanQueuedStatus(job.status)
                        ? ` (#${job.queue_position})`
                        : ''
                    }`,
                },
                {
                  key: 'scan_folder',
                  label: 'Path',
                  value: (job) => job.scan_folder || '',
                  render: (job) => job.scan_folder || '—',
                },
                {
                  // "Scan again" on a finished job (W28). The Jinja scan
                  // manager has always had this and the SPA table never did,
                  // so a Failed job could only be re-run by leaving the SPA.
                  //
                  // It repeats *that* job — its folder and its three scan
                  // settings — rather than re-scanning whatever the library
                  // was last pointed at, which is the difference between a
                  // retry and a new scan.
                  key: 'retry',
                  label: 'Retry',
                  sortable: false,
                  render: (job) => {
                    const active =
                      isScanBusyStatus(job.status) || isScanQueuedStatus(job.status)
                    if (active) return <span className="gt-admin-lede">—</span>
                    return (
                      <button
                        type="button"
                        className="gt-btn gt-btn--sm"
                        disabled={scanBusyKey === job.id || !job.library_uuid}
                        title={
                          job.library_uuid
                            ? `Re-run this scan of ${job.scan_folder || 'the library folder'}`
                            : 'This job has no library attached, so it cannot be re-run.'
                        }
                        onClick={() =>
                          void startScan({
                            key: job.id,
                            libraryUuid: job.library_uuid,
                            folder: job.scan_folder || '',
                            label: job.library_name || job.library || 'Scan',
                            settings: {
                              scan_mode: job.setting_filefolder ? 'files' : 'folders',
                              remove_missing: Boolean(job.setting_remove),
                              download_missing_images: Boolean(
                                job.setting_download_missing_images,
                              ),
                            },
                          })
                        }
                      >
                        {scanBusyKey === job.id ? 'Starting…' : 'Scan again'}
                      </button>
                    )
                  },
                },
              ]}
            />
            {updatedAt ? (
              <p className="gt-admin-lede">Live status · last refresh {updatedAt.toLocaleTimeString()}</p>
            ) : null}
            <p className="gt-admin-lede">
              When a scan is already running, Auto Scan / Refresh all offer <strong>Queue</strong> (default) or{' '}
              <strong>Force parallel</strong> with an Unraid/NAS load warning.
            </p>
          </>
        )}
      </div>
      <DupeGlance onOpenPath={setPathModal} />
      <OpenPathModal
        open={Boolean(pathModal)}
        path={pathModal?.path || ''}
        label={pathModal?.label || 'Path'}
        matchReason={pathModal?.matchReason || ''}
        onClose={() => setPathModal(null)}
      />
      <ScanConflictModal
        open={conflictOpen}
        busy={refreshing}
        onChoose={onConflictChoose}
        onClose={onConflictClose}
      />
      <ScanConflictModal
        open={scanConflictOpen}
        busy={Boolean(scanBusyKey)}
        onChoose={onScanConflictChoose}
        onClose={onScanConflictClose}
      />
    </Page>
  )
}

export function resolveAdminPage(pathname) {
  if (pathname === '/admin/dashboard' || pathname === '/admin' || pathname === '/admin/') {
    return 'dashboard'
  }
  if (pathname === '/admin/support') return 'support'
  if (pathname === '/admin/invites') return 'invites'
  if (pathname === '/admin/plugins') return 'plugins'
  if (pathname === '/admin/extensions') return 'extensions'
  if (pathname.startsWith('/libraries') || pathname.startsWith('/admin/library') || pathname.includes('library_tools') || pathname.includes('/admin/filters')) {
    return 'libraries'
  }
  if (pathname === '/admin/settings') return 'settings'
  if (pathname === '/admin/themes' || pathname.startsWith('/admin/themes/')) return 'themes'
  if (pathname === '/admin/art_studio') return 'art_studio'
  if (pathname === '/admin/images') return 'images'
  if (pathname === '/admin/remote_play') return 'remote_play'
  if (pathname === '/admin/quality_profiles') return 'quality_profiles'
  if (pathname === '/admin/storage') return 'storage'
  if (pathname === '/admin/scan_match') return 'scan_match'
  if (pathname === '/admin/help') return 'help'
  // Scans live under the merged "Libraries & scans" nav item (UX-C2), so these
  // paths must highlight 'libraries' — 'scans' is no longer a top-nav id.
  // 'image_queue' dropped from this list with the standalone page (W27-C6) —
  // it is a tab of /scan_management now, which the prefix below already covers,
  // and it only ever appears as a query parameter rather than in the pathname.
  if (pathname.startsWith('/scan_management') || pathname.includes('game_identify') || pathname.includes('game_edit')) {
    return 'libraries'
  }
  if (pathname.startsWith('/admin/users') || pathname.includes('manage_invites') || pathname.includes('whitelist')) {
    return 'users'
  }
  if (
    pathname.includes('integration') ||
    pathname.includes('smtp') ||
    pathname.includes('igdb')
  ) {
    return 'integrations'
  }
  if (pathname.includes('new_server_settings')) {
    return 'settings-section'
  }
  if (
    pathname.includes('/admin/ops') ||
    pathname.includes('server_') ||
    pathname.includes('statistics') ||
    pathname.includes('manage-downloads')
    // 'new_server_info' dropped with the page (W27-D1) — resolving a path that
    // no longer routes anywhere is how a stale id outlives its page.
  ) {
    return 'system'
  }
  if (
    pathname.includes('discovery') ||
    pathname.includes('newsletter') ||
    pathname.includes('attract')
  ) {
    return 'content'
  }
  if (pathname.includes('announcement')) {
    return 'announcements'
  }
  if (
    pathname.includes('settings') ||
    pathname.includes('emulator') ||
    pathname.includes('detail_layout') ||
    pathname.includes('/admin/ai') ||
    pathname.includes('/admin/storage') ||
    pathname.includes('/admin/arr') ||
    pathname.includes('new_server_settings')
  ) {
    return 'settings-section'
  }
  return 'generic'
}
