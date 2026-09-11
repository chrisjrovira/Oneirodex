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
import { errorFromResponse } from '@oneirodex/ui'

export async function fetchLibraryPlatforms({ signal }: LooseProps = {}) {
  const response = await fetch('/api/library_platforms?include_completion=1', {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'library_platforms')
  }
  return response.json()
}

export async function fetchLicensedCatalog({ libraryPlatform, signal }: LooseProps = {}) {
  const params = new URLSearchParams({ library_platform: libraryPlatform })
  const response = await fetch(`/api/licensed-catalog?${params}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'licensed-catalog')
  }
  return response.json()
}

export async function fetchSetCompletion({ libraryPlatform, region, signal }: LooseProps = {}) {
  const params = new URLSearchParams({
    library_platform: libraryPlatform,
    region,
  })
  const response = await fetch(`/api/set-completion?${params}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'set-completion')
  }
  return response.json()
}
