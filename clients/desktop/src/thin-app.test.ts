import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class {
    static getByLabel = vi.fn()
    once = vi.fn()
  },
}))

vi.mock('./config-store.js', () => ({
  isTauriRuntime: vi.fn(() => false),
  loadStoredConfig: vi.fn(async () => ({ baseUrl: '', token: null })),
  saveStoredConfig: vi.fn(async () => undefined),
}))

const { joinLibraryUrl } = await import('./thin-app.js')

describe('thin library URL', () => {
  it('marks the webview as a thin seat so the SPA can be honest', () => {
    // Without this the SPA sees an ordinary cookie session and keeps offering
    // Install / Update, which a thin seat can never complete.
    expect(joinLibraryUrl('https://games.example.com')).toBe(
      'https://games.example.com/?seat=thin',
    )
  })

  it('tolerates a trailing slash on the server URL', () => {
    expect(joinLibraryUrl('https://games.example.com/')).toBe(
      'https://games.example.com/?seat=thin',
    )
  })

  it('stays empty with no server URL so the caller still errors', () => {
    expect(joinLibraryUrl('   ')).toBe('')
  })
})
