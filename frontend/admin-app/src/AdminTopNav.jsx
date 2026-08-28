import { useEffect, useId, useRef, useState } from 'react'
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

/* Identity entries only.
   The member bar closes this menu with Logout, but admin's rail already owns a
   "Leave admin" group carrying Library and Log out, and those ways out are
   asserted to live in exactly one place (see AdminTopNav.test.jsx). Repeating
   them here to match the member menu item-for-item would reintroduce the
   duplication that moving destinations to the rail removed — so the rail keeps
   the exits and this menu keeps the account panels. */
const ACCOUNT_LINKS = [
  { id: 'profile', href: '/settings_profile_view', label: 'Profile' },
  { id: 'preferences', href: '/settings_panel', label: 'Preferences' },
  { id: 'tokens', href: '/tokens', label: 'API tokens' },
  { id: 'password', href: '/settings_password', label: 'Change Password' },
]

/** Mirrors the member bar's hint so the shortcut reads correctly per platform. */
function commandPaletteHint() {
  if (typeof navigator === 'undefined') return 'Ctrl+K'
  const platform = navigator.platform || ''
  const uaData = navigator.userAgentData
  const isMac = uaData?.platform === 'macOS' || /Mac|iPhone|iPad|iPod/i.test(platform)
  return isMac ? '⌘K' : 'Ctrl+K'
}

/** Identity published by base_admin.html on #admin-app-root. */
function readAdminIdentity() {
  if (typeof document === 'undefined') return { username: '', avatar: '' }
  const root = document.getElementById('admin-app-root')
  return {
    username: root?.dataset?.username || '',
    avatar: root?.dataset?.avatar || '',
  }
}

/**
 * Bar one for the admin shell, composed like the member bar (GT-B2 · GT-B31).
 *
 * Previously this bar was a rail toggle, a section label and a Search button.
 * Three differences made it read as another product's chrome next to the member
 * bar, and all three are fixed here:
 *
 *   - The Search button is gone. The member bar dropped its own search under
 *     GT-B16 on the grounds that a second search affordance in the chrome costs
 *     permanent width and buys nothing over the page's own filtering; ⌘K still
 *     opens the palette, and the hint moved into the account menu exactly as it
 *     did on the member side. Admin keeping the button was the single most
 *     visible mismatch between the two bars.
 *   - The rail toggle now sits in a `.gt-cbtn-group` cluster rather than
 *     floating as a lone square, which is the primitive the member bar uses.
 *     The pair is chromeless at rest — not one outlined box.
 *   - There is an account control. Admin had none, so the top-right corner —
 *     the one place every other surface puts identity — was empty.
 *
 * The section label follows the member rule too: shown only when the rail is
 * collapsed, because an expanded rail already names the active section a few
 * pixels to the left.
 */
export function AdminTopNav({ onToggleRail, railState = 'expanded' }) {
  const { pathname } = useLocation()
  const section = resolveAdminPage(pathname)
  const sectionHome = SECTION_HOME[section] || SECTION_HOME.generic

  const [identity] = useState(readAdminIdentity)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountId = useId()
  const rootRef = useRef(null)
  const paletteHint = commandPaletteHint()

  useEffect(() => {
    if (!accountOpen) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setAccountOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  return (
    <header className="gt-topbar" ref={rootRef}>
      {/* Brand and the seven section links live in the rail (GT-B2). Repeating
          them here was the duplication that made admin feel like two navs. */}
      <div className="gt-topbar__start">
        {/* Adjacent chromeless controls, as on the member bar: opening the
            nav sits beside Filters when that page has them, with no shared
            outline. */}
        <div className="gt-cbtn-group gt-topbar__cluster">
          {/* 'open' is the mobile drawer only, so testing for it left
              aria-expanded permanently false on desktop, where this button
              collapses and expands the rail. Shown is 'open' or 'expanded';
              'collapsed' is the one state that is not. */}
          <button
            type="button"
            className="gt-cbtn gt-topbar__rail-toggle"
            aria-label="Toggle navigation"
            aria-expanded={railState !== 'collapsed'}
            onClick={onToggleRail}
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>

        {railState === 'collapsed' ? (
          <span className="gt-topbar__section">{sectionHome.label}</span>
        ) : null}
      </div>

      {/* Centre slot, so an admin page can portal its own views here the way
          member pages do rather than growing a second bar. */}
      <div id="gt-admin-topbar-slot" className="gt-topbar__page" />

      <div className="gt-topbar__actions">
        <div className="gt-topnav__dropdown">
          {/* Name first, portrait at the edge — the same order and the same
              `.gt-cbtn` shell as the member account button. */}
          <button
            type="button"
            className="gt-cbtn gt-topbar__account"
            aria-expanded={accountOpen}
            aria-controls={accountId}
            aria-label="Account menu"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="gt-topbar__account-name">
              {identity.username || 'Account'}
            </span>
            {identity.avatar ? (
              <img
                className="gt-topbar__account-avatar"
                src={identity.avatar.startsWith('/') ? identity.avatar : `/static/${identity.avatar}`}
                alt=""
                width={22}
                height={22}
              />
            ) : (
              <span aria-hidden="true">👤</span>
            )}
          </button>
          {accountOpen ? (
            <div className="gt-topnav__dropdown-panel" id={accountId} role="menu">
              {identity.username ? (
                <div className="gt-topnav__username">{identity.username}</div>
              ) : null}
              {/* The only remaining home for the palette hint now the bar's
                  search button is gone. AdminCommandPalette binds ⌘K itself, so
                  this is discoverability, not the trigger — and admin has ~60
                  destinations that only the palette reaches quickly, which is
                  why the hint has to live somewhere. */}
              <button
                type="button"
                role="menuitem"
                className="gt-topnav__palette-hint"
                onClick={() => {
                  setAccountOpen(false)
                  document.dispatchEvent(new CustomEvent('gt-admin-palette:open'))
                }}
              >
                Search everything <kbd>{paletteHint}</kbd>
              </button>
              {ACCOUNT_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  role="menuitem"
                  onClick={() => setAccountOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <AdminCommandPalette />
    </header>
  )
}
