import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HUB_LINKS, INTEGRATION_CARDS, SETTINGS_CARDS } from './navConfig'
import {
  MeterBar,
  MetricTile,
  OpsStatusBanner,
  companionKindRows,
  formatBytes,
  formatLoadAvg,
  formatReadyz,
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
  const requestRef = useRef({ id: 0, controller: null })

  const refresh = useCallback(() => {
    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = requestRef.current.id + 1
    requestRef.current = { id, controller }
    getJson('/admin/api/ops/summary')
      .then((data) => {
        if (requestRef.current.id !== id || controller.signal.aborted) return
        setSummary(data)
        setError(null)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (requestRef.current.id !== id) return
        setError(err)
      })
  }, [])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 15000)
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
      {error ? (
        <div role="alert" className="gt-admin-alert">
          Unable to load ops summary. Open System for details.
        </div>
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

export function IntegrationsPage() {
  return (
    <Page
      title="Integrations"
      lede="Grouped entry points for metadata, mail, SSO, voice, and support. Classic Jinja forms stay behind these deep links — hybrid chrome only."
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
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
        <p>
          Full Integrations tabs (SMTP · IGDB · community · artwork · OIDC) still render when Jinja
          content is present. This React hub is the fallback chrome when the classic body is empty.
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
          Plugins registry: <code>GET /api/plugins</code>. Exports: <code>/api/export/esde</code>,{' '}
          <code>/api/export/pegasus</code>. Emulator health: <code>/api/emulator/health</code>.
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

  const running = Boolean(status && (status.running || status.is_running))
  const progress = status?.progress ?? status?.percent ?? null
  const message = status?.message || status?.status_message || status?.phase || null

  return (
    <Page title="Scans & recognition" lede="Scan jobs, identify workbench, and image queue.">
      <LinkRow links={HUB_LINKS.scans} />
      {error ? <div role="alert">Unable to load scan status.</div> : null}
      <div className="gt-admin-panel">
        {!status ? (
          <p>Loading…</p>
        ) : (
          <>
            <p>
              Running: {running ? 'yes' : 'no'}
              {status.job_id ? (
                <>
                  {' '}
                  · job <code>{status.job_id}</code>
                </>
              ) : null}
              {progress != null ? <> · progress {String(progress)}</> : null}
            </p>
            {message ? <p className="gt-admin-lede">{message}</p> : null}
            {updatedAt ? (
              <p className="gt-admin-lede">Live status · last refresh {updatedAt.toLocaleTimeString()}</p>
            ) : null}
          </>
        )}
      </div>
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
    pathname.includes('quality') ||
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
