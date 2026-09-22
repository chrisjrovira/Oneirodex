/* Payload types, endpoint, core labels and helpers moved out of EmulatorFirmwarePanel (v11 cycle, H-D.2) — unchanged. */

export interface FirmwareFile {
  subdir?: string
  name: string
  size?: number
  loadable?: boolean
}

export interface FirmwareMisplaced {
  subdir: string
  name: string
}

export interface FirmwareCoreStatus {
  core: string
  ready: boolean
  required?: string[]
  present?: string[]
  misplaced?: FirmwareMisplaced[]
}

export interface FirmwareVersion {
  digest?: string
  paths?: string[]
  size?: number
  count?: number
}

export interface FirmwareMatchSystem {
  label: string
}

export interface FirmwareMatch {
  name: string
  chosen?: string
  already?: boolean
  systems?: FirmwareMatchSystem[]
  versions?: FirmwareVersion[]
  note?: string
}

export interface FirmwarePlan {
  matches?: FirmwareMatch[]
  missing_markdown?: string
}

/**
 * Firmware / BIOS management for WebRetro cores (GT-B2 · UID-007).
 *
 * Product stance (locked): Oneirodex never downloads or bundles BIOS. Public
 * installs get an upload box; local installs can also mount EMULATOR_BIOS_PATH
 * or scan a folder the operator already holds. There is deliberately no
 * "fetch BIOS" affordance anywhere in this component.
 *
 * Mounted into the Jinja Emulators page rather than replacing it.
 */

export const ENDPOINT = '/api/emulator-bios'

/** Human core names — the API returns libretro core ids. */
export const CORE_LABELS = {
  mednafen_psx_hw: 'PlayStation',
  opera: '3DO',
  neocd: 'Neo Geo CD',
  yabause: 'Saturn',
  genesis_plus_gx: 'Sega CD',
  flycast: 'Dreamcast',
  pcsx2: 'PlayStation 2',
  melonds: 'Nintendo DS',
  mgba: 'Game Boy Advance',
  handy: 'Atari Lynx',
  gearcoleco: 'ColecoVision',
  freeintv: 'Intellivision',
  o2em: 'Odyssey²',
  mednafen_pce: 'PC Engine CD',
  mednafen_pce_fast: 'PC Engine',
  mednafen_supergrafx: 'SuperGrafx',
  puae: 'Amiga',
  cap32: 'Amstrad CPC / GX4000',
  prosystem: 'Atari 7800',
  a5200: 'Atari 5200',
  freechaf: 'Fairchild Channel F',
  crvision: 'VTech CreatiVision',
  citra: 'Nintendo 3DS',
  vita3k: 'PlayStation Vita',
  nestopia: 'NES / Famicom Disk System',
  dolphin: 'GameCube / Wii',
  snes9x: 'SNES',
  mupen64plus_next: 'Nintendo 64',
  parallel_n64: 'Nintendo 64 (ParaLLEl)',
  gearsystem: 'Master System / SG-1000',
  virtualjaguar: 'Atari Jaguar',
  vice_x64: 'Commodore 64',
}

export function coreLabel(core: string): string {
  return (CORE_LABELS as Record<string, string>)[core] || core
}

export function formatBytes(size: unknown): string {
  if (size === null || size === undefined || size === '') return 'n/a'
  const n = Number(size)
  if (!Number.isFinite(n) || n < 0) return 'n/a'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Pull the human sentence out of either envelope shape (see GT-B1). */
export async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    const text = body?.error || body?.message
    if (typeof text === 'string' && text.trim()) return text.trim()
  } catch {
    /* non-JSON error body — fall through */
  }
  return fallback
}

export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

export function versionChoice(version: FirmwareVersion): string {
  return version.digest || (version.paths && version.paths[0]) || ''
}
