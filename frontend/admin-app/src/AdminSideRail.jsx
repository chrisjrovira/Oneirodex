import { useLocation } from 'react-router-dom'

import { ADMIN_NAV, railDestinations, resolveNavSection } from './navConfig'
import { RailIcon } from './railIcons'
import { resolveAdminPage } from './pages'

/**
 * Left navigation rail for the admin shell (GT-B2).
 *
 * Shares gt-shell.css with the member rail, so both halves of the product get
 * identical chrome from one stylesheet rather than two implementations that
 * drift — the same reasoning that made gt-appbar.css shared under UIR-4.
 *
 * Structure differs from the member rail on purpose. Members have 23
 * destinations and all of them fit; admin has roughly 60, and listing every one
 * permanently would trade an overflow menu for a wall of text. So the rail shows
 * the seven sections always, and expands only the *current* section's hub links
 * beneath it. Navigation stays one click for anything in the section you are
 * working in, and ⌘K covers the rest — which is what the palette is for.
 */
export function AdminSideRail({ railState = 'expanded', onCloseDrawer }) {
  const { pathname } = useLocation()
  const collapsed = railState === 'collapsed'
  const activeSection = resolveAdminPage(pathname)

  // Section membership comes from the hub links (W27-A5), so a sub-page keeps
  // its section selected instead of deselecting everything. The path-prefix
  // checks below remain as the fallback for anything no hub claims.
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

  // The rail is a container, not the nav landmark. The brand links to the
  // dashboard, so while it lived inside <nav> it was both announced as a
  // navigation item and matched first by any query for that href.
  return (
    <div className="gt-rail">
      <a className="gt-rail__brand" href="/admin/dashboard">
        {/* Painted from a mask, not loaded as an image, so it follows the
            selected theme — see .gt-brand-mark in gt-shell.css. An external SVG
            in an <img> cannot read the page's custom properties, which is why
            the mark stayed default green on every preset. */}
        <span className="gt-rail__mark gt-brand-mark" aria-hidden="true" />
        {/* Product name *and* role. Dropping "Oneirodex" here would make admin
            the only surface that does not identify the product, and the role
            badge is what tells you which half you are in. */}
        <span className="gt-rail__brand-text">
          Oneirodex
          <span className="gt-rail__brand-role">Admin</span>
        </span>
      </a>

      <nav className="gt-rail__nav" aria-label="Admin">
        <ul className="gt-rail__group gt-rail__list">
          {ADMIN_NAV.map((link) => {
            const active = isActiveSection(link)
            // Hub links for the section being viewed, so the rail deepens where
            // the work is rather than everywhere at once.
            // Destinations only — "Add one library" and the import anchors are
            // actions and live on the page (GT-B7).
            const children = active ? railDestinations(link.id) : []

            return (
              <li key={link.id}>
                <a
                  className={active ? 'gt-rail__link is-active' : 'gt-rail__link'}
                  href={link.path}
                  /* Which destination this row is, for the stylesheet.
                     gt-shell.css keys a per-destination hover animation off
                     this attribute. The member rail has always set it; the
                     admin rail never did, so admin icons sat still while the
                     identical rail in the member app animated — the same
                     stylesheet producing two different products. */
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

                {children.length && !collapsed ? (
                  <ul className="gt-rail__list gt-rail__sublist">
                    {children.map((child) => (
                      <li key={child.href}>
                        <a
                          className={
                            pathname === child.href.split('?')[0].split('#')[0]
                              ? 'gt-rail__link gt-rail__link--sub is-active'
                              : 'gt-rail__link gt-rail__link--sub'
                          }
                          href={child.href}
                          onClick={onCloseDrawer}
                        >
                          <span className="gt-rail__label">{child.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>

        <ul className="gt-rail__group gt-rail__list">
          <li className="gt-rail__group-label" aria-hidden="true">
            Leave admin
          </li>
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

      {/* Section marker, not decoration: with sub-links expanded the rail can
          scroll past its own active item, and this keeps the answer visible. */}
      <div className="gt-rail__footer">
        <span className="gt-rail__group-label">{activeSection}</span>
      </div>
    </div>
  )
}

export default AdminSideRail
