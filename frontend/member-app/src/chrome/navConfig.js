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
    { id: 'collections', to: '/collections', label: 'Collections' },
    { id: 'news', to: '/news', label: 'News' },
    { id: 'wishlist', to: '/wishlist', label: 'Wishlist' },
    { id: 'updates', to: '/updates', label: 'Updates' },
    { id: 'playtime', to: '/playtime', label: 'Playtime' },
    { id: 'calendar', to: '/calendar', label: 'Release calendar' },
    { id: 'ownership', to: '/ownership', label: 'Ownership' },
    { id: 'big-picture', to: '/big-picture', label: 'Big Picture' },
  ]
  if (enableVr) links.push({ id: 'vr', to: '/vr', label: 'VR' })
  if (showTrailers) links.push({ id: 'trailers', to: '/trailers', label: 'Trailers' })
  if (showHelp) links.push({ id: 'help', to: '/help', label: 'Help' })
  return links
}

