/**
 * Native RetroArch companion launch profiles (Wave 8–12).
 * Heavy systems (GC/Wii/PS2) stay native-only via RetroArch CLI.
 */

import { invoke } from '@tauri-apps/api/core'

import { isTauriRuntime } from './config-store.js'

export interface RetroArchProfile {
  core: string
  system: string
  romPath: string
  retroarchPath?: string
  extraArgs?: string[]
  /** Optional GameTheca game UUID — used when staging cheats before launch */
  gameUuid?: string
  cheatsDir?: string
  cheatFilename?: string
  apiBase?: string
}

export function buildRetroArchArgs(profile: RetroArchProfile): string[] {
  const args = ['-L', profile.core, profile.romPath]
  if (profile.extraArgs?.length) {
    args.push(...profile.extraArgs)
  }
  return args
}

/**
 * Fetch a library .cht for companion staging (Wave 12).
 * Returns cheat text; callers write into RetroArch's cheats dir via host FS.
 */
export async function fetchCheatText(opts: {
  gameUuid: string
  filename: string
  apiBase?: string
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const base = (opts.apiBase || '').replace(/\/$/, '')
  const url = `${base}/api/games/${encodeURIComponent(opts.gameUuid)}/cheats/${encodeURIComponent(opts.filename)}`
  try {
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) {
      return { ok: false, error: `cheat download ${response.status}` }
    }
    const text = await response.text()
    return { ok: true, text }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function launchRetroArchProfile(profile: RetroArchProfile): Promise<{ ok: true }> {
  if (!isTauriRuntime()) {
    throw new Error('RetroArch launch requires the desktop companion')
  }
  if (profile.gameUuid && profile.cheatFilename) {
    // Best-effort: fetch so callers / future FS hooks can stage the file.
    await fetchCheatText({
      gameUuid: profile.gameUuid,
      filename: profile.cheatFilename,
      apiBase: profile.apiBase,
    })
  }
  const exe = profile.retroarchPath || 'retroarch'
  await invoke('launch_game', {
    gameUuid: `retroarch:${profile.system}`,
    exePath: exe,
    extractPath: null,
    args: buildRetroArchArgs(profile),
  })
  return { ok: true }
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
