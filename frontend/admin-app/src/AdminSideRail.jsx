import { useLocation } from 'react-router-dom'

import { ADMIN_NAV, resolveNavSection } from './navConfig'
import { RailIcon } from './railIcons'

/**
 * Left navigation rail for the admin shell (GT-B2).
 *
 * Shares gt-shell.css with the member rail. Destinations are the seven
 * sections plus Library / Log out. Hub pages already list their own tabs and
 * tools — expanding those again under the active section duplicated a page
 * that already owns them.
 */
export function AdminSideRail({ railState = 'expanded', onCloseDrawer }) {
  const { pathname } = useLocation()
  const collapsed = railState === 'collapsed'
  const ownedSection = resolveNavSection(pathname)

  function isActiveSection(link) {
    if (ownedSection) {
      return link.id === ownedSection
    }
    if (link.id === 'content') {
      return (
        pathname.includes('announcement') ||
        pathname.includes('discovery') ||
        pathname.includes('newsletter') ||
        pathname.includes('attract')
      )
    }
    if (link.path === '/admin/dashboard') {
      return pathname === '/admin/dashboard' || pathname === '/admin' || pathname === '/admin/'
    }
    const base = link.path.split('?')[0]
    return pathname === base || pathname.startsWith(`${base}/`)
  }

  return (
    <div className="gt-rail">
      <a className="gt-rail__brand gt-rail__brand--mark-only" href="/admin/dashboard">
        {/* Painted from a mask, not loaded as an image — see .gt-brand-mark. */}
        <span className="gt-rail__mark gt-brand-mark" aria-hidden="true" />
        {/* Hidden wordmark: accessible name only. The glyph is the brand. */}
        <span className="gt-rail__brand-text">Oneirodex Admin</span>
      </a>

      <nav className="gt-rail__nav" aria-label="Admin">
        <ul className="gt-rail__group gt-rail__list">
          {ADMIN_NAV.map((link) => {
            const active = isActiveSection(link)

            return (
              <li key={link.id}>
                <a
                  className={active ? 'gt-rail__link is-active' : 'gt-rail__link'}
                  href={link.path}
                  data-rail-item={link.id}
                  onClick={onCloseDrawer}
                  title={collapsed ? link.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="gt-rail__icon" aria-hidden="true">
                    <RailIcon name={link.id} />
                  </span>
                  <span className="gt-rail__label">{link.label}</span>
                </a>
              </li>
            )
          })}
        </ul>

        <ul className="gt-rail__group gt-rail__list">
          <li>
            <a
              className="gt-rail__link"
              data-rail-item="library"
              href="/library"
              title={collapsed ? 'Library' : undefined}
            >
              <span className="gt-rail__icon" aria-hidden="true">
                <RailIcon name="library" />
              </span>
              <span className="gt-rail__label">Library</span>
            </a>
          </li>
          <li>
            <a
              className="gt-rail__link"
              data-rail-item="logout"
              href="/logout"
              title={collapsed ? 'Log out' : undefined}
            >
              <span className="gt-rail__icon" aria-hidden="true">
                <RailIcon name="logout" />
              </span>
              <span className="gt-rail__label">Log out</span>
            </a>
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default AdminSideRail
