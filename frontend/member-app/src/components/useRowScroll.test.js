import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useRowScroll } from './useRowScroll'

describe('useRowScroll wheel', () => {
  let track
  let viewport

  beforeEach(() => {
    track = document.createElement('div')
    viewport = document.createElement('div')
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 400 })
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1200 })
    track.scrollLeft = 0
    document.body.append(viewport, track)
  })

  afterEach(() => {
    viewport.remove()
    track.remove()
  })

  test('vertical wheel over the viewport scrolls the track horizontally', () => {
    renderHook(() => {
      const scroll = useRowScroll()
      // Assign before effects flush so the capture listener binds to viewport.
      scroll.ref.current = track
      scroll.viewportRef.current = viewport
      return scroll
    })

    const blocked = !viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 80, deltaMode: 0, bubbles: true, cancelable: true }),
    )
    expect(blocked).toBe(true)
    expect(track.scrollLeft).toBe(80)
  })

  test('wheel at the end does not trap the page', () => {
    track.scrollLeft = 800
    renderHook(() => {
      const scroll = useRowScroll()
      scroll.ref.current = track
      scroll.viewportRef.current = viewport
      return scroll
    })

    const blocked = !viewport.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, deltaMode: 0, bubbles: true, cancelable: true }),
    )
    expect(blocked).toBe(false)
    expect(track.scrollLeft).toBe(800)
  })
})
