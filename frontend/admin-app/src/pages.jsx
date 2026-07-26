import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HUB_LINKS, SETTINGS_CARDS } from './navConfig'

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

  return (
    <Page title="Dashboard" lede="Ops glance for libraries, scans, and system health.">
      {error ? (
        <div role="alert">Unable to load ops summary. Open Ops for details.</div>
      ) : null}
      <div className="gt-admin-card-grid">
        <div className="gt-admin-card">
          <h2>Libraries</h2>
          <p>{summary?.library_count ?? '—'} configured</p>
        </div>
        <div className="gt-admin-card">
          <h2>Games</h2>
          <p>{summary?.game_count ?? '—'} in catalogue</p>
        </div>
        <div className="gt-admin-card">
          <h2>Scan jobs</h2>
          <p>{summary?.active_scans ?? summary?.scan_jobs ?? '—'} active / recent</p>
        </div>
        <div className="gt-admin-card">
          <h2>Disk</h2>
          <p>{summary?.disk_free || summary?.storage_hint || 'See Storage settings'}</p>
        </div>
      </div>
      <LinkRow
        links={[
          { href: '/admin/ops', label: 'Ops glance' },
          { href: '/scan_management', label: 'Scans' },
          { href: '/libraries', label: 'Libraries' },
          { href: '/admin/settings', label: 'Settings' },
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
        <li>Themes: Reset Default Themes after image rebuilds that change design tokens.</li>
        <li>Member Systems hub lives at <code>/systems</code> with platform skins.</li>
      </ul>
    </Page>
  )
}

export function resolveAdminPage(pathname) {
  if (pathname === '/admin/dashboard' || pathname === '/admin' || pathname === '/admin/') {
    return 'dashboard'
  }
  if (pathname.startsWith('/libraries') || pathname.startsWith('/admin/library') || pathname.includes('library_tools') || pathname.includes('/admin/filters') || pathname.includes('/admin/extensions')) {
    return 'libraries'
  }
  if (pathname === '/admin/settings') return 'settings'
  if (pathname === '/admin/themes' || pathname.startsWith('/admin/themes/')) return 'themes'
  if (pathname === '/admin/help') return 'help'
  if (pathname.startsWith('/scan_management') || pathname.includes('image_queue') || pathname.includes('game_identify') || pathname.includes('game_edit')) {
    return 'scans'
  }
  if (pathname.startsWith('/admin/users') || pathname.includes('invite') || pathname.includes('whitelist')) {
    return 'users'
  }
  if (
    pathname.includes('integration') ||
    pathname.includes('smtp') ||
    pathname.includes('igdb') ||
    pathname.includes('discord')
  ) {
    return 'integrations'
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
