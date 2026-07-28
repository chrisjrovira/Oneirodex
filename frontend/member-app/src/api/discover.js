export async function fetchDiscoverSections({ signal } = {}) {
  const response = await fetch('/api/discover/sections', {
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`discover sections failed (${response.status})`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('discover sections returned non-JSON (session expired or server error)')
  }
  const data = await response.json()
  return Array.isArray(data.sections) ? data.sections : []
}
