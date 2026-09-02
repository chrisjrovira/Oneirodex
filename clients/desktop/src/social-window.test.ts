import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/webviewWindow', () => {
  class FakeWebviewWindow {
    static getByLabel = vi.fn()
    static lastOptions: Record<string, unknown> | null = null
    once = vi.fn((event: string, handler: (payload?: unknown) => void) => {
      if (event === 'tauri://created') {
        queueMicrotask(() => handler())
      }
    })
    show = vi.fn(async () => undefined)
    setFocus = vi.fn(async () => undefined)
    setAlwaysOnTop = vi.fn(async () => undefined)
    close = vi.fn(async () => undefined)
    constructor(public label: string, public options: Record<string, unknown>) {
      FakeWebviewWindow.lastOptions = options
    }
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
  resolveBottomRightPlacement,
  SOCIAL_POPUP,
} from './social-window.js'

describe('social-window', () => {
  beforeEach(() => {
    vi.mocked(isTauriRuntime).mockReturnValue(false)
    vi.mocked(WebviewWindow.getByLabel).mockReset()
    resetSocialWindowUrlTracking()
    ;(WebviewWindow as unknown as { lastOptions: unknown }).lastOptions = null
  })

  it('builds /social-companion under the server origin', () => {
    expect(buildSocialCompanionUrl('https://games.home/')).toBe(
      'https://games.home/social-companion',
    )
    expect(buildSocialCompanionUrl('')).toBe('')
    expect(buildSocialCompanionUrl('   ')).toBe('')
  })

  it('places a compact popup in the bottom-right work area', () => {
    const p = resolveBottomRightPlacement(1920, 1080)
    expect(p.width).toBe(SOCIAL_POPUP.width)
    expect(p.height).toBe(SOCIAL_POPUP.height)
    expect(p.x).toBe(1920 - SOCIAL_POPUP.width - SOCIAL_POPUP.margin)
    expect(p.y).toBe(1080 - SOCIAL_POPUP.height - SOCIAL_POPUP.margin)
  })

  it('clamps height on short displays', () => {
    const p = resolveBottomRightPlacement(1280, 500)
    expect(p.height).toBeLessThanOrEqual(500 - SOCIAL_POPUP.margin * 2)
    expect(p.y).toBe(SOCIAL_POPUP.margin)
  })

  it('rejects empty base URL', async () => {
    await expect(openSocialCompanionWindow('')).rejects.toThrow(/Server URL/i)
  })

  it('falls back to bottom-right window.open outside Tauri', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    vi.stubGlobal('screen', { availWidth: 1920, availHeight: 1080 })
    const how = await openSocialCompanionWindow('https://games.home')
    expect(how).toBe('browser')
    const features = String(open.mock.calls[0]?.[2] || '')
    expect(open).toHaveBeenCalledWith(
      'https://games.home/social-companion',
      'od-social-companion',
      expect.stringContaining('width=360'),
    )
    expect(features).toMatch(/left=\d+/)
    expect(features).toMatch(/top=\d+/)
    expect(features).toMatch(/height=560/)
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

  it('creates a compact always-on-top Tauri window at bottom-right', async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(WebviewWindow.getByLabel).mockResolvedValue(null)
    vi.stubGlobal('screen', { availWidth: 1920, availHeight: 1080 })

    const how = await openSocialCompanionWindow('https://games.home/')
    expect(how).toBe('opened')
    const opts = (WebviewWindow as unknown as { lastOptions: Record<string, unknown> }).lastOptions
    expect(opts).toMatchObject({
      width: 360,
      height: 560,
      alwaysOnTop: true,
      decorations: true,
      skipTaskbar: false,
    })
    expect(opts.x).toBe(1920 - 360 - 16)
    expect(opts.y).toBe(1080 - 560 - 16)
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
