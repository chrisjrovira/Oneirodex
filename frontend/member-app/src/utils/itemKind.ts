/** Library item_kind / content_kind helpers (game | experience | emulator | tool). */

export const ITEM_KINDS = Object.freeze(['game', 'experience', 'emulator', 'tool'])

/** Non-game kinds shown as tile / details badges. */
export const NON_GAME_KINDS = Object.freeze(['experience', 'emulator', 'tool'])

/** Compact tile badge descriptors keyed by canonical kind. */
export const ITEM_KIND_BADGE = Object.freeze({
  experience: {
    kind: 'EXP',
    label: 'EXP',
    title: 'Soft title — gaming software, not a main-game catalog match',
    tone: 'kind',
  },
  emulator: {
    kind: 'EMU',
    label: 'EMU',
    title: 'Emulator — gaming software, not a main-game catalog match',
    tone: 'kind',
  },
  tool: {
    kind: 'TOOL',
    label: 'TOOL',
    title: 'Utility — gaming software, not a main-game catalog match',
    tone: 'kind',
  },
})

/** Human labels for details chips / toasts (API tokens unchanged). */
export const ITEM_KIND_LABEL = Object.freeze({
  game: 'Game',
  experience: 'Soft title',
  emulator: 'Emulator',
  tool: 'Utility',
})

/** Plural chip labels for Kind filter row. */
export const ITEM_KIND_LABEL_PLURAL = Object.freeze({
  game: 'Games',
  experience: 'Soft titles',
  emulator: 'Emulators',
  tool: 'Utilities',
})

/**
 * @param {object | null | undefined} game
 * @returns {'game' | 'experience' | 'emulator' | 'tool'}
 */
export function resolveItemKind(game) {
  const raw = game?.item_kind ?? game?.content_kind ?? 'game'
  const kind = String(raw).trim().toLowerCase()
  if (kind === 'experience' || kind === 'emulator' || kind === 'tool') {
    return kind
  }
  return 'game'
}

/**
 * @param {string | null | undefined} path
 * @returns {string}
 */
export function folderBasename(path) {
  const parts = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}
