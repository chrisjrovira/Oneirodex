/**
 * Native RetroArch companion launch profiles (Wave 8–12).
 * Heavy systems (GC/Wii/PS2) stay native-only via RetroArch CLI.
 */

import { invoke } from '@tauri-apps/api/core'

import { isTauriRuntime } from './config-store.js'

export interface RetroArchAiTranslateHint {
  enabled?: boolean
  serviceUrl?: string
  targetLang?: string
}

export interface RetroArchProfile {
  core: string
  system: string
  romPath: string
  retroarchPath?: string
  extraArgs?: string[]
  /** Optional GameTheca game UUID — used when staging cheats before launch */
  gameUuid?: string
  /** Override staging root (must be under companion app_data/cheats when writing) */
  cheatsDir?: string
  cheatFilename?: string
  apiBase?: string
  /** Optional AI Service overlay hint (config in RetroArch UI; CLI does not set URL reliably) */
  aiTranslate?: RetroArchAiTranslateHint
}

/**
 * Build a human-readable companion note for RetroArch AI Service setup.
 * RetroArch expects AI Service URL configured in its own settings — we do not
 * invent fragile CLI flags here.
 */
export function buildAiServiceSetupNote(hint?: RetroArchAiTranslateHint): string | null {
  if (!hint?.enabled) {
    return null
  }
  const target = hint.targetLang || 'en'
  const urlBit = hint.serviceUrl
    ? ` Suggested service URL: ${hint.serviceUrl}.`
    : ' Point RetroArch AI Service at your local OCR/MT server.'
  return (
    `Live translate: enable RetroArch → Settings → AI Service (Image mode), ` +
    `target language “${target}”.${urlBit} Overlay only — not a permanent ROM patch.`
  )
}

export function buildRetroArchArgs(profile: RetroArchProfile): string[] {
  const args = ['-L', profile.core, profile.romPath]
  if (profile.extraArgs?.length) {
    args.push(...profile.extraArgs)
  }
  return args
}

/** Sanitize a cheat filename for host FS (mirrors werkzeug secure_filename loosely). */
export function safeCheatFilename(filename: string): string {
  const trimmed = (filename || '').trim().replace(/\\/g, '/')
  const base = trimmed.split('/').pop() || ''
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '')
  if (!cleaned) {
    return 'cheats.cht'
  }
  return cleaned.toLowerCase().endsWith('.cht') ? cleaned : `${cleaned}.cht`
}

/**
 * Fetch a library .cht for companion staging (Wave 12 / O6).
 * Returns cheat text; callers write into RetroArch's cheats dir via host FS.
 */
export async function fetchCheatText(opts: {
  gameUuid: string
  filename: string
  apiBase?: string
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const base = (opts.apiBase || '').replace(/\/$/, '')
  const url = `${base}/api/games/${encodeURIComponent(opts.gameUuid)}/cheats/${encodeURIComponent(opts.filename)}`
  const fetchFn = opts.fetchImpl || fetch
  try {
    const response = await fetchFn(url, { credentials: 'include' })
    if (!response.ok) {
      return { ok: false, error: `cheat download ${response.status}` }
    }
    const text = await response.text()
    return { ok: true, text }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function resolveCheatStagePath(cheatsDir: string, gameUuid: string, filename: string): string {
  const root = cheatsDir.replace(/[\\/]+$/, '')
  const safeUuid = gameUuid.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${root}/${safeUuid}/${safeCheatFilename(filename)}`
}

/**
 * Download a .cht from GameTheca and write it under companion app_data/cheats/.
 * Reuses Tauri `write_file_bytes` (ACL allows downloads + cheats roots).
 */
export async function stageCheatFile(opts: {
  gameUuid: string
  filename: string
  apiBase?: string
  cheatsDir?: string
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!isTauriRuntime()) {
    return { ok: false, error: 'Companion runtime required to stage cheats' }
  }
  const fetched = await fetchCheatText(opts)
  if (!fetched.ok) {
    return fetched
  }
  let cheatsDir = opts.cheatsDir
  if (!cheatsDir) {
    try {
      cheatsDir = await invoke<string>('get_app_subdir', { subdir: 'cheats' })
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  const path = resolveCheatStagePath(cheatsDir, opts.gameUuid, opts.filename)
  const bytes = new TextEncoder().encode(fetched.text)
  try {
    await invoke('write_file_bytes', {
      path,
      bytes: new Uint8Array(bytes),
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
  return { ok: true, path }
}

export async function launchRetroArchProfile(profile: RetroArchProfile): Promise<{
  ok: true
  cheatPath?: string
}> {
  if (!isTauriRuntime()) {
    throw new Error('RetroArch launch requires the desktop companion')
  }
  let cheatPath: string | undefined
  if (profile.gameUuid && profile.cheatFilename) {
    const staged = await stageCheatFile({
      gameUuid: profile.gameUuid,
      filename: profile.cheatFilename,
      apiBase: profile.apiBase,
      cheatsDir: profile.cheatsDir,
    })
    if (staged.ok) {
      cheatPath = staged.path
    }
  }
  const exe = profile.retroarchPath || 'retroarch'
  await invoke('launch_game', {
    gameUuid: `retroarch:${profile.system}`,
    exePath: exe,
    extractPath: null,
    args: buildRetroArchArgs(profile),
  })
  const note = buildAiServiceSetupNote(profile.aiTranslate)
  if (note && typeof console !== 'undefined') {
    console.info(`[GameTheca] ${note}`)
  }
  return cheatPath ? { ok: true, cheatPath } : { ok: true }
}

/** Deck / handheld companion preset names (Wave 11). */
export const HANDHELD_PRESETS = [
  { id: 'steamdeck', label: 'Steam Deck', scale: 1, performance: 'balanced' },
  { id: 'ally', label: 'ROG Ally', scale: 1, performance: 'performance' },
  { id: 'legion', label: 'Legion Go', scale: 1.25, performance: 'balanced' },
] as const

export interface WinePrefixConfig {
  prefixPath: string
  runner?: string
  dxvk?: boolean
}

export function wineLaunchEnv(cfg: WinePrefixConfig): Record<string, string> {
  const env: Record<string, string> = {
    WINEPREFIX: cfg.prefixPath,
  }
  if (cfg.runner) {
    env.WINE = cfg.runner
  }
  if (cfg.dxvk) {
    env.DXVK_HUD = '0'
  }
  return env
}
