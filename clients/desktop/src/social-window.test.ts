import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/webviewWindow', () => {
  class FakeWebviewWindow {
    static getByLabel = vi.fn()
    once = vi.fn((event: string, handler: (payload?: unknown) => void) => {
      if (event === 'tauri://created') {
        queueMicrotask(() => handler())
      }
    })
    show = vi.fn(async () => undefined)
    setFocus = vi.fn(async () => undefined)
    setAlwaysOnTop = vi.fn(async () => undefined)
    close = vi.fn(async () => undefined)
    constructor(public label: string, public options: Record<string, unknown>) {}
  }
  return { WebviewWindow: FakeWebviewWindow }
})

vi.mock('./config-store.js', () => ({
  isTauriRuntime: vi.fn(() => false),
}))

import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isTauriRuntime } from './config-store.js'
import {
  buildSocialCompanionUrl,
  openSocialCompanionWindow,
  resetSocialWindowUrlTracking,
} from './social-window.js'

describe('social-window', () => {
  beforeEach(() => {
    vi.mocked(isTauriRuntime).mockReturnValue(false)
    vi.mocked(WebviewWindow.getByLabel).mockReset()
    resetSocialWindowUrlTracking()
  })

  it('builds /social-companion under the server origin', () => {
    expect(buildSocialCompanionUrl('https://games.home/')).toBe(
      'https://games.home/social-companion',
    )
    expect(buildSocialCompanionUrl('')).toBe('')
    expect(buildSocialCompanionUrl('   ')).toBe('')
  })

  it('rejects empty base URL', async () => {
    await expect(openSocialCompanionWindow('')).rejects.toThrow(/Server URL/i)
  })

  it('falls back to window.open outside Tauri', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    const how = await openSocialCompanionWindow('https://games.home')
    expect(how).toBe('browser')
    expect(open).toHaveBeenCalledWith(
      'https://games.home/social-companion',
      'gt-social-companion',
      'width=380,height=720',
    )
  })

  it('focuses an existing Tauri label instead of creating another', async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    const existing = {
      show: vi.fn(async () => undefined),
      setFocus: vi.fn(async () => undefined),
      setAlwaysOnTop: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValue(existing as never)

    const how = await openSocialCompanionWindow('https://games.home')
    expect(how).toBe('focused')
    expect(existing.show).toHaveBeenCalled()
    expect(existing.setFocus).toHaveBeenCalled()
    expect(existing.setAlwaysOnTop).toHaveBeenCalledWith(true)
    expect(existing.close).not.toHaveBeenCalled()
  })

  it('creates a new always-on-top Tauri window when none exists', async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValue(null)

    const how = await openSocialCompanionWindow('https://games.home/')
    expect(how).toBe('opened')
  })

  it('recreates the window when Server URL changes (SSE/site origin)', async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    const existing = {
      show: vi.fn(async () => undefined),
      setFocus: vi.fn(async () => undefined),
      setAlwaysOnTop: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    vi.mocked(WebviewWindow.getByLabel).mockResolvedValueOnce(null)
    await openSocialCompanionWindow('https://games.home')

    vi.mocked(WebviewWindow.getByLabel).mockResolvedValueOnce(existing as never)
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValueOnce(null)
    const how = await openSocialCompanionWindow('https://other.home')
    expect(existing.close).toHaveBeenCalled()
    expect(how).toBe('opened')
  })
})
