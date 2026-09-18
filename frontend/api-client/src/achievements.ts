import type { Requester } from './client.js'

/** One achievement in a matched set, with this member's state when known. */
export interface Achievement {
  id: number
  title: string
  description: string
  points: number
  badge_url: string
  earned: boolean
  earned_hardcore: boolean
  display_order: number
}

/** This member's progress on a set — absent when they gave no RA username. */
export interface AchievementProgress {
  username: string
  total: number
  earned: number
  earned_hardcore: number
  completion: string
  completion_hardcore: string
  achievements: Achievement[]
}

export interface GameAchievementsResponse {
  /** True only for a matched set that actually carries achievements (R2). */
  supports_achievements: boolean
  ra_game_id: number | null
  ra_achievements: number
  ra_url: string | null
  /** Whether the server has RetroAchievements credentials at all. */
  configured: boolean
  ra_username: string | null
  /** Always false: browser play has no rcheevos runtime, so nothing unlocks here. */
  unlocks_here: boolean
  me: AchievementProgress | null
}

export interface MyRetroAchievements {
  ra_username: string | null
  configured: boolean
}

/**
 * RetroAchievements, read-only. The member surface shows a matched set and
 * (given a username) their own progress; matching itself is an admin action.
 */
export function createAchievementsApi(request: Requester) {
  return {
    forGame(gameUuid: string, signal?: AbortSignal): Promise<GameAchievementsResponse> {
      return request<GameAchievementsResponse>(
        `/api/games/${encodeURIComponent(gameUuid)}/achievements`,
        { signal },
      )
    },

    me(signal?: AbortSignal): Promise<MyRetroAchievements> {
      return request<MyRetroAchievements>('/api/me/retroachievements', { signal })
    },

    setUsername(raUsername: string): Promise<MyRetroAchievements> {
      return request<MyRetroAchievements>('/api/me/retroachievements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ra_username: raUsername }),
      })
    },
  }
}

export type AchievementsApi = ReturnType<typeof createAchievementsApi>
