export async function fetchDiscoverSections({ signal } = {}) {
  const response = await fetch('/api/discover/sections', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw new Error(`discover sections failed (${response.status})`)
  }
  const data = await response.json()
  return Array.isArray(data.sections) ? data.sections : []
}
