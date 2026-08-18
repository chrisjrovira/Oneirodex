import { Link, NavLink } from 'react-router-dom'

/**
 * Bar one — identity and destination (UIR-1).
 *
 * Deliberately thin. It holds the mark, a short list of primary destinations,
 * search and the account control, and nothing else. Everything page-specific
 * belongs in `ContextBar` below it; the whole point of the two-bar split is
 * that this row never changes as you move around.
 *
 * Styles come from the shared `gt-appbar.css` theme asset rather than a CSS
 * import, so Jinja admin can render the same markup (UIR-4).
 */

export function AppBar({
  links = [],
  brandTo = '/discover',
  brandLabel = 'GameTheca',
  tools = null,
  onNavigate,
}) {
  return (
    <header className="gt-appbar">
      <Link className="gt-appbar__brand" to={brandTo} onClick={onNavigate}>
        {/* Painted from a mask so it follows the theme — see .gt-brand-mark. */}
        <span className="gt-appbar__mark gt-brand-mark" aria-hidden="true" />
        <span>{brandLabel}</span>
      </Link>

      <nav className="gt-appbar__nav" aria-label="Primary">
        {links.map((link) => (
          <NavLink
            key={link.id}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `gt-appbar__link${isActive ? ' is-active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="gt-appbar__spacer" />
      {tools ? <div className="gt-appbar__tools">{tools}</div> : null}
    </header>
  )
}
