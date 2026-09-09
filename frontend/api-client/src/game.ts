import type { Requester } from './client.js'

/** Full details payload for the member SPA details page (`build_game_details_payload`). */
export interface GameDetails {
  uuid: string
  name: string
  [key: string]: unknown
}

export interface MoreFromResponse {
  games?: Array<{ uuid: string; name: string; [key: string]: unknown }>
  [key: string]: unknown
}

export interface EditionsResponse {
  editions?: Array<{ [key: string]: unknown }>
  [key: string]: unknown
}

export function createGameApi(request: Requester) {
  return {
    /** Full details JSON for one game (`GET /api/games/{uuid}/details`). */
    details(gameUuid: string, signal?: AbortSignal): Promise<GameDetails> {
      return request<GameDetails>(`/api/games/${encodeURIComponent(gameUuid)}/details`, { signal })
    },

    /** Other vault titles from the same developer / publisher. */
    moreFrom(gameUuid: string, signal?: AbortSignal): Promise<MoreFromResponse> {
      return request<MoreFromResponse>(`/api/games/${encodeURIComponent(gameUuid)}/more_from`, {
        signal,
      })
    },

    /** Every system this title exists on in the library, with per-core launchers. */
    editions(gameUuid: string, signal?: AbortSignal): Promise<EditionsResponse> {
      return request<EditionsResponse>(`/api/games/${encodeURIComponent(gameUuid)}/editions`, {
        signal,
      })
    },

    /** Screenshot list for the details gallery (`GET /api/game_screenshots/{uuid}`). */
    screenshots(gameUuid: string, signal?: AbortSignal): Promise<{ [key: string]: unknown }> {
      return request(`/api/game_screenshots/${encodeURIComponent(gameUuid)}`, { signal })
    },
  }
}

export type GameApi = ReturnType<typeof createGameApi>
