const LIBRARY_FILTERS_COOKIE = 'libraryFilters'

export function readLibraryFilters() {
  const prefix = `${LIBRARY_FILTERS_COOKIE}=`
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))

  if (!cookie) {
    return {}
  }

  try {
    const value = JSON.parse(decodeURIComponent(cookie.slice(prefix.length)))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}
  } catch {
    return {}
  }
}

export function writeLibraryFilters(filters) {
  const value = encodeURIComponent(JSON.stringify(filters))
  document.cookie = `${LIBRARY_FILTERS_COOKIE}=${value}; path=/; SameSite=Lax`
}
