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

/**
 * Read the chrome marker off `<html>` (UIR-7).
 *
 * admin-app has no shell-config plumbing, and adding some just for this would
 * be a second source of truth for a flag the stylesheet already reads from
 * `data-chrome`. base_admin.html sets it; this reads the same attribute.
 */
function usingNewChrome() {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.chrome === 'v2'
}

export function AdminTopNav() {
  const { pathname } = useLocation()
  const section = resolveAdminPage(pathname)
  const sectionHome = SECTION_HOME[section] || SECTION_HOME.generic
  const onDashboard = section === 'dashboard'
  const newChrome = usingNewChrome()

  // Admin's bar one was structurally the member AppBar with different class
  // names, which is precisely why the two could not look the same however
  // carefully each was styled. Under v2 it emits the shared `gt-appbar`
  // classes and gets its appearance from the same gt-appbar.css both shells
  // already link — the stylesheet is the shared artifact (UIR-4), so this
  // costs no cross-build import.
  const cls = newChrome
    ? {
        bar: 'gt-appbar',
        brand: 'gt-appbar__brand',
        nav: 'gt-appbar__nav',
        link: 'gt-appbar__link',
        linkActive: 'gt-appbar__link is-active',
        actions: 'gt-appbar__tools',
        button: 'gt-cbtn',
      }
    : {
        bar: 'gt-admin-topbar',
        brand: 'gt-admin-brand',
        nav: 'gt-admin-nav',
        link: undefined,
        linkActive: 'active',
        actions: 'gt-admin-actions',
        button: 'gt-btn gt-btn--quiet',
      }

  return (
    <header className={cls.bar}>
      <a className={cls.brand} href="/admin/dashboard">
        <img src="/static/newstyle/gametheca_mark.svg" alt="" width={24} height={24} />
        <span className="gt-admin-brand-text">
          <span className="gt-admin-brand-name">GameTheca</span>
          <span className="gt-admin-brand-role">Admin</span>
        </span>
      </a>
      <nav className={cls.nav} aria-label="Admin">
        {ADMIN_NAV.map((link) => (
          <a
            key={link.id}
            href={link.path}
            className={isActivePath(pathname, link) ? cls.linkActive : cls.link}
          >
            {link.label}
          </a>
        ))}
      </nav>
      {newChrome ? <div className="gt-appbar__spacer" /> : null}
      <div className={cls.actions}>
        {/* Dashboard and section-home are breadcrumbs, and bar two names the
            section now — the same duplication that was dropped from the member
            bar one. Library and Log out stay: both leave the admin app, and
            nothing else offers them. */}
        {!newChrome && !onDashboard ? (
          <a className={cls.button} href="/admin/dashboard">
            Dashboard
          </a>
        ) : null}
        {!newChrome
        && sectionHome.href !== '/admin/dashboard'
        && sectionHome.href !== pathname ? (
          <a className={cls.button} href={sectionHome.href}>
            {sectionHome.label}
          </a>
        ) : null}
        <a className={cls.button} href="/library">
          Library
        </a>
        <a className={cls.button} href="/logout">
          Log out
        </a>
      </div>
    </header>
  )
}
