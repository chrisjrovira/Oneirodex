import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import { GameGrid } from './GameGrid'
import {
  chunkGamesIntoRows,
  computeGridColumns,
  estimateGridRowHeight,
} from './gameGridLayout'

const HERE = dirname(fileURLToPath(import.meta.url))

function makeGames(count) {
  return Array.from({ length: count }, (_, index) => ({
    uuid: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Game ${index + 1}`,
    cover_url: '/static/newstyle/default_cover.jpg',
    is_favorite: false,
    user_status: null,
    has_local_override: false,
    is_vr: false,
    genres: [],
  }))
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 900
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get() {
      return 0
    },
  })
})

test('computeGridColumns matches auto-fill math', () => {
  expect(computeGridColumns(900, 180, 10)).toBe(4)
  expect(computeGridColumns(180, 180, 10)).toBe(1)
  expect(computeGridColumns(0, 180, 10)).toBe(1)
})

test('estimateGridRowHeight uses 3:4 cover aspect and includes the row gap', () => {
  // 4 cols in 900px with 10px gaps → tile ~217.5 → cover ceil(290), +10 gap.
  expect(estimateGridRowHeight(900, 4, 10)).toBe(Math.ceil(217.5 * (4 / 3)) + 10)
})

test('the gap is added to the row, not only between columns', () => {
  // Single column isolates it: there are no inter-column gaps to change the
  // tile width, so the whole difference is the vertical gap. Virtual rows are
  // absolutely positioned, so this number *is* the spacing between them —
  // reporting the bare cover height stacked them flush and left getTotalSize()
  // short by a gap per row, which is the dead space under the tiles.
  expect(estimateGridRowHeight(300, 1, 12)).toBe(Math.ceil(300 * (4 / 3)) + 12)
  expect(estimateGridRowHeight(300, 1, 0)).toBe(Math.ceil(300 * (4 / 3)))
})

test('chunkGamesIntoRows groups by column count', () => {
  const games = makeGames(5)
  expect(chunkGamesIntoRows(games, 3)).toEqual([
    games.slice(0, 3),
    games.slice(3, 5),
  ])
})

test('renders virtualized grid root and visible game tiles', () => {
  const games = makeGames(24)
  render(<GameGrid games={games} showPlayStatus={false} isAdmin={false} />)

  const root = document.querySelector('[data-library-grid][data-library-virtual]')
  expect(root).toBeTruthy()
  expect(document.querySelectorAll('.game-library-row').length).toBeGreaterThan(0)

  // Window virtualizer should mount at least the first row's cards.
  expect(screen.getByText('Game 1', { selector: '.visually-hidden' })).toBeInTheDocument()
  expect(within(root).getAllByRole('img').length).toBeGreaterThan(0)
  // Not every tile needs to be in the DOM when virtualized.
  expect(within(root).getAllByRole('img').length).toBeLessThanOrEqual(games.length)
})

test('an open tile menu raises its whole virtual row, not just the card', () => {
  // Virtual rows are absolutely positioned *and transformed*, and a transform
  // creates a stacking context — so `.game-card { z-index: 20 }` can only rise
  // within its own row and the next row paints over the open menu. Raising the
  // card was the fix that looked right and did nothing; the row is the level
  // the problem lives at.
  const css = readFileSync(join(HERE, 'GameGrid.css'), 'utf8')

  expect(css).toMatch(
    /\.game-library-container\[data-library-virtual\]\s+\.game-library-row:has\(\s*\.game-card\[data-overlay-open='true'\]\s*\)/,
  )

  // The premise: if rows ever stop being transformed, this rule is no longer
  // needed and the comment above it becomes misleading.
  const source = readFileSync(join(HERE, 'GameGrid.jsx'), 'utf8')
  expect(source).toContain('transform: `translateY(')
  expect(source).toContain("position: 'absolute'")
})
