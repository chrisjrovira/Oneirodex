import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { AccountModal } from './AccountModal'
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

/* `modal` entries open an AccountModal panel instead of navigating.
   Only Logout still leaves the app, because it has to. Preferences keeps its
   own existing modal — it was already one, and it is Jinja-rendered. */
const ACCOUNT_LINKS = [
  { id: 'profile', href: '/settings_profile_view', label: 'Profile', modal: 'profile' },
  { id: 'preferences', href: '/settings_panel', label: 'Preferences', preferences: true },
  { id: 'tokens', href: '/tokens', label: 'API tokens', modal: 'tokens' },
  { id: 'password', href: '/settings_password', label: 'Change Password', modal: 'password' },
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
  const [accountModal, setAccountModal] = useState(null)
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

  /* Profile opens the modal directly.
     It used to open a right-hand drawer whose entire content was a list of
     links to the same five panels the modal already switches between — a menu
     in front of a menu, with the drawer adding nothing but a second click and a
     second visual language. The drawer is gone; every entry here lands on its
     panel. */
  function openAccountModal(panel) {
    return (event) => {
      event.preventDefault()
      setAccountOpen(false)
      setAccountModal(panel)
    }
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
        {/* Start group. Wrapped, and paired with an equally-growing actions
            group in gt-shell.css, so the centre slot lands on the *page's*
            midpoint rather than on the midpoint of whatever width the two sides
            happened to leave. Unwrapped, every side control that appeared or
            changed width nudged the view switcher off centre. */}
        <div className="gt-topbar__start">
          <button
            type="button"
            className="gt-cbtn gt-topbar__rail-toggle"
            aria-label="Toggle navigation"
            aria-expanded={railState !== 'collapsed'}
            onClick={onToggleRail}
          >
            <IconMenu />
          </button>

          {/* Lead slot: Filters, immediately after the rail toggle.
              The two form one control cluster — open the nav, narrow the list —
              and they are sized and aligned as one in gt-shell.css. Nothing goes
              between them: the page name used to, which pushed Filters to a
              different x position on every page and put a label in the middle of
              a pair of buttons. */}
          <div id={TOPBAR_LEAD_ID} className="gt-topbar__lead" />

          {/* The page name, but only when the rail is collapsed, and after the
              control cluster rather than inside it.
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
        </div>

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

          {/* Trail slot: how much is here, and it reads *before* the control
              that changes it. Both answer "how much am I looking at", so they
              belong together — but the count is a label and the slider is the
              instrument, and a label after its instrument reads as a value
              readout rather than as the page's result count. */}
          <div id={TOPBAR_TRAIL_ID} className="gt-topbar__trail" />

          <TileSizeControl
            value={tileSize || shellConfig.tileSize || '50'}
            onChange={onTileSizeChange}
            shellConfig={shellConfig}
          />

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
                  if (link.modal) {
                    // Still an <a href>: middle-click and "open in new tab"
                    // land on the server-rendered page, which is the fallback.
                    return (
                      <a
                        key={link.id}
                        href={link.href}
                        role="menuitem"
                        onClick={openAccountModal(link.modal)}
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

      <AccountModal panel={accountModal} onClose={() => setAccountModal(null)} />
    </>
  )
}

export default TopBar
