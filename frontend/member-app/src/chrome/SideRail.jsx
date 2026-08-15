import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'


import { RailIcon } from './railIcons'
import { getMoreGroups, getPrimaryLinks } from './navConfig'

/**
 * Left navigation rail for the member shell (GT-B2).
 *
 * Replaces the five-slot top bar plus its eighteen-item "More" menu. Every
 * destination is present and grouped; nothing is behind an overflow. The groups
 * are the ones getMoreGroups already defined for the old menu — that grouping
 * was sound, it was just being applied to a popover that hid it.
 *
 * Styling lives entirely in the theme's gt-shell.css so the admin shell and
 * legacy Jinja pages render the same rail from the same source (the UIR-4
 * pattern). This component contributes no CSS of its own.
 */
export function SideRail({
  shellConfig = {},
  railState = 'expanded',
  onNavigate,
  onCloseDrawer,
  footer = null,
}) {
  const {
    isAdmin = false,
    showTrailers = false,
    showHelp = false,
    enableVr = false,
    enableActivity = true,
    markSrc = '/static/newstyle/gametheca_mark.svg',
  } = shellConfig

  const primary = getPrimaryLinks()
  const groups = getMoreGroups({ showTrailers, showHelp, enableVr, enableActivity })
  const collapsed = railState === 'collapsed'
  const { pathname } = useLocation()
  const [filtersHidden, setFiltersHidden] = useState(false)

  // Clicking Library while already on Library used to be a no-op. It is the
  // obvious place to put the filter panel's show/hide, and it is where it used
  // to live before the panel moved into the rail (W27-A6). Hiding the slot
  // rather than the filters themselves keeps LibraryApp's portal working — the
  // rail never has to know what a filter is.
  const onLibraryClick = (event) => {
    if (pathname === '/library' || pathname.startsWith('/library/')) {
      event.preventDefault()
      setFiltersHidden((hidden) => !hidden)
      return
    }
    onCloseDrawer?.()
  }

  function renderLink(link) {

    // Action entries (Chat, Friends) open panels rather than routing. They are
    // still destinations from the member's point of view, so they belong in the
    // rail next to the routed ones rather than in a separate control.
    if (link.action) {
      return (
        <li key={link.id}>
          <button
            type="button"
            className="gt-rail__link"
            onClick={() => {
              onNavigate?.(link)
              onCloseDrawer?.()
            }}
          >
            <span className="gt-rail__icon" aria-hidden="true">
              <RailIcon name={link.id} />
            </span>
            <span className="gt-rail__label">{link.label}</span>
          </button>
        </li>
      )
    }

    return (
      <li key={link.id}>
        <NavLink
          to={link.to}
          className={({ isActive }) =>
            isActive ? 'gt-rail__link is-active' : 'gt-rail__link'
          }
          aria-expanded={link.id === 'library' ? !filtersHidden : undefined}
          onClick={link.id === 'library' ? onLibraryClick : onCloseDrawer}
          // Collapsed hides the visible label, so the title attribute is the
          // only thing left that names the target on hover.
          title={collapsed ? link.label : undefined}
        >
          <span className="gt-rail__icon" aria-hidden="true">
            <RailIcon name={link.id} />
          </span>
          <span className="gt-rail__label">{link.label}</span>
        </NavLink>
      </li>
    )
  }

  // Container, not the landmark — see AdminSideRail: a brand link inside
  // <nav> is announced as a destination and shadows real ones in queries.
  return (
    <div className="gt-rail">
      <a className="gt-rail__brand" href="/discover">
        <img className="gt-rail__mark" src={markSrc} alt="" width={22} height={22} />
        <span className="gt-rail__brand-text">GameTheca</span>
      </a>

      <nav className="gt-rail__nav" aria-label="Primary">
        <ul className="gt-rail__group gt-rail__list">
          {primary.map((link) => (
            <li key={link.id} className="gt-rail__item">
              <ul className="gt-rail__list">{renderLink(link)}</ul>
              {/* Slot for the active section's own controls (GT-B4).
                  Library filters used to be a second 17.5rem aside next to the
                  rail — two left-hand panels, which is what read as broken.
                  LibraryApp portals its FilterBar in here instead, so filters
                  live under the destination they belong to and the content pane
                  gets the width back. A portal rather than props: the shell
                  should not have to know what a filter is. */}
              {link.id === 'library' ? (
                <div
                  id="gt-rail-slot"
                  className={`gt-rail__slot${filtersHidden ? ' is-hidden' : ''}`}
                />
              ) : null}
            </li>
          ))}
        </ul>

        {groups.map((group) => (
          <ul className="gt-rail__group gt-rail__list" key={group.id}>
            <li className="gt-rail__group-label" aria-hidden="true">
              {group.label}
            </li>
            {group.links.map(renderLink)}
          </ul>
        ))}

        {isAdmin ? (
          <ul className="gt-rail__group gt-rail__list">
            <li className="gt-rail__group-label" aria-hidden="true">
              Manage
            </li>
            <li>
              {/* Full page load: admin is a separate bundle, not a route here. */}
              <a
                className="gt-rail__link"
                href="/admin/dashboard"
                title={collapsed ? 'Admin' : undefined}
              >
                <span className="gt-rail__icon" aria-hidden="true">
                  <RailIcon name="admin" />
                </span>
                <span className="gt-rail__label">Admin</span>
              </a>
            </li>
          </ul>
        ) : null}
      </nav>

      {/* Rail footer (W27-A1). The page up/down pair lives here rather than
          floating over the content pane: the rail already has the space, and
          floating it meant a control permanently sitting on top of the thing it
          scrolls. */}
      {footer ? (
        <div className="gt-rail__footer gt-rail__footer--controls">{footer}</div>
      ) : null}
    </div>
  )
}

export default SideRail
