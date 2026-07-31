import { NavLink } from 'react-router-dom'
import { openPreferencesModal } from '../api/preferences'
import './AccountPanel.css'

const PANEL_GROUPS = [
  {
    id: 'account',
    label: 'Account',
    links: [
      { id: 'edit', href: '/settings_profile_edit', label: 'Change avatar' },
      { id: 'preferences', href: '/settings_panel', label: 'Preferences', preferences: true },
      { id: 'password', href: '/settings_password', label: 'Change password' },
      { id: 'tokens', to: '/tokens', label: 'API tokens' },
    ],
  },
  {
    id: 'household',
    label: 'Household',
    links: [{ id: 'invites', href: '/user/invites', label: 'Invites' }],
  },
  {
    id: 'session',
    label: 'Session',
    links: [{ id: 'logout', href: '/logout', label: 'Log out', danger: true }],
  },
]

/**
 * Account / profile drawer that sits under TopNav (does not cover chrome).
 */
export function AccountPanel({ open, onClose, shellConfig = {} }) {
  const { username = '', role = 'user' } = shellConfig

  if (!open) {
    return null
  }

  async function handlePreferences(event) {
    event.preventDefault()
    onClose?.()
    try {
      await openPreferencesModal()
    } catch {
      window.location.href = '/settings_panel'
    }
  }

  function renderLink(link) {
    if (link.preferences) {
      return (
        <a key={link.id} href={link.href} onClick={handlePreferences}>
          {link.label}
        </a>
      )
    }
    if (link.to) {
      return (
        <NavLink key={link.id} to={link.to} onClick={onClose}>
          {link.label}
        </NavLink>
      )
    }
    return (
      <a
        key={link.id}
        href={link.href}
        data-danger={link.danger ? 'true' : undefined}
        onClick={onClose}
      >
        {link.label}
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        className="gt-account-panel__backdrop"
        aria-label="Close account panel"
        onClick={onClose}
      />
      <aside
        className="gt-account-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
      >
        <header className="gt-account-panel__head">
          <div>
            <h2 className="gt-account-panel__title">Profile</h2>
            <p className="gt-account-panel__lede">
              {username || 'Account'}
              {role ? ` · ${role}` : ''}
            </p>
          </div>
          <button type="button" className="gt-account-panel__close" onClick={onClose}>
            Close
          </button>
        </header>
        <nav className="gt-account-panel__nav" aria-label="Account actions">
          {PANEL_GROUPS.map((group) => (
            <div key={group.id} className="gt-account-panel__group">
              <p className="gt-account-panel__group-label">{group.label}</p>
              {group.links.map(renderLink)}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
