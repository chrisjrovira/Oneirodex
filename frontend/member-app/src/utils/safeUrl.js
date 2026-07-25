/**
 * Allow only http(s) absolute URLs for external links (blocks javascript: etc.).
 */
export function safeHttpUrl(url) {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href
    }
  } catch {
    return null
  }

  return null
}
