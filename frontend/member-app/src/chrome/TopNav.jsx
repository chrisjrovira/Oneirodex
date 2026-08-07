import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { IconMenu, IconMore, IconUser, primaryIconById } from './icons'
import { getContextLinks, getMoreGroups, getPrimaryLinks } from './navConfig'
import { openPreferencesModal } from '../api/preferences'
import { requestOpenChatPanel } from '../hooks/chatPanelApi'
import { requestOpenSocialCompanion } from '../hooks/socialCompanionApi'
import { TileSizeControl } from './TileSizeControl'
import { AccountPanel } from './AccountPanel'
import './TopNav.css'
const ACCOUNT_LINKS = [
  { id: 'profile', href: '#account-profile', label: 'Profile', profilePanel: true },
  { id: 'preferences', href: '/settings_panel', label: 'Preferences', preferences: true },
  { id: 'tokens', to: '/tokens', label: 'API tokens' },
  { id: 'password', href: '/settings_password', label: 'Change Password' },
  { id: 'logout', href: '/logout', label: 'Logout' },
]

function PrimaryLink({ link, onNavigate }) {
  const Icon = primaryIconById[link.id]
  if (link.external) {
    return (
      <a className="gt-topnav__link" href={link.href} onClick={onNavigate}>
        {Icon ? <Icon /> : null}
        <span>{link.label}</span>
      </a>
    )
  }
  return (
    <NavLink className="gt-topnav__link" to={link.to} onClick={onNavigate}>
      {Icon ? <Icon /> : null}
      <span>{link.label}</span>
    </NavLink>
  )
}

function MoreMenuLink({ link, onNavigate }) {
  if (link.action === 'open-friends') {
    return (
      <button
        type="button"
        role="menuitem"
        className="gt-topnav__menu-action"
        onClick={(event) => {
          event.preventDefault()
          onNavigate?.()
          requestOpenSocialCompanion()
        }}
      >
        {link.label}
      </button>
    )
  }
  if (link.action === 'open-chat') {
    return (
      <button
        type="button"
        role="menuitem"
        className="gt-topnav__menu-action"
        onClick={(event) => {
          event.preventDefault()
          onNavigate?.()
          requestOpenChatPanel()
        }}
      >
        {link.label}
      </button>
    )
  }
  if (link.to) {
    return (
      <NavLink to={link.to} role="menuitem" onClick={onNavigate}>
        {link.label}
      </NavLink>
    )
  }
  return (
    <a href={link.href} role="menuitem" onClick={onNavigate}>
      {link.label}
    </a>
  )
}
function commandPaletteHint() {
  if (typeof navigator === 'undefined') return 'Ctrl+K'
  const platform = navigator.platform || ''
  const uaData = navigator.userAgentData
  const isMac =
    uaData?.platform === 'macOS' || /Mac|iPhone|iPad|iPod/i.test(platform)
  return isMac ? '⌘K' : 'Ctrl+K'
}

