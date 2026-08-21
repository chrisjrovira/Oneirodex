/** Section-aware crumbs for the member top nav. */
export function getPrimaryLinks() {
  return [
    { id: 'discover', to: '/discover', label: 'Discover' },
    { id: 'library', to: '/library', label: 'Library' },
    { id: 'systems', to: '/systems', label: 'Systems' },
    { id: 'downloads', to: '/downloads', label: 'Downloads' },
    { id: 'favorites', to: '/favorites', label: 'Favorites' },
  ]
}

/** More menu targets match Flask routes from gametheca/templates/base.html url_for. */
export function getMoreLinks({ showTrailers, showHelp, enableVr, enableActivity = true } = {}) {
  const links = [
    { id: 'collections', to: '/collections', label: 'Collections' },
    { id: 'news', to: '/news', label: 'News' },
    { id: 'wishlist', to: '/wishlist', label: 'Wishlist' },
    { id: 'updates', to: '/updates', label: 'Updates' },
    { id: 'acquire', to: '/acquire', label: 'Acquire' },
    { id: 'playtime', to: '/playtime', label: 'Playtime' },
    { id: 'friends', action: 'open-friends', label: 'Friends' },
    { id: 'chat', action: 'open-chat', label: 'Chat' },
    { id: 'notifications', to: '/notifications', label: 'Notifications' },
    { id: 'report', to: '/report', label: 'Report' },
    { id: 'calendar', to: '/calendar', label: 'Release calendar' },
    { id: 'ownership', to: '/ownership', label: 'Ownership' },
    { id: 'big-picture', to: '/big-picture', label: 'Big Picture' },
  ]
  if (enableActivity) {
    // Keep its original position in the list rather than appending.
    const at = links.findIndex((l) => l.id === 'playtime')
    links.splice(at + 1, 0, { id: 'activity', to: '/activity', label: 'Activity' })
  }
  if (enableVr) links.push({ id: 'vr', to: '/vr', label: 'VR' })
  if (showTrailers) links.push({ id: 'trailers', to: '/trailers', label: 'Trailers' })
  if (showHelp) links.push({ id: 'help', to: '/help', label: 'Help' })
  return links
}

/**
 * The same destinations as `getMoreLinks`, grouped for display (UIR-5).
 *
 * A flat list of seventeen unlabelled links is the actual problem with the More
 * menu — not that it exists. The refresh plan originally said to fold these
 * into bar two and keep "one overflow, not two"; that was wrong. Bar two's
 * segmented control holds *sibling views of the current section*, and these are
 * destinations, not page actions. A seventeen-segment strip would be worse than
 * what it replaced.
 *
 * The rule the two bars actually encode:
 *
 *   bar one  — where do I go        (this menu)
 *   bar two  — what can I do here   (views, filters, page actions)
 *
 * Two overflows answering two different questions is correct. Two overflows
 * answering the same one was the thing worth fixing.
 *
 * Groups are derived from `getMoreLinks` rather than duplicating it, so a link
 * added there can never go missing here.
 */
export function getMoreGroups(options = {}) {
  const byId = new Map(getMoreLinks(options).map((link) => [link.id, link]))
  const groups = [
    { id: 'library', label: 'Library', ids: ['collections', 'wishlist', 'updates', 'acquire', 'ownership', 'calendar'] },
    { id: 'social', label: 'Social', ids: ['friends', 'chat', 'notifications', 'activity', 'news'] },
    { id: 'play', label: 'Play', ids: ['big-picture', 'playtime', 'vr', 'trailers'] },
    { id: 'support', label: 'Support', ids: ['report', 'help'] },
  ]

  const grouped = groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      links: group.ids.map((id) => byId.get(id)).filter(Boolean),
    }))
    .filter((group) => group.links.length > 0)

  // Anything not named above still has to appear somewhere: a link added to
  // getMoreLinks without being grouped must not silently vanish from the menu.
  const placed = new Set(grouped.flatMap((g) => g.links.map((l) => l.id)))
  const rest = [...byId.values()].filter((link) => !placed.has(link.id))
  if (rest.length > 0) {
    grouped.push({ id: 'other', label: 'More', links: rest })
  }

  return grouped
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
  '/report': { to: '/report', label: 'Report' },
  '/calendar': { to: '/calendar', label: 'Calendar' },
  '/ownership': { to: '/ownership', label: 'Ownership' },
  '/tokens': { to: '/tokens', label: 'API tokens' },
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

/**
 * Human title for a pathname (GT-B5).
 *
 * The top bar names the page now, so each page's own `<h1>` title card is a
 * second answer to a question already answered above it. Derived from the same
 * link tables the rail renders, so a destination cannot end up with a title in
 * the nav and a different one on the page.
 *
 * @param {string} pathname
 * @param {object} [options] same feature gates as getMoreLinks
 * @returns {string} '' when nothing matches — the bar then shows no title
 *   rather than guessing one from the URL.
 */
export function getPageTitle(pathname, options = {}) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/'
  const all = [...getPrimaryLinks(), ...getMoreLinks(options)]

  // Exact first: /collections must not lose to a prefix match on /collection.
  const exact = all.find((link) => link.to === path)
  if (exact) return exact.label

  const prefixed = all
    .filter((link) => link.to && path.startsWith(`${link.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  if (prefixed) return prefixed.label

  if (path.startsWith('/game_details')) return 'Game'
  return ''
}
