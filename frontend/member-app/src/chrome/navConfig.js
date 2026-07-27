/** Section-aware crumbs for the member top nav. */
export function getPrimaryLinks() {
  return [
    { id: 'discover', to: '/discover', label: 'Discover' },
    { id: 'library', to: '/library', label: 'Library' },
    { id: 'systems', to: '/systems', label: 'Systems' },
    { id: 'downloads', to: '/downloads', label: 'Downloads' },
    { id: 'favorites', to: '/favorites', label: 'Favorites' },
    { id: 'admin', href: '/admin/dashboard', label: 'Admin', external: true },
  ]
}

/** More menu targets match Flask routes from gametheca/templates/base.html url_for. */
export function getMoreLinks({ showTrailers, showHelp, enableVr } = {}) {
  const links = [
    { id: 'collections', to: '/collections', label: 'Collections' },
    { id: 'news', to: '/news', label: 'News' },
    { id: 'wishlist', to: '/wishlist', label: 'Wishlist' },
    { id: 'updates', to: '/updates', label: 'Updates' },
    { id: 'acquire', to: '/acquire', label: 'Acquire' },
    { id: 'playtime', to: '/playtime', label: 'Playtime' },
    { id: 'activity', to: '/activity', label: 'Activity' },
    { id: 'friends', to: '/social-companion', label: 'Friends window' },
    { id: 'chat', to: '/chat', label: 'Chat' },
    { id: 'notifications', to: '/notifications', label: 'Notifications' },
    { id: 'report', to: '/report', label: 'Report issue' },
    { id: 'calendar', to: '/calendar', label: 'Release calendar' },
    { id: 'ownership', to: '/ownership', label: 'Ownership' },
    { id: 'big-picture', to: '/big-picture', label: 'Big Picture' },
  ]
  if (enableVr) links.push({ id: 'vr', to: '/vr', label: 'VR' })
  if (showTrailers) links.push({ id: 'trailers', to: '/trailers', label: 'Trailers' })
  if (showHelp) links.push({ id: 'help', to: '/help', label: 'Help' })
  return links
}

const SECTION_HOME = {
  '/discover': { to: '/discover', label: 'Home' },
  '/library': { to: '/library', label: 'Library home' },
  '/systems': { to: '/systems', label: 'Systems home' },
  '/downloads': { to: '/downloads', label: 'Downloads' },
  '/favorites': { to: '/favorites', label: 'Favorites' },
  '/collections': { to: '/collections', label: 'Collections' },
  '/news': { to: '/news', label: 'News' },
  '/wishlist': { to: '/wishlist', label: 'Wishlist' },
  '/updates': { to: '/updates', label: 'Updates' },
  '/acquire': { to: '/acquire', label: 'Acquire' },
  '/playtime': { to: '/playtime', label: 'Playtime' },
  '/activity': { to: '/activity', label: 'Activity' },
  '/social-companion': { to: '/social-companion', label: 'Friends' },
  '/chat': { to: '/chat', label: 'Chat' },
  '/notifications': { to: '/notifications', label: 'Notifications' },
  '/report': { to: '/report', label: 'Report issue' },
  '/calendar': { to: '/calendar', label: 'Calendar' },
  '/ownership': { to: '/ownership', label: 'Ownership' },
  '/big-picture': { to: '/big-picture', label: 'Big Picture' },
  '/vr': { to: '/vr', label: 'VR' },
  '/trailers': { to: '/trailers', label: 'Trailers' },
  '/help': { to: '/help', label: 'Help' },
}

/**
 * Context links for the current pathname: Home (discover), section hub, Admin.
 * @param {string} pathname
 * @param {{ isAdmin?: boolean }} [opts]
 */
export function getContextLinks(pathname, { isAdmin = false } = {}) {
  const path = (pathname || '/').replace(/\/$/, '') || '/'
  const links = [{ id: 'home', to: '/discover', label: 'Home' }]

  const section =
    SECTION_HOME[path] ||
    Object.entries(SECTION_HOME).find(([prefix]) => path.startsWith(prefix))?.[1]

  if (section && section.to !== '/discover') {
    links.push({ id: 'section', to: section.to, label: section.label })
  }

  if (isAdmin) {
    links.push({
      id: 'admin-home',
      href: '/admin/dashboard',
      label: 'Admin',
      external: true,
    })
  }

  return links
}
