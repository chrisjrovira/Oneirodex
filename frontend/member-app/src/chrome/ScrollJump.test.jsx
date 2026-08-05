import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EDGE_PX, ScrollJump } from './ScrollJump'

function stubScrollMetrics({ scrollHeight, clientHeight, scrollY }) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get: () => clientHeight,
  })
  Object.defineProperty(document.body, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get: () => clientHeight,
  })
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollY,
  })
  if (document.scrollingElement) {
    Object.defineProperty(document.scrollingElement, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })
    Object.defineProperty(document.scrollingElement, 'scrollTop', {
      configurable: true,
      get: () => scrollY,
    })
  }
}

describe('ScrollJump', () => {
  let scrollToSpy

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    stubScrollMetrics({ scrollHeight: 400, clientHeight: 800, scrollY: 0 })
  })

  afterEach(() => {
    scrollToSpy.mockRestore()
  })

  test('hides when the page is not scrollable', () => {
    stubScrollMetrics({ scrollHeight: 500, clientHeight: 800, scrollY: 0 })
    const { container } = render(<ScrollJump />)
    expect(container.querySelector('.gt-scroll-jump')).toBeNull()
    expect(screen.queryByRole('navigation', { name: /page scroll/i })).toBeNull()
  })

  test('shows jump top and jump bottom when content overflows', async () => {
    stubScrollMetrics({
      scrollHeight: 2400,
      clientHeight: 800,
      scrollY: 400,
    })
    render(<ScrollJump />)

    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    const nav = screen.getByRole('navigation', { name: /page scroll/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /jump to top/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /jump to bottom/i })).toBeEnabled()
  })

  test('disables jump top near the top edge', async () => {
    stubScrollMetrics({
      scrollHeight: 2400,
      clientHeight: 800,
      scrollY: Math.min(EDGE_PX - 1, 0),
    })
    render(<ScrollJump />)

    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByRole('button', { name: /jump to top/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /jump to bottom/i })).toBeEnabled()
  })

  test('jump buttons call window.scrollTo', async () => {
    const user = userEvent.setup()
    stubScrollMetrics({
      scrollHeight: 2400,
      clientHeight: 800,
      scrollY: 600,
    })
    render(<ScrollJump />)

    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    await user.click(screen.getByRole('button', { name: /jump to top/i }))
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0, left: 0 }),
    )

    await user.click(screen.getByRole('button', { name: /jump to bottom/i }))
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 1600, left: 0 }),
    )
  })
})
