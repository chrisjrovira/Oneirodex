import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useRowScroll } from './useRowScroll'

describe('useRowScroll wheel', () => {
  let track
  let viewport
  let page

  beforeEach(() => {
    track = document.createElement('div')
    viewport = document.createElement('div')
    page = document.createElement('div')
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 400 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1200 })
    Object.defineProperty(page, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(page, 'scrollHeight', { configurable: true, value: 2000 })
    page.style.overflowY = 'auto'
    page.scrollTop = 0
    track.scrollLeft = 0
    page.append(viewport)
    viewport.append(track)
    document.body.append(page)
  })

  afterEach(() => {
    page.remove()
  })

  test('vertical wheel over the viewport scrolls the page, not the track', () => {
    renderHook(() => {
      const scroll = useRowScroll({ bindKey: 1 })
      scroll.ref.current = track
      scroll.viewportRef.current = viewport
      return scroll
    })

    const blocked = !viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 80, deltaMode: 0, bubbles: true, cancelable: true }),
    )
    expect(blocked).toBe(true)
    expect(track.scrollLeft).toBe(0)
    expect(page.scrollTop).toBe(80)
  })

  test('horizontal-dominant wheel does not pan the track', () => {
    renderHook(() => {
      const scroll = useRowScroll({ bindKey: 1 })
      scroll.ref.current = track
      scroll.viewportRef.current = viewport
      return scroll
    })

    const blocked = !viewport.dispatchEvent(
      new WheelEvent('wheel', {
        deltaX: 60,
        deltaY: 10,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(blocked).toBe(true)
    expect(track.scrollLeft).toBe(0)
    expect(page.scrollTop).toBe(0)
  })

  test('wheel over the track itself is also cancelled', () => {
    renderHook(() => {
      const scroll = useRowScroll({ bindKey: 1 })
      scroll.ref.current = track
      scroll.viewportRef.current = viewport
      return scroll
    })

    const blocked = !track.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, deltaMode: 0, bubbles: true, cancelable: true }),
    )
    expect(blocked).toBe(true)
    expect(track.scrollLeft).toBe(0)
    expect(page.scrollTop).toBe(40)
  })
})

describe('useRowScroll arrow hover', () => {
  let track
  let queued
  let frameId

  beforeEach(() => {
    track = document.createElement('div')
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 400 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1200 })
    track.scrollLeft = 0
    track.scrollBy = ({ left = 0 } = {}) => {
      track.scrollLeft += left
    }
    document.body.append(track)
    queued = null
    frameId = 0
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      queued = cb
      frameId += 1
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      queued = null
    })
  })

  afterEach(() => {
    track.remove()
    vi.unstubAllGlobals()
  })

  test('hovering an arrow eases the track along', () => {
    const { result } = renderHook(() => useRowScroll({ edgeSpeed: 10 }))
    result.current.ref.current = track
    result.current.startEdgeScroll(1)
    queued?.(0)
    expect(track.scrollLeft).toBe(10)
  })

  test('a page click cancels the hover loop so the two do not fight', () => {
    const { result } = renderHook(() => useRowScroll({ edgeSpeed: 10 }))
    result.current.ref.current = track
    result.current.startEdgeScroll(1)
    expect(queued).toBeTruthy()
    result.current.scrollByPage(1)
    expect(queued).toBeNull()
  })
})
