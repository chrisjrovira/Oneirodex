import { describe, expect, test } from 'vitest'
import { hbarLayout } from './hbarLayout'

describe('hbarLayout', () => {
  test('a short row fills the rail', () => {
    const layout = hbarLayout({
      scrollLeft: 0,
      scrollWidth: 400,
      clientWidth: 400,
      railWidth: 200,
    })
    expect(layout.max).toBe(0)
    expect(layout.thumbPx).toBe(200)
    expect(layout.leftPx).toBe(0)
  })

  test('thumb size matches the visible window over current tiles', () => {
    const layout = hbarLayout({
      scrollLeft: 0,
      scrollWidth: 1000,
      clientWidth: 250,
      railWidth: 200,
      minThumbPx: 32,
    })
    expect(layout.max).toBe(750)
    expect(layout.thumbPx).toBe(50)
    expect(layout.leftPx).toBe(0)
  })

  test('scroll position maps through the usable rail in both directions', () => {
    const mid = hbarLayout({
      scrollLeft: 375,
      scrollWidth: 1000,
      clientWidth: 250,
      railWidth: 200,
      minThumbPx: 32,
    })
    expect(mid.leftPx).toBe(75)

    const end = hbarLayout({
      scrollLeft: 750,
      scrollWidth: 1000,
      clientWidth: 250,
      railWidth: 200,
      minThumbPx: 32,
    })
    expect(end.leftPx).toBe(150)
  })

  test('loading more tiles shrinks the thumb without moving content', () => {
    const before = hbarLayout({
      scrollLeft: 200,
      scrollWidth: 800,
      clientWidth: 400,
      railWidth: 200,
      minThumbPx: 32,
    })
    const after = hbarLayout({
      scrollLeft: 200,
      scrollWidth: 1600,
      clientWidth: 400,
      railWidth: 200,
      minThumbPx: 32,
    })
    expect(after.thumbPx).toBeLessThan(before.thumbPx)
    expect(after.max).toBeGreaterThan(before.max)
  })
})
