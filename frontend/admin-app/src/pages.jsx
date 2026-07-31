import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DupeGlance } from './DupeGlance'
import { HUB_LINKS, INTEGRATION_CARDS, SETTINGS_CARDS } from './navConfig'
import { OpenPathModal } from './OpenPathModal'
import {
  hasActiveScan,
  isScanQueuedStatus,
  normalizeScanJobsList,
} from './scanQueuePolicy'
import {
  MeterBar,
  MetricTile,
  OpsStatusBanner,
  companionKindRows,
  formatBytes,
  formatLibraryHealthHint,
  formatLibraryHealthValue,
  formatLoadAvg,
  formatReadyz,
  libraryHealthTone,
  na,
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

function Page({ title, lede, children }) {
  return (
    <div className="gt-admin-page">
      <h1>{title}</h1>
      {lede ? <p className="gt-admin-lede">{lede}</p> : null}
      {children}
    </div>
  )
}

function LinkRow({ links }) {
  return (
    <div className="gt-admin-actions-row">
      {links.map((link) => (
        <a key={link.href} className="gt-btn" href={link.href}>
          {link.label}
        </a>
      ))}
    </div>
  )
}

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

  return (
    <Page title="Dashboard" lede="Observability glance — libraries, host pulse, and open issues (~15s).">
      <div className="gt-ops-refresh" style={{ marginBottom: '0.85rem' }}>
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
        <MetricTile label="Libraries" value={na(library?.libraries)} hint="folders" />
        <MetricTile
          label="Games"
          value={na(library?.games)}
          hint={
            library?.unmatched_folders != null
              ? `${library.unmatched_folders} unmatched`
              : 'catalogue'
          }
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
        />
        <MetricTile
          label="Disk"
          value={disk?.percent != null ? `${disk.percent}%` : 'n/a'}
          hint="games volume"
        />
        <MetricTile label="Load 1/5/15" value={formatLoadAvg(host?.load_avg)} />
        <MetricTile
          label="Process RSS"
          value={formatBytes(host?.process?.rss_bytes)}
          hint={host?.process?.pid != null ? `pid ${host.process.pid}` : 'n/a'}
        />
        <MetricTile
          label="DB ping"
          value={host?.db_ping_ms != null ? `${host.db_ping_ms} ms` : 'n/a'}
        />
        <MetricTile label="Readyz" value={formatReadyz(services?.readyz)} />
        <MetricTile
          label="Companions"
          value={`${companions?.online ?? 0} / ${companions?.registered ?? 0}`}
          hint={
            kindRows.length
              ? kindRows.map((r) => `${r.kind} ${r.online}/${r.registered}`).join(' · ')
              : 'by kind n/a'
          }
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
            <table className="gt-ops-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Online</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {kindRows.map((row) => (
                  <tr key={row.kind}>
                    <td>{row.kind}</td>
                    <td>{row.online}</td>
                    <td>{row.registered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {(summary?.recent_errors || []).length > 0 ? (
          <section className="gt-ops-panel gt-ops-panel--wide">
            <h2>Recent errors</h2>
            <table className="gt-ops-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_errors.slice(0, 4).map((event) => (
                  <tr key={event.id}>
                    <td>
                      <code>{event.event_type}</code>
                    </td>
                    <td>{event.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>

      <LinkRow
        links={[
          { href: '/admin/ops', label: 'Ops console' },
          { href: '/scan_management', label: 'Scans' },
          { href: '/libraries', label: 'Libraries' },
          { href: '/admin/settings', label: 'Settings' },
          { href: '/admin/support', label: 'Support inbox' },
        ]}
      />
    </Page>
  )
}

export function LibrariesPage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getJson('/api/get_libraries')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(setError)
  }, [])

  return (
    <Page title="Libraries" lede="Manage library folders and platforms.">
      {error ? <div role="alert">Unable to load libraries.</div> : null}
      <LinkRow links={HUB_LINKS.libraries} />
      <div className="gt-admin-panel">
        {!rows ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p>No libraries yet. Add one to start scanning.</p>
        ) : (
          <table className="gt-admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>UUID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lib) => (
                <tr key={lib.uuid}>
                  <td>{lib.name}</td>
                  <td>
                    <code>{lib.uuid}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  )
}

export function SettingsPage() {
  return (
    <Page title="Settings" lede="One-click cards for server modules and theme controls.">
      <div className="gt-admin-card-grid">
        {SETTINGS_CARDS.map((card) => (
          <a key={card.to} className="gt-admin-card" href={card.to}>
            <h2>{card.title}</h2>
            <p>{card.blurb}</p>
          </a>
        ))}
      </div>
    </Page>
  )
}

export function HubPage({ title, lede, links }) {
  return (
    <Page title={title} lede={lede}>
      <LinkRow links={links} />
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
      <div className="gt-admin-card-grid gt-admin-card-grid--integrations">
        {INTEGRATION_CARDS.map((card) => (
          <section key={card.id} className="gt-admin-card gt-admin-card--hub" aria-labelledby={`int-${card.id}`}>
            <h2 id={`int-${card.id}`}>
              <a href={card.href}>{card.title}</a>
            </h2>
            <p>{card.blurb}</p>
            <ul className="gt-admin-card__links">
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
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || ''
      const response = await fetch('/admin/themes/reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
        },
        body: '{}',
      })
      setMessage(response.ok ? 'Default themes reset. Hard-refresh the browser.' : 'Reset failed.')
    } catch {
      setMessage('Reset failed.')
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
          <table className="gt-admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => (
                <tr key={plugin.id}>
                  <td>
                    <code>{plugin.id}</code>
                  </td>
                  <td>{plugin.name}</td>
                  <td>{plugin.category}</td>
                  <td>{plugin.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const running = hasActiveScan(jobs) || Boolean(status && !Array.isArray(status) && (status.running || status.is_running))
  const queuedJobs = jobs.filter((job) => isScanQueuedStatus(job?.status))
  const recentJobs = jobs.slice(0, 12)
  const progress = status?.progress ?? status?.percent ?? null
  const message = status?.message || status?.status_message || status?.phase || null

  return (
    <Page title="Scans & recognition" lede="Scan jobs, identify workbench, and image queue. Start / queue / force from Scan jobs (Jinja).">
      <LinkRow links={HUB_LINKS.scans} />
      {error ? <div role="alert">Unable to load scan status.</div> : null}
      <div className="gt-admin-panel">
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
            {recentJobs.length > 0 ? (
              <table className="gt-admin-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Library</th>
                    <th>Status</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <code>{String(job.id).slice(0, 8)}</code>
                      </td>
                      <td>{job.library_name || job.library || '—'}</td>
                      <td>
                        {job.status}
                        {job.queue_position != null && isScanQueuedStatus(job.status)
                          ? ` (#${job.queue_position})`
                          : ''}
                      </td>
                      <td>{job.scan_folder || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="gt-admin-lede">No scan jobs yet.</p>
            )}
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
  if (pathname.startsWith('/libraries') || pathname.startsWith('/admin/library') || pathname.includes('library_tools') || pathname.includes('/admin/filters') || pathname.includes('/admin/extensions')) {
    return 'libraries'
  }
  if (pathname === '/admin/settings') return 'settings'
  if (pathname === '/admin/themes' || pathname.startsWith('/admin/themes/')) return 'themes'
  if (pathname === '/admin/art_studio') return 'art_studio'
  if (pathname === '/admin/images') return 'images'
  if (pathname === '/admin/remote_play') return 'remote_play'
  if (pathname === '/admin/quality_profiles') return 'quality_profiles'
  if (pathname === '/admin/storage') return 'storage'
  if (pathname === '/admin/help') return 'help'
  if (pathname.startsWith('/scan_management') || pathname.includes('image_queue') || pathname.includes('game_identify') || pathname.includes('game_edit')) {
    return 'scans'
  }
  if (pathname.startsWith('/admin/users') || pathname.includes('manage_users') || pathname.includes('manage_invites') || pathname.includes('whitelist')) {
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
    pathname.includes('manage-downloads') ||
    pathname.includes('new_server_info')
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
