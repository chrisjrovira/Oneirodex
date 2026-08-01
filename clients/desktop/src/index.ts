export {
  createAuthStore,
  describeTokenPaste,
  isGamethecaToken,
  normalizeBaseUrl,
  normalizeGamethecaToken,
} from './auth.js'
export type { AuthConfig, AuthSnapshot, AuthStore, KeychainAdapter } from './auth.js'
export { createDesktopApi } from './api.js'
export {
  fetchLibraryPreview,
  formatDesktopApiError,
  formatKeychainError,
  logCompanion,
  mergeUpdateSignalsFromLibrary,
  shapeInvalidConnectionResult,
  validateConnection,
} from './connect.js'
export type { ConnectionFailure, ConnectionResult, ConnectionValidation } from './connect.js'
export { isTauriRuntime, loadStoredConfig, saveStoredConfig } from './config-store.js'
export type { StoredConfig } from './config-store.js'
export { keychainAdapter, createKeychainAdapter, SECURE_STORE_ACCOUNT } from './keychain.js'
export {
  canPerformAction,
  createLifecycleRegistry,
  isGameLifecycleState,
  markUpdateAvailable,
  transitionLifecycle,
} from './lifecycle.js'
export type {
  GameLifecycleRecord,
  GameLifecycleState,
  LifecycleAction,
  LifecycleRegistry,
} from './lifecycle.js'