export function TopNav({
  shellConfig = {},
  tileSize,
  onTileSizeChange,
  onOpenCommandPalette,
}) {
  const {
    isAdmin = false,
    showTrailers = false,
    showHelp = false,
    enableVr = false,
    // Was never destructured, so ENABLE_ACTIVITY_FEED hid the route while the
    // nav link stayed — a toggle that only half-worked.
    enableActivity = true,
    username = '',
  } = shellConfig

  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [profilePanelOpen, setProfilePanelOpen] = useState(false)
  const rootRef = useRef(null)
  const moreId = useId()
  const accountId = useId()
  const paletteHint = commandPaletteHint()

  const primaryLinks = getPrimaryLinks()
  const moreGroups = getMoreGroups({ showTrailers, showHelp, enableVr, enableActivity })
  const contextLinks = getContextLinks(pathname, { isAdmin })

  function closeMenus() {
    setMoreOpen(false)
    setAccountOpen(false)
  }

  function closeMobile() {
    setMobileOpen(false)
    closeMenus()
  }

  useEffect(() => {
    const root = document.documentElement
    function syncTopnavOffset() {
      const height = rootRef.current?.offsetHeight || 44
      root.style.setProperty('--gt-topnav-offset', `${height}px`)
    }
    syncTopnavOffset()
    window.addEventListener('resize', syncTopnavOffset)
    return () => window.removeEventListener('resize', syncTopnavOffset)
  }, [mobileOpen])

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        closeMenus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    function onResize() {
      if (window.matchMedia('(min-width: 901px)').matches) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!mobileOpen && !profilePanelOpen) {
      return undefined
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        if (profilePanelOpen) {
          setProfilePanelOpen(false)
          return
        }
        closeMobile()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, profilePanelOpen])

  async function handlePreferencesClick(event) {
    event.preventDefault()
    closeMobile()
    try {
      await openPreferencesModal()
    } catch {
      window.location.href = '/settings_panel'
    }
  }

  function handleProfileClick(event) {
    event.preventDefault()
    closeMenus()
    setMobileOpen(false)
    setProfilePanelOpen(true)
  }

  return (
    <>
    <header className="gt-topnav" ref={rootRef}>
      <Link className="gt-topnav__brand" to="/discover" onClick={closeMobile}>
        <img
          className="gt-topnav__brand-mark"
          src="/static/newstyle/gametheca_mark.svg"
          alt=""
          width={28}
          height={28}
        />
        <span>GameTheca</span>
      </Link>

      <button
        type="button"
        className="gt-topnav__hamburger"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <IconMenu />
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="gt-topnav__backdrop"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      ) : null}

      <nav className={`gt-topnav__nav${mobileOpen ? ' is-open' : ''}`} aria-label="Primary">
        {primaryLinks.map((link) => (
          <PrimaryLink key={link.id} link={link} onNavigate={closeMobile} />
        ))}
        <div className="gt-topnav__context" aria-label="Section">
          {contextLinks.map((link) =>
            link.external || link.href ? (
              <a
                key={link.id}
                className="gt-topnav__context-link"
                href={link.href || link.to}
                onClick={closeMobile}
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.id}
                className="gt-topnav__context-link"
                to={link.to}
                onClick={closeMobile}
              >
                {link.label}
              </NavLink>
            ),
          )}
        </div>
        <div className="gt-topnav__spacer" />

        {onOpenCommandPalette ? (
          <button
            type="button"
            className="gt-topnav__search-hint"
            aria-label={`Search commands (${paletteHint})`}
            onClick={() => {
              closeMenus()
              onOpenCommandPalette()
            }}
          >
            <span className="gt-topnav__search-hint-label">Search</span>
            <kbd className="gt-topnav__search-hint-kbd">{paletteHint}</kbd>
          </button>
        ) : null}

        <div className="gt-topnav__tile-size">
          <TileSizeControl
            value={tileSize || shellConfig.tileSize || '50'}
            onChange={onTileSizeChange}
            shellConfig={shellConfig}
          />
        </div>

        <div className="gt-topnav__menus">
          <div className="gt-topnav__dropdown">
            <button
              type="button"
              className="gt-topnav__menu-trigger"
              aria-expanded={moreOpen}
              aria-controls={moreId}
              onClick={() => {
                setMoreOpen((open) => !open)
                setAccountOpen(false)
              }}
            >
              <IconMore />
              <span>More</span>
            </button>
            {moreOpen ? (
              <div className="gt-topnav__dropdown-panel" id={moreId} role="menu">
                {moreGroups.map((group) => (
                  <div key={group.id} className="gt-topnav__dropdown-group">
                    <p className="gt-topnav__dropdown-heading" aria-hidden="true">
                      {group.label}
                    </p>
                    {group.links.map((link) => (
                      <MoreMenuLink
                        key={link.id}
                        link={link}
                        onNavigate={closeMobile}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="gt-topnav__dropdown">
            <button
              type="button"
              className="gt-topnav__menu-trigger"
              aria-expanded={accountOpen}
              aria-controls={accountId}
              aria-label="Account menu"
              onClick={() => {
                setAccountOpen((open) => !open)
                setMoreOpen(false)
              }}
            >
              <IconUser />
              <span>{username || 'Account'}</span>
            </button>
            {accountOpen ? (
              <div className="gt-topnav__dropdown-panel" id={accountId} role="menu">
                {username ? <div className="gt-topnav__username">{username}</div> : null}
                {ACCOUNT_LINKS.map((link) => {
                  if (link.profilePanel) {
                    return (
                      <a
                        key={link.id}
                        href={link.href}
                        role="menuitem"
                        onClick={handleProfileClick}
                      >
                        {link.label}
                      </a>
                    )
                  }
                  if (link.preferences) {
                    return (
                      <a
                        key={link.id}
                        href={link.href}
                        role="menuitem"
                        onClick={handlePreferencesClick}
                      >
                        {link.label}
                      </a>
                    )
                  }
                  if (link.to) {
                    return (
                      <NavLink
                        key={link.id}
                        to={link.to}
                        role="menuitem"
                        onClick={closeMobile}
                      >
                        {link.label}
                      </NavLink>
                    )
                  }
                  return (
                    <a key={link.id} href={link.href} role="menuitem" onClick={closeMobile}>
                      {link.label}
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    </header>
    <AccountPanel
      open={profilePanelOpen}
      onClose={() => setProfilePanelOpen(false)}
      shellConfig={shellConfig}
    />
    </>
  )
}
