import { describe, expect, test, vi } from 'vitest'
import {
  DASHBOARD_COLS,
  DASHBOARD_MAX_Y,
  boardCellMetrics,
  clampWidget,
  commitMove,
  commitResize,
  cssLengthToPx,
  defaultDashboardLayout,
  overlaps,
  patchWidget,
  resolveOverlaps,
  rowsForContentHeight,
} from './dashboardLayout'

describe('defaultDashboardLayout', () => {
  test('metrics fill each row without leftover columns', () => {
    const layout = defaultDashboardLayout()
    const metrics = layout.filter((item) => item.id.startsWith('m-'))
    const rows = new Map()
    metrics.forEach((item) => {
      const list = rows.get(item.y) || []
      list.push(item)
      rows.set(item.y, list)
    })
    for (const row of rows.values()) {
      const width = row.reduce((sum, item) => sum + item.w, 0)
      expect(width).toBe(DASHBOARD_COLS)
    }
  })

  test('includes errors only when requested', () => {
    expect(defaultDashboardLayout().some((item) => item.id === 'errors')).toBe(false)
    expect(defaultDashboardLayout({ hasErrors: true }).some((item) => item.id === 'errors')).toBe(
      true,
    )
  })
})

test('commitMove swaps equal-size tiles instead of shoving the dragged one', () => {
  const layout = [
    { id: 'm-libraries', x: 0, y: 0, w: 3, h: 2 },
    { id: 'm-games', x: 3, y: 0, w: 3, h: 2 },
  ]
  const next = commitMove(layout, 'm-libraries', 3, 0)
  const libs = next.find((item) => item.id === 'm-libraries')
  const games = next.find((item) => item.id === 'm-games')
  expect(libs).toMatchObject({ x: 3, y: 0 })
  expect(games).toMatchObject({ x: 0, y: 0 })
})

test('commitMove pins the mover and nudges others when sizes differ', () => {
  const layout = [
    { id: 'status', x: 0, y: 0, w: 12, h: 2 },
    { id: 'm-libraries', x: 0, y: 2, w: 3, h: 2 },
  ]
  const next = commitMove(layout, 'm-libraries', 0, 0)
  const libs = next.find((item) => item.id === 'm-libraries')
  const status = next.find((item) => item.id === 'status')
  expect(libs).toMatchObject({ x: 0, y: 0 })
  expect(status.y).toBeGreaterThanOrEqual(libs.h)
  expect(overlaps(libs, status)).toBe(false)
})

test('patchWidget does not resolve overlaps (live drag preview)', () => {
  const layout = [
    { id: 'm-libraries', x: 0, y: 0, w: 3, h: 2 },
    { id: 'm-games', x: 3, y: 0, w: 3, h: 2 },
  ]
  const next = patchWidget(layout, 'm-libraries', { x: 3, y: 0 })
  expect(overlaps(next[0], next[1])).toBe(true)
})

test('commitResize keeps the resized widget pinned', () => {
  const layout = [
    { id: 'm-libraries', x: 0, y: 0, w: 3, h: 2 },
    { id: 'm-games', x: 3, y: 0, w: 3, h: 2 },
  ]
  const next = commitResize(layout, 'm-libraries', 6, 2)
  const libs = next.find((item) => item.id === 'm-libraries')
  expect(libs).toMatchObject({ x: 0, y: 0, w: 6, h: 2 })
})

test('clampWidget keeps widgets inside the board', () => {
  const item = clampWidget({ id: 'host', x: 20, y: -2, w: 40, h: 1 })
  expect(item.x).toBeGreaterThanOrEqual(0)
  expect(item.w).toBeLessThanOrEqual(DASHBOARD_COLS)
  expect(item.x + item.w).toBeLessThanOrEqual(DASHBOARD_COLS)
  expect(item.h).toBeGreaterThanOrEqual(3)
})

test('clampWidget caps runaway y so vanish-on-drop layouts cannot stick', () => {
  const item = clampWidget({ id: 'm-libraries', x: 0, y: 999, w: 3, h: 2 })
  expect(item.y).toBe(DASHBOARD_MAX_Y)
})

test('cssLengthToPx resolves rem row tracks (not parseFloat alone)', () => {
  const root = document.documentElement
  const previous = root.style.fontSize
  root.style.fontSize = '16px'
  expect(cssLengthToPx('3.5rem', document.body)).toBe(56)
  expect(cssLengthToPx('56px', document.body)).toBe(56)
  // The bug: parseFloat('3.5rem') === 3.5 — that must never be the pitch.
  expect(cssLengthToPx('3.5rem', document.body)).not.toBe(3.5)
  root.style.fontSize = previous
})

test('boardCellMetrics uses rem track + gap, not 3.5px', () => {
  const board = document.createElement('div')
  board.style.width = '1200px'
  document.body.appendChild(board)
  board.getBoundingClientRect = () => ({
    width: 1200,
    height: 400,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON() {},
  })
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
    if (el === board) {
      return {
        columnGap: '8.8px',
        rowGap: '8.8px',
        gap: '8.8px',
        gridTemplateRows: '56px 56px',
        getPropertyValue: (name) => (name === '--od-dash-row' ? '3.5rem' : ''),
      }
    }
    return {
      fontSize: '16px',
      getPropertyValue: () => '',
    }
  })
  const metrics = boardCellMetrics(board)
  expect(metrics.rowPitch).toBeCloseTo(64.8, 1)
  expect(metrics.colPitch).toBeCloseTo((1200 + 8.8) / 12, 1)
  expect(metrics.rowPitch).toBeGreaterThan(40)
  window.getComputedStyle.mockRestore()
  board.remove()
})

test('rowsForContentHeight grows the Degraded health strip', () => {
  expect(rowsForContentHeight(120, 64.8, 2)).toBeGreaterThanOrEqual(2)
  expect(rowsForContentHeight(200, 64.8, 2)).toBeGreaterThan(2)
})

test('resolveOverlaps can pin an id', () => {
  const layout = [
    { id: 'a', x: 0, y: 0, w: 3, h: 2 },
    { id: 'b', x: 0, y: 0, w: 3, h: 2 },
  ]
  const next = resolveOverlaps(layout, 'b')
  const b = next.find((item) => item.id === 'b')
  expect(b).toMatchObject({ x: 0, y: 0 })
})
