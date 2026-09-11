/** DAT + IGDB region codes. Keep in sync with oneirodex.utils.set_completion.REGION_PREF_ORDER. */

export const REGION_PREF_ORDER = Object.freeze([
  'USA',
  'EUR',
  'JPN',
  'BRA',
  'KOR',
  'AUS',
  'GBR',
  'FRA',
  'DEU',
  'ESP',
  'CHN',
  'WORLD',
  'OTHER',
])

export const REGION_LABELS = Object.freeze({
  USA: 'United States',
  EUR: 'Europe',
  JPN: 'Japan',
  BRA: 'Brazil',
  KOR: 'Korea',
  AUS: 'Australia',
  GBR: 'United Kingdom',
  FRA: 'France',
  DEU: 'Germany',
  ESP: 'Spain',
  CHN: 'China',
  WORLD: 'World',
  OTHER: 'Other',
})

/** Store libraries — not DAT / licensed-catalog surfaces. */
export const NATIVE_PC_PLATFORMS = Object.freeze(['PCWIN', 'PCDOS', 'MAC', 'OTHER'])

export function isNativePcPlatform(value) {
  return NATIVE_PC_PLATFORMS.includes(String(value || '').toUpperCase())
}
