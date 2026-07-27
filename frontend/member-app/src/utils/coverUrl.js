/**
 * Resolve a game cover URL for use in img src.
 * Passes through absolute /static/... or http(s) URLs; prefixes other paths with /static/.
 * Normalizes IGDB protocol-relative URLs (//images.igdb.com/...).
 */
export const DEFAULT_COVER_URL = '/static/newstyle/default_cover.jpg'

export function coverUrl(coverUrlPath) {
  if (!coverUrlPath) {
    return DEFAULT_COVER_URL
  }

  let path = String(coverUrlPath).trim()
  if (!path) {
    return DEFAULT_COVER_URL
  }

  if (path.startsWith('//')) {
    path = `https:${path}`
  }

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/static/')
  ) {
    return path
  }

  return `/static/${path.replace(/^\//, '')}`
}
