/** Tracked mods per game (MOD-3) and the read-only catalogue browse (INSP-22). */
import { deleteJson, getJson, patchJson, postJson } from './client'

export interface ModRow {
  id: string
  name: string
  version: string
  source_url: string
  url?: string
  notes: string
  enabled: boolean
  load_order: number
  /** INSP-36 — loader slug the mod needs; `''` when unsaid. */
  loader: string
}

export interface ModPack {
  enabled: boolean
  game_uuid?: string
  default_loader: string
  loaders: string[]
  mods: ModRow[]
}

export interface ModHit {
  name: string
  url: string
  source: string
  version: string
  loader: string
  summary: string
  author: string
  downloads: number | null
  updated: string | null
  categories: string[]
}

export interface ModCatalogResult {
  source: string
  status: 'ok' | 'unavailable' | 'unknown_source'
  hits: ModHit[] | null
  count?: number
  note?: string
}

export interface ModDraft {
  name: string
  version?: string
  source_url?: string
  notes?: string
  loader?: string
  enabled?: boolean
}

export const MOD_CATALOG_SOURCES: { id: string; label: string }[] = [
  { id: 'thunderstore', label: 'Thunderstore' },
  { id: 'modrinth', label: 'Modrinth' },
  { id: 'gamebanana', label: 'GameBanana' },
  { id: 'nexus', label: 'Nexus Mods' },
]

function modsUrl(gameUuid: string, tail = '') {
  return `/api/games/${encodeURIComponent(gameUuid)}/mods${tail}`
}

export async function fetchMods(gameUuid: string): Promise<ModPack> {
  const data = (await getJson(modsUrl(gameUuid), { label: 'Could not load mods' })) ?? {}
  return {
    enabled: data.enabled !== false,
    game_uuid: data.game_uuid,
    default_loader: String(data.default_loader || ''),
    loaders: Array.isArray(data.loaders) ? data.loaders.map(String) : [],
    mods: Array.isArray(data.mods) ? (data.mods as ModRow[]) : [],
  }
}

export async function createMod(gameUuid: string, draft: ModDraft): Promise<ModRow> {
  const data = await postJson(modsUrl(gameUuid), draft, { label: 'Could not add the mod' })
  return data?.mod as ModRow
}

export async function updateMod(gameUuid: string, modId: string, patch: Partial<ModDraft>) {
  const data = await patchJson(modsUrl(gameUuid, `/${encodeURIComponent(modId)}`), patch, {
    label: 'Could not update the mod',
  })
  return data?.mod as ModRow
}

export async function deleteMod(gameUuid: string, modId: string) {
  return deleteJson(modsUrl(gameUuid, `/${encodeURIComponent(modId)}`), undefined, {
    label: 'Could not remove the mod',
  })
}

export async function setDefaultLoader(gameUuid: string, loader: string) {
  return patchJson(
    modsUrl(gameUuid, '/pack'),
    { default_loader: loader },
    { label: 'Could not save the loader' },
  )
}

export async function browseModCatalog(
  gameUuid: string,
  source: string,
  query = '',
  { signal }: { signal?: AbortSignal } = {},
): Promise<ModCatalogResult> {
  const params = new URLSearchParams({ source })
  if (query) params.set('q', query)
  const data =
    (await getJson(modsUrl(gameUuid, `/catalog?${params}`), {
      signal,
      label: 'Could not browse the catalogue',
    })) ?? {}
  return {
    source: String(data.source || source),
    status: (data.status as ModCatalogResult['status']) || 'unavailable',
    hits: Array.isArray(data.hits) ? (data.hits as ModHit[]) : null,
    count: typeof data.count === 'number' ? data.count : undefined,
    note: data.note ? String(data.note) : undefined,
  }
}
