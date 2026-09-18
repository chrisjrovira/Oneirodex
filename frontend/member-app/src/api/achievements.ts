import { createAchievementsApi, type GameAchievementsResponse } from '@oneirodex/api-client'

import { memberResource, withMemberError } from './client'

export type {
  Achievement,
  AchievementProgress,
  GameAchievementsResponse,
} from '@oneirodex/api-client'

const achievements = memberResource(createAchievementsApi)

export async function fetchGameAchievements(
  gameUuid: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<GameAchievementsResponse> {
  return withMemberError(achievements.forGame(gameUuid, signal), 'achievements')
}

export async function fetchMyRetroAchievements({ signal }: { signal?: AbortSignal } = {}) {
  return withMemberError(achievements.me(signal), 'retroachievements profile')
}

export async function saveRetroAchievementsUsername(raUsername: string) {
  return withMemberError(achievements.setUsername(raUsername), 'save retroachievements username')
}
