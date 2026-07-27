import { render, screen, within } from '@testing-library/react'
import { GameGrid } from './GameGrid'
import {
  chunkGamesIntoRows,
  computeGridColumns,
  estimateGridRowHeight,
} from './gameGridLayout'

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

test('estimateGridRowHeight uses 3:4 cover aspect', () => {
  // 4 cols in 900px with 10px gaps → tile ~217.5 → height ceil(290)
  expect(estimateGridRowHeight(900, 4, 10)).toBe(Math.ceil(217.5 * (4 / 3)))
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
