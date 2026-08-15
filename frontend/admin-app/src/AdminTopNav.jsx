import { useLocation } from 'react-router-dom'
import AdminCommandPalette from './AdminCommandPalette'
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

export function AdminTopNav({ onToggleRail, railState = 'expanded' }) {
  const { pathname } = useLocation()
  const section = resolveAdminPage(pathname)
  const sectionHome = SECTION_HOME[section] || SECTION_HOME.generic

  return (
    <header className="gt-topbar">
      {/* Brand and the seven section links moved to the rail (GT-B2). Repeating
          them here was the duplication that made admin feel like two navs. */}
      {/* 'open' is the mobile drawer only, so testing for it left aria-expanded
          permanently false on desktop, where this button collapses and expands
          the rail. Shown is 'open' or 'expanded'; 'collapsed' is the one state
          that is not. Same fix as member-app's TopBar. */}
      <button
        type="button"
        className="gt-cbtn gt-topbar__rail-toggle"
        aria-label="Toggle navigation"
        aria-expanded={railState !== 'collapsed'}
        onClick={onToggleRail}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <span className="gt-topbar__section">{sectionHome.label}</span>
      <div className="gt-topbar__spacer" />
      <div className="gt-topbar__actions">
        {/* Discoverability for ⌘K (GT-A7): a shortcut nobody is told about is a
            shortcut nobody uses, and admin has ~60 destinations that only search
            reaches quickly. */}
        <button
          type="button"
          className="gt-cbtn"
          onClick={() => {
            document.dispatchEvent(new CustomEvent('gt-admin-palette:open'))
          }}
        >
          Search <kbd>⌘K</kbd>
        </button>
      </div>
      <AdminCommandPalette />
    </header>
  )
}
