import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  isPopoutWindow,
  openChatPopoutWindow,
  readChatPanelOpen,
} from './chatPanelApi'

/**
 * Chat pop-out (GT-B17 · UID-010).
 *
 * The debt row read "No popout; not thin-client ready", narrowed in August to
 * "Friends dock *does* pop out; ChatSlideOut / ChatPage do not". That asymmetry
 * is the whole complaint: chat was modal in practice — you could talk or browse
 * the library, not both — while Friends had solved it months earlier.
 */

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('openChatPopoutWindow', () => {
  test('opens a named window on the chat route with popout chrome off', () => {
    const open = vi.fn(() => ({ focus: vi.fn() }))
    vi.stubGlobal('open', open)

    openChatPopoutWindow()

    const [url, name] = open.mock.calls[0]
    expect(url).toContain('/chat')
    expect(url).toContain('popout=1')
    // Named, so a second pop-out reuses the window rather than stacking copies.
    expect(name).toBe('od-chat-popout')
  })

  test('carries the active channel through', () => {
    const open = vi.fn(() => ({ focus: vi.fn() }))
    vi.stubGlobal('open', open)

    openChatPopoutWindow(42)

    expect(open.mock.calls[0][0]).toContain('channel=42')
  })

  test('closes the in-page panel', () => {
    // Two copies of the same conversation side by side is worse than either.
    vi.stubGlobal('open', vi.fn(() => ({ focus: vi.fn() })))

    openChatPopoutWindow()

    expect(readChatPanelOpen()).toBe(false)
  })

  test('survives a popup blocker returning null', () => {
    vi.stubGlobal('open', vi.fn(() => null))

    expect(() => openChatPopoutWindow()).not.toThrow()
  })

  test('survives focus() throwing', () => {
    // Some blockers hand back a window whose focus() throws.
    vi.stubGlobal('open', vi.fn(() => ({ focus: () => { throw new Error('blocked') } })))

    expect(() => openChatPopoutWindow()).not.toThrow()
  })
})

describe('isPopoutWindow', () => {
  test('is false on a normal route', () => {
    window.history.replaceState({}, '', '/chat')
    expect(isPopoutWindow()).toBe(false)
  })

  test('is true only for popout=1', () => {
    window.history.replaceState({}, '', '/chat?popout=1')
    expect(isPopoutWindow()).toBe(true)

    window.history.replaceState({}, '', '/chat?popout=0')
    expect(isPopoutWindow()).toBe(false)
  })
})
