/* Types and constants moved out of ArtStudioPage (v11 cycle, H-D.2), unchanged. */

export type ArtStudioTab = 'studio' | 'stock' | 'marks' | 'images'

export interface PreviewVariant {
  key: string
  width: number
  height: number
  label: string
  kind: string
}

export interface MissingCoverGame {
  uuid: string
  name: string
  issues?: { code?: string }[]
}

export const PREVIEW_VARIANTS: PreviewVariant[] = [
  { key: 'sm', width: 200, height: 300, label: '200×300', kind: 'tile' },
  { key: 'md', width: 400, height: 600, label: '400×600', kind: 'tile' },
  { key: 'wide', width: 960, height: 540, label: '960×540', kind: 'wide' },
]

export const DEFAULT_TITLE_SCALE = 1.3
export const TITLE_SCALE_MIN = 0.85
export const TITLE_SCALE_MAX = 2

export const FALLBACK_ASSETS = [
  {
    key: 'cover',
    label: 'Default cover',
    path: '/static/newstyle/default_cover.jpg',
    hint: 'Library tiles · missing covers',
  },
  {
    key: 'library',
    label: 'Default library',
    path: '/static/newstyle/default_library.jpg',
    hint: 'Wide / hero surfaces',
  },
]

export const PREVIEW_DEBOUNCE_MS = 420
