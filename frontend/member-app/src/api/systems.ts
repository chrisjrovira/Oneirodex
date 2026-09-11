/**
 * Systems surface reads: the platform grid and its two per-platform reports
 * (licensed catalog, reference-set completion).
 *
 * These were three module-level `fetch` helpers inlined in SystemsPage,
 * LicensedCatalogPage and SetCompletionPage. Consolidated here in wave B1.4 so
 * every member `/api/...` read goes through `src/api/` and reports failures via
 * the shared envelope builder — `errorFromResponse` keeps `status` (the 404
 * "no reference set" branch on SetCompletionPage depends on it) and
 * `error_code` on the Error.
 */
import { getJson } from './client'

export async function fetchLibraryPlatforms({ signal }: LooseProps = {}) {
  return getJson('/api/library_platforms?include_completion=1', {
    signal,
    label: 'library_platforms',
  })
}

export async function fetchLicensedCatalog({ libraryPlatform, signal }: LooseProps = {}) {
  const params = new URLSearchParams({ library_platform: libraryPlatform })
  return getJson(`/api/licensed-catalog?${params}`, { signal, label: 'licensed-catalog' })
}

export async function fetchSetCompletion({ libraryPlatform, region, signal }: LooseProps = {}) {
  const params = new URLSearchParams({
    library_platform: libraryPlatform,
    region,
  })
  return getJson(`/api/set-completion?${params}`, { signal, label: 'set-completion' })
}
