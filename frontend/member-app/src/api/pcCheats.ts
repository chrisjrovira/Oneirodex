/** PC cheat notes (`cheat_surface === 'pc_wand'`). Separate from RetroArch `.cht`. */
import { deleteJson, getJson, postJson } from './client'

function pcCheatsUrl(gameUuid: any, cheatId?: any) {
  const base = `/api/games/${gameUuid}/pc_cheats`
  return cheatId == null ? base : `${base}/${cheatId}`
}

export async function fetchPcCheats(gameUuid: any) {
  return (await getJson(pcCheatsUrl(gameUuid), { label: 'Could not load cheats' })) ?? {}
}

export async function createPcCheat(gameUuid: any, draft: any) {
  return (await postJson(pcCheatsUrl(gameUuid), draft, { label: 'Could not save' })) ?? {}
}

export async function deletePcCheat(gameUuid: any, cheatId: any) {
  return deleteJson(pcCheatsUrl(gameUuid, cheatId), undefined, { label: 'Could not remove' })
}
