import { useLocation } from 'react-router-dom'
import { ADMIN_NAV } from './navConfig'
import { resolveAdminPage } from './pages'

const SECTION_HOME = {
  dashboard: { href: '/admin/dashboard', label: 'Home' },
  libraries: { href: '/libraries', label: 'Libraries home' },
  extensions: { href: '/libraries', label: 'Libraries home' },
  scans: { href: '/scan_management', label: 'Scans home' },
  settings: { href: '/admin/settings', label: 'Settings home' },
  themes: { href: '/admin/themes', label: 'Themes' },
  help: { href: '/admin/help', label: 'Help' },
  announcements: { href: '/admin/announcements', label: 'Announcements' },
  support: { href: '/admin/support', label: 'Support inbox' },
  invites: { href: '/admin/invites', label: 'Invites' },
  users: { href: '/admin/users', label: 'Users home' },
  integrations: { href: '/admin/integrations', label: 'Integrations home' },
  system: { href: '/admin/ops', label: 'System home' },
  content: { href: '/admin/discovery_sections', label: 'Content home' },
  'settings-section': { href: '/admin/settings', label: 'Settings home' },
  generic: { href: '/admin/dashboard', label: 'Home' },
}

function isActivePath(pathname, link) {
  const path = link.path
  if (link.id === 'content') {
    return (
      pathname.includes('announcement') ||
      pathname.includes('discovery') ||
      pathname.includes('newsletter') ||
      pathname.includes('attract')
    )
  }
  if (path === '/admin/dashboard') {
    return pathname === '/admin/dashboard' || pathname === '/admin' || pathname === '/admin/'
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function AdminTopNav() {
  const { pathname } = useLocation()
  const section = resolveAdminPage(pathname)
  const sectionHome = SECTION_HOME[section] || SECTION_HOME.generic
  const onDashboard = section === 'dashboard'

  return (
    <header className="gt-admin-topbar">
      <a className="gt-admin-brand" href="/admin/dashboard">
        <img src="/static/newstyle/gametheca_mark.svg" alt="" width={24} height={24} />
        <span className="gt-admin-brand-text">
          <span className="gt-admin-brand-name">GameTheca</span>
          <span className="gt-admin-brand-role">Admin</span>
        </span>
      </a>
      <nav className="gt-admin-nav" aria-label="Admin">
        {ADMIN_NAV.map((link) => (
          <a
            key={link.id}
            href={link.path}
            className={isActivePath(pathname, link) ? 'active' : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="gt-admin-actions">
        {!onDashboard ? (
          <a className="gt-btn gt-btn--quiet" href="/admin/dashboard">
            Dashboard
          </a>
        ) : null}
        {sectionHome.href !== '/admin/dashboard' && sectionHome.href !== pathname ? (
          <a className="gt-btn gt-btn--quiet" href={sectionHome.href}>
            {sectionHome.label}
          </a>
        ) : null}
        <a className="gt-btn gt-btn--quiet" href="/library">
          Library
        </a>
        <a className="gt-btn gt-btn--quiet" href="/logout">
          Log out
        </a>
      </div>
    </header>
  )
}
