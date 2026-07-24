import type { KeychainAdapter } from './auth.js'

/**
 * OS keychain hook — stub until Tauri credential plugin is wired.
 * File store in app data holds token today; keychain remains optional.
 */
export const keychainAdapter: KeychainAdapter = {
  async load(): Promise<string | null> {
    return null
  },

  async save(_token: string): Promise<void> {
    // no-op — future: Windows Credential Manager / macOS Keychain
  },

  async clear(): Promise<void> {
    // no-op
  },
}
