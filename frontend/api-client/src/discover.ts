import type { Requester } from './client.js'

export interface DiscoverRow {
  identifier: string
  title?: string
  games?: Array<{ uuid: string; name: string; [key: string]: unknown }>
  [key: string]: unknown
}

export interface DiscoverFeed {
  sections?: DiscoverRow[]
  rows?: DiscoverRow[]
  feed_token?: string
  zones?: Array<{ slug: string; [key: string]: unknown }>
  [key: string]: unknown
}

export interface DiscoverPins {
  pins: string[]
  hidden: string[]
  max_pins?: number
  available?: string[]
  [key: string]: unknown
}

export interface DiscoverRowWindow {
  offset?: number
  limit?: number
  feedToken?: string
  signal?: AbortSignal
}

export function createDiscoverApi(request: Requester) {
  return {
    /** The assembled Discover feed for this member (`GET /api/discover/sections`). */
    sections(signal?: AbortSignal): Promise<DiscoverFeed> {
      return request<DiscoverFeed>('/api/discover/sections', { signal })
    },

    /** One row, windowed — backs "see all" and row pagination. */
    row(identifier: string, opts: DiscoverRowWindow = {}): Promise<DiscoverRow> {
      const params = new URLSearchParams()
      if (opts.offset) params.set('offset', String(opts.offset))
      if (opts.limit) params.set('limit', String(opts.limit))
      if (opts.feedToken) params.set('feed_token', opts.feedToken)
      const qs = params.toString()
      return request<DiscoverRow>(
        `/api/discover/rows/${encodeURIComponent(identifier)}${qs ? `?${qs}` : ''}`,
        { signal: opts.signal },
      )
    },

    /** The feed narrowed to one zone (`GET /api/discover/zones/{slug}`). */
    zone(slug: string, signal?: AbortSignal): Promise<DiscoverFeed> {
      return request<DiscoverFeed>(`/api/discover/zones/${encodeURIComponent(slug)}`, { signal })
    },

    /** Virtual shelves for one genre (`GET /api/discover/hubs/genre/{genre}`). */
    genreHub(genre: string, signal?: AbortSignal): Promise<DiscoverFeed> {
      return request<DiscoverFeed>(`/api/discover/hubs/genre/${encodeURIComponent(genre)}`, {
        signal,
      })
    },

    /** Read this member's pinned / hidden row arrangement (`GET /api/discover/pins`). */
    getPins(signal?: AbortSignal): Promise<DiscoverPins> {
      return request<DiscoverPins>('/api/discover/pins', { signal })
    },

    /**
     * Update pins and/or hidden rows (`PUT /api/discover/pins`). Each field is
     * optional — send only the half that changed.
     */
    setPins(body: { pins?: string[]; hidden?: string[] }): Promise<DiscoverPins> {
      return request<DiscoverPins>('/api/discover/pins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
  }
}

export type DiscoverApi = ReturnType<typeof createDiscoverApi>
