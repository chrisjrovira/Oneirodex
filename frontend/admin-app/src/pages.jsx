import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HUB_LINKS, INTEGRATION_CARDS, SETTINGS_CARDS } from './navConfig'

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

  useEffect(() => {
    const controller = new AbortController()
    getJson('/admin/api/ops/summary')
      .then(setSummary)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err)
      })
    return () => controller.abort()
  }, [])

  const library = summary?.library
  const scans = summary?.scans
  const host = summary?.host
  const issues = summary?.issues
  const disk = host?.disk_games || host?.disk_base
  const severity = issues?.overall || 'good'

  return (
    <Page title="Dashboard" lede="Ops glance for libraries, scans, and system health.">
      {error ? (
        <div role="alert" className="gt-admin-alert">
          Unable to load ops summary. Open System for details.
        </div>
      ) : null}

      <section className={`gt-ops-status gt-ops-status--${severity}`} aria-label="Health">
        <strong>
          {severity === 'bad'
            ? 'Action required'
            : severity === 'warn'
              ? 'Attention needed'
              : 'All systems healthy'}
        </strong>
        {summary?.as_of ? <span>Updated {new Date(summary.as_of).toLocaleString()}</span> : null}
      </section>

      <div className="gt-admin-card-grid">
        <div className="gt-admin-card">
          <h2>Libraries</h2>
          <p className="gt-admin-metric">{library?.libraries ?? '—'}</p>
          <p className="gt-admin-lede">configured folders</p>
        </div>
        <div className="gt-admin-card">
          <h2>Games</h2>
          <p className="gt-admin-metric">{library?.games ?? '—'}</p>
          <p className="gt-admin-lede">
            {library?.unmatched_folders != null
              ? `${library.unmatched_folders} unmatched folders`
              : 'in catalogue'}
          </p>
        </div>
        <div className="gt-admin-card">
          <h2>Scan jobs</h2>
          <p className="gt-admin-metric">{scans?.active_count ?? '—'}</p>
          <p className="gt-admin-lede">
            {(scans?.jobs || [])[0]
              ? `${scans.jobs[0].library || 'job'} · ${scans.jobs[0].progress}%`
              : 'active now'}
          </p>
        </div>
        <div className="gt-admin-card">
          <h2>Disk</h2>
          <p className="gt-admin-metric">
            {disk?.percent != null ? `${disk.percent}%` : '—'}
          </p>
          <p className="gt-admin-lede">
            {disk?.free != null || disk?.used != null
              ? `used on games volume`
              : 'See Storage settings'}
          </p>
        </div>
      </div>

      {(summary?.recent_errors || []).length > 0 ? (
        <div className="gt-admin-panel" style={{ marginTop: '1rem' }}>
          <h2>Recent errors</h2>
          <ul className="gt-ops-list">
            {summary.recent_errors.slice(0, 4).map((event) => (
              <li key={event.id}>
                <code>{event.event_type}</code> {event.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <LinkRow
        links={[
          { href: '/admin/ops', label: 'Ops glance' },
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
        <li>Dashboard and Ops show live summary from <code>/admin/api/ops/summary</code>.</li>
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
