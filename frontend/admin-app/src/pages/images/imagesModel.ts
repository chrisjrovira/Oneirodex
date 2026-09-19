/* Types, constants and pure helpers moved out of ImagesPage (v11 cycle, H-D.2), unchanged. */

export interface ImageRow {
  id: string
  game_uuid?: string
  game_name?: string
  status?: string
  is_downloaded?: boolean
  file_missing?: boolean
  local_url?: string
  image_type?: string
  failure_reason?: string
  last_error?: string
}

export interface ImageGroup {
  name: string
  uuid: string
  items: ImageRow[]
}

export interface GameHit {
  uuid: string
  name?: string
}

export interface LibraryOption {
  uuid: string
  name?: string
}

export interface Option {
  id: string
  label?: string
}

export interface MissingCoverGame {
  uuid: string
  name?: string
  score?: number
  issues?: { code?: string }[]
}

/** Backend policy for “best available” mass cover apply. */
export const BEST_AVAILABLE_POLICY = 'sgdb_then_igdb_then_generate'

/** Store/service labels useful as covers/batch `service` filters (library-name match). */
export const SERVICE_SOURCE_IDS = new Set(['steam', 'gog', 'epic', 'itch', 'meta_quest'])

/** Locked image kind taxonomy (BE-DET-10) — keep in sync with oneirodex/utils/image_kinds.py. */
export const IMAGE_KIND_OPTIONS = [
  { id: 'cover', label: 'Covers' },
  { id: 'screenshot', label: 'Screenshots' },
  { id: 'box', label: 'Box' },
  { id: 'cart', label: 'Cart/disc label' },
  { id: 'disc', label: 'Disc' },
  { id: 'logo', label: 'Logo' },
  { id: 'hero', label: 'Hero' },
  { id: 'fanart', label: 'Fan art' },
]

export function groupByGame(images: ImageRow[]): ImageGroup[] {
  const groups = new Map<string, ImageGroup>()
  for (const image of images) {
    const key = image.game_uuid || 'unknown'
    if (!groups.has(key)) {
      groups.set(key, {
        name: image.game_name || 'Unknown',
        uuid: image.game_uuid || '',
        items: [],
      })
    }
    groups.get(key)!.items.push(image)
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function queueFailureText(image: ImageRow): string {
  return image.failure_reason || image.last_error || ''
}
