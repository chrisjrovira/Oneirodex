/**
 * Save-location placeholders (INSP-1). The server hands the companion the
 * community manifest's templated path — `<winAppData>/Studio/Game` — because
 * that is true for every PC; this expands it for *this* one using Tauri's
 * path API. A placeholder we cannot resolve (`<storeUserId>`, `<base>` when
 * the game is not installed here) leaves the path unopenable, and we say so
 * rather than guessing a folder.
 */

export interface PlaceholderResolvers {
  home: () => Promise<string>
  documents: () => Promise<string>
  appData: () => Promise<string>
  localAppData: () => Promise<string>
  configDir: () => Promise<string>
  dataDir: () => Promise<string>
  /** Install root of the game on this PC, when known. */
  base?: () => Promise<string | null>
}

const PLACEHOLDER = /<([A-Za-z]+)>/g

export function hasSavePlaceholder(path: string): boolean {
  return /<[A-Za-z]+>/.test(path || '')
}

/**
 * Expand every `<token>`; returns `{ ok: false, missing }` when one cannot be
 * resolved on this machine. Never invents a folder.
 */
export async function expandSavePath(
  template: string,
  resolvers: PlaceholderResolvers,
): Promise<{ ok: true; path: string } | { ok: false; missing: string }> {
  const tokens = Array.from(
    new Set(Array.from((template || '').matchAll(PLACEHOLDER), (m) => m[1])),
  )
  const values = new Map<string, string>()
  for (const token of tokens) {
    let value: string | null = null
    switch (token) {
      case 'home':
      case 'osUserHome':
        value = await resolvers.home()
        break
      case 'winDocuments':
        value = await resolvers.documents()
        break
      case 'winAppData':
        value = await resolvers.appData()
        break
      case 'winLocalAppData':
        value = await resolvers.localAppData()
        break
      case 'xdgConfig':
        value = await resolvers.configDir()
        break
      case 'xdgData':
        value = await resolvers.dataDir()
        break
      case 'base':
      case 'root':
      case 'game':
        value = resolvers.base ? await resolvers.base() : null
        break
      default:
        value = null
    }
    if (!value) {
      return { ok: false, missing: `<${token}>` }
    }
    values.set(token, value.replace(/[\\/]+$/, ''))
  }
  const out = (template || '').replace(PLACEHOLDER, (_, token: string) => values.get(token) || '')
  return { ok: true, path: out }
}

/** Tauri-backed resolvers; imported lazily so tests can pass their own. */
export async function tauriResolvers(
  base?: () => Promise<string | null>,
): Promise<PlaceholderResolvers> {
  const path = await import('@tauri-apps/api/path')
  return {
    home: () => path.homeDir(),
    documents: () => path.documentDir(),
    appData: () => path.appDataDir().then((p) => p.replace(/[\\/][^\\/]+[\\/]?$/, '')),
    localAppData: () => path.appLocalDataDir().then((p) => p.replace(/[\\/][^\\/]+[\\/]?$/, '')),
    configDir: () => path.appConfigDir().then((p) => p.replace(/[\\/][^\\/]+[\\/]?$/, '')),
    dataDir: () => path.dataDir(),
    base,
  }
}
