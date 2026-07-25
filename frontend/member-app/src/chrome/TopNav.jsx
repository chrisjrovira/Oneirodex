import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { IconMenu, IconMore, IconUser, primaryIconById } from './icons'
import { getMoreLinks, getPrimaryLinks } from './navConfig'
import { TileSizeControl } from './TileSizeControl'
import './TopNav.css'

const ACCOUNT_LINKS = [
  { id: 'profile', href: '/settings_profile_view', label: 'Profile' },
  { id: 'preferences', href: '/settings_panel', label: 'Preferences' },
  { id: 'password', href: '/settings_password', label: 'Change Password' },
  { id: 'logout', href: '/logout', label: 'Logout' },
]

function PrimaryLink({ link }) {
  const Icon = primaryIconById[link.id]
  if (link.external) {
    return (
      <a className="gt-topnav__link" href={link.href}>
        {Icon ? <Icon /> : null}
        <span>{link.label}</span>
      </a>
    )
  }
  return (
    <NavLink className="gt-topnav__link" to={link.to}>
      {Icon ? <Icon /> : null}
      <span>{link.label}</span>
    </NavLink>
  )
}

function MoreMenuLink({ link, onNavigate }) {
  if (link.to) {
    return (
      <NavLink to={link.to} role="menuitem" onClick={onNavigate}>
        {link.label}
      </NavLink>
    )
  }
  return (
    <a href={link.href} role="menuitem">
      {link.label}
    </a>
  )
}

export function TopNav({ shellConfig = {}, tileSize, onTileSizeChange }) {
  const {
    isAdmin = false,
    showTrailers = false,
    showHelp = false,
    enableVr = false,
    username = '',
  } = shellConfig

  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const rootRef = useRef(null)
  const moreId = useId()
  const accountId = useId()

  const primaryLinks = getPrimaryLinks().filter((link) => link.id !== 'admin' || isAdmin)
  const moreLinks = getMoreLinks({ showTrailers, showHelp, enableVr })

  useEffect(() => {
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setMoreOpen(false)
        setAccountOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    function onResize() {
      if (window.matchMedia('(min-width: 768px)').matches) {
        setMobileOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header className="gt-topnav" ref={rootRef}>
      <Link className="gt-topnav__brand" to="/discover">
        GameTheca
      </Link>

      <button
        type="button"
        className="gt-topnav__hamburger"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <IconMenu />
      </button>

      <nav className={`gt-topnav__nav${mobileOpen ? ' is-open' : ''}`} aria-label="Primary">
        {primaryLinks.map((link) => (
          <PrimaryLink key={link.id} link={link} />
        ))}
        <div className="gt-topnav__spacer" />

        <div className="gt-topnav__tile-size">
          <TileSizeControl
            value={tileSize || shellConfig.tileSize || 'M'}
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
                {moreLinks.map((link) => (
                  <MoreMenuLink
                    key={link.id}
                    link={link}
                    onNavigate={() => setMoreOpen(false)}
                  />
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
                {ACCOUNT_LINKS.map((link) => (
                  <a key={link.id} href={link.href} role="menuitem">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </nav>
    </header>
  )
}
