export function getPrimaryLinks() {
  return [
    { id: 'discover', to: '/discover', label: 'Discover' },
    { id: 'library', to: '/library', label: 'Library' },
    { id: 'downloads', to: '/downloads', label: 'Downloads' },
    { id: 'favorites', to: '/favorites', label: 'Favorites' },
    { id: 'admin', href: '/admin/dashboard', label: 'Admin', external: true },
  ]
}

/** More menu targets match Flask routes from gametheca/templates/base.html url_for. */
export function getMoreLinks({ showTrailers, showHelp, enableVr } = {}) {
  const links = [
    { id: 'collections', href: '/collections', label: 'Collections' },
    { id: 'news', href: '/news', label: 'News' },
    { id: 'wishlist', href: '/wishlist', label: 'Wishlist' },
    { id: 'updates', href: '/updates', label: 'Updates' },
    { id: 'playtime', href: '/playtime', label: 'Playtime' },
    { id: 'calendar', href: '/calendar', label: 'Release calendar' },
    { id: 'ownership', href: '/ownership', label: 'Ownership' },
    { id: 'big-picture', href: '/big-picture', label: 'Big Picture' },
  ]
  if (enableVr) links.push({ id: 'vr', href: '/vr', label: 'VR' })
  if (showTrailers) links.push({ id: 'trailers', href: '/trailers', label: 'Trailers' })
  if (showHelp) links.push({ id: 'help', href: '/help', label: 'Help' })
  return links
}