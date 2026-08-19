import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { AccountPanel } from './AccountPanel'
import { TOPBAR_LEAD_ID, TOPBAR_SLOT_ID, TOPBAR_TRAIL_ID } from './ContextBar'
import { IconMenu, IconUser } from './icons'
import { TileSizeControl } from './TileSizeControl'
import { getPageTitle } from './navConfig'
import { openPreferencesModal } from '../api/preferences'

/**
 * Bar one, reduced to page scope (GT-B2).
 *
 * The rail owns identity and destinations now, so everything this bar used to
 * carry for navigation is gone: brand, the five primary links, the breadcrumb
 * strip, and the eighteen-item "More" dropdown. What remains is the set of
 * things that belong to the *current page* rather than to the app — search,
 * tile size, account — plus the control that opens the rail on mobile.
 *
 * Deliberately not a a wrapper around TopNav: keeping the old component and
 * hiding parts of it with props is how a component ends up with four layout
 * modes and no clear owner. TopNav stays in the tree only until the Jinja
 * pages that still render its markup are migrated.
 */

const ACCOUNT_LINKS = [
  { id: 'profile', href: '#account-profile', label: 'Profile', profilePanel: true },
  { id: 'preferences', href: '/settings_panel', label: 'Preferences', preferences: true },
  { id: 'tokens', to: '/tokens', label: 'API tokens' },
  { id: 'password', href: '/settings_password', label: 'Change Password' },
  { id: 'logout', href: '/logout', label: 'Logout' },
]

function commandPaletteHint() {
  if (typeof navigator === 'undefined') return 'Ctrl+K'
  const platform = navigator.platform || ''
  const uaData = navigator.userAgentData
  const isMac = uaData?.platform === 'macOS' || /Mac|iPhone|iPad|iPod/i.test(platform)
  return isMac ? '⌘K' : 'Ctrl+K'
}

export function TopBar({
  shellConfig = {},
  tileSize,
  onTileSizeChange,
  onOpenCommandPalette,
  onToggleRail,
  railState = 'expanded',
  views = null,
}) {
  const { username = '', showTrailers, showHelp, enableVr, enableActivity } = shellConfig
  const { pathname } = useLocation()
  const pageTitle = getPageTitle(pathname, { showTrailers, showHelp, enableVr, enableActivity })
  const [accountOpen, setAccountOpen] = useState(false)
  const [profilePanelOpen, setProfilePanelOpen] = useState(false)
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

  async function handlePreferencesClick(event) {
    event.preventDefault()
    setAccountOpen(false)
    try {
      await openPreferencesModal()
    } catch {
      window.location.href = '/settings_panel'
    }
  }

  function handleProfileClick(event) {
    event.preventDefault()
    setAccountOpen(false)
    setProfilePanelOpen(true)
  }

  return (
    <>
      <header className="gt-topbar" ref={rootRef}>
        {/* The rail has three states and this button drives all of them, so
            `=== 'open'` was the wrong test: 'open' is the mobile drawer only,
            which left aria-expanded permanently false on desktop — announcing a
            collapsed rail while it sat there expanded with its labels showing.
            Shown is 'open' or 'expanded'; the one state that is not is
            'collapsed'. partials/topbar.html has always had this right. */}
        <button
          type="button"
          className="gt-cbtn gt-topbar__rail-toggle"
          aria-label="Toggle navigation"
          aria-expanded={railState !== 'collapsed'}
          onClick={onToggleRail}
        >
          <IconMenu />
        </button>

        {/* The page name, but only when the rail is collapsed.
            UIR-1 removed it from the bar on the grounds that bar two's view
            switcher named the section; GT-B5 put it back because the rail owns
            destinations now. Both were right for one rail state each: an
            expanded rail already shows which entry is active, in words, a few
            pixels to the left — so the bar's copy is a second answer to a
            question nothing asked. Collapsed, the rail is a column of icons and
            the bar is the only place the answer exists. */}
        {railState === 'collapsed' && pageTitle ? (
          <span className="gt-topbar__section">{pageTitle}</span>
        ) : null}

        {/* Lead slot: Filters. Narrowing a list is the first thing you do to
            it, so it sits with the rail toggle rather than drifting to
            wherever the view labels ended. */}
        <div id={TOPBAR_LEAD_ID} className="gt-topbar__lead" />

        {views ? <div className="gt-topbar__views">{views}</div> : null}

        {/* Centre slot: the page's own views and actions. Centred and growing
            outward from the middle, so adding a view keeps the strip balanced
            instead of pushing everything right. ContextBar portals here. */}
        <div id={TOPBAR_SLOT_ID} className="gt-topbar__page" />

        <div className="gt-topbar__actions">
          {/* The search field is gone from the bar (GT-B16).
              Typing into the library's own filter is how you search a library,
              and a second search affordance in the chrome bought nothing while
              costing permanent width. ⌘K still opens the palette — the shortcut
              is listed in the account menu so it stays discoverable. */}

          <TileSizeControl
            value={tileSize || shellConfig.tileSize || '50'}
            onChange={onTileSizeChange}
            shellConfig={shellConfig}
          />

          {/* Trail slot: how much is here. After the size control, not before —
              both answer "how much am I looking at", and the count is the
              readout of what the slider just changed. */}
          <div id={TOPBAR_TRAIL_ID} className="gt-topbar__trail" />

          <div className="gt-topnav__dropdown">
            <button
              type="button"
              className="gt-cbtn"
              aria-expanded={accountOpen}
              aria-controls={accountId}
              aria-label="Account menu"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <IconUser />
              <span>{username || 'Account'}</span>
            </button>
            {accountOpen ? (
              <div className="gt-topnav__dropdown-panel" id={accountId} role="menu">
                {username ? <div className="gt-topnav__username">{username}</div> : null}
                {/* Only remaining home for the palette hint now the bar's
                    search button is gone. CommandPalette binds ⌘K itself, so
                    this is discoverability, not the trigger. */}
                <button
                  type="button"
                  role="menuitem"
                  className="gt-topnav__palette-hint"
                  onClick={() => {
                    setAccountOpen(false)
                    onOpenCommandPalette?.()
                  }}
                >
                  Search everything <kbd>{paletteHint}</kbd>
                </button>
                {ACCOUNT_LINKS.map((link) => {
                  if (link.profilePanel) {
                    return (
                      <a key={link.id} href={link.href} role="menuitem" onClick={handleProfileClick}>
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
                        onClick={() => setAccountOpen(false)}
                      >
                        {link.label}
                      </NavLink>
                    )
                  }
                  return (
                    <a
                      key={link.id}
                      href={link.href}
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                    >
                      {link.label}
                    </a>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <AccountPanel
        open={profilePanelOpen}
        onClose={() => setProfilePanelOpen(false)}
        shellConfig={shellConfig}
      />
    </>
  )
}

export default TopBar
