/** Browse/details play honesty helpers (Wave 15a — no Download BIOS CTA). */

export const FIRMWARE_HELP_HREF = '/help#browser-play'
export const FIRMWARE_ADMIN_HREF = '/admin/emulator_profiles'

const DEFAULT_FIRMWARE_MESSAGE =
  'Required BIOS/firmware is missing. Ask an admin to upload it under Emulator profiles — Oneirodex does not download BIOS files.'

const DEFAULT_MISSING_EXTRACTOR =
  'No archive extractor on the host — prefer .zip, or install 7z / bsdtar / unrar tools.'

const DEFAULT_PATH_MISSING =
  'This install path is gone. Use game details → Remove missing versions (librarian+) or re-scan after restoring files.'

/**
 * True when browse/details say firmware is required but not present on the host.
 * @param {object | null | undefined} game
 */
export function isFirmwarePlayBlocked(game) {
  return game?.firmware_missing === true
}

/**
 * Quiet blocker copy from `bios.message` / `bios.hint` (never invent a BIOS download link).
 * @param {object | null | undefined} game
 */
export function firmwareBlockMessage(game) {
  const bios = game?.bios && typeof game.bios === 'object' ? game.bios : null
  if (bios?.message) {
    return String(bios.message)
  }
  if (typeof bios?.hint === 'string' && bios.hint.trim()) {
    return bios.hint.trim()
  }
  if (game?.companion_hint) {
    return String(game.companion_hint)
  }
  return DEFAULT_FIRMWARE_MESSAGE
}

/**
 * Optional longer operator hint when distinct from the short message.
 * @param {object | null | undefined} game
 */
export function firmwareBlockHint(game) {
  const bios = game?.bios && typeof game.bios === 'object' ? game.bios : null
  const hint = typeof bios?.hint === 'string' ? bios.hint.trim() : ''
  if (!hint) {
    return null
  }
  const message = firmwareBlockMessage(game)
  return hint === message ? null : hint
}

/**
 * Prefer Backend `hint` for toast/inline honesty errors (path_missing, missing_extractor, …).
 * @param {Error & { code?: string, hint?: string, data?: { error?: string, code?: string, hint?: string } }} err
 * @param {string} [fallback]
 */
export function honestyApiErrorMessage(err, fallback = 'Request failed') {
  const data = err?.data && typeof err.data === 'object' ? err.data : null
  const hint = err?.hint || data?.hint
  if (hint) {
    return String(hint)
  }
  const code = err?.code || data?.code
  const errorText = data?.error || null
  if (errorText) {
    return String(errorText)
  }
  if (code === 'missing_extractor') {
    return DEFAULT_MISSING_EXTRACTOR
  }
  if (code === 'path_missing') {
    return DEFAULT_PATH_MISSING
  }
  if (err?.message) {
    return String(err.message)
  }
  return fallback
}
