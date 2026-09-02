import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import { GameGrid } from './GameGrid'
import {
  chunkGamesIntoRows,
  computeGridColumns,
  estimateGridRowHeight,
  findScrollParent,
} from './gameGridLayout'

const HERE = dirname(fileURLToPath(import.meta.url))

function makeGames(count) {
  return Array.from({ length: count }, (_, index) => ({
    uuid: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `Game ${index + 1}`,
    cover_url: '/static/library/images/cover.jpg',
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

test('estimateGridRowHeight uses 3:4 cover aspect and excludes the row gap', () => {
  // 4 cols in 900px with 10px gaps → tile ~217.5 → cover ceil(290). The gap
  // narrows the tile (and so the row), but is not added on top of it.
  expect(estimateGridRowHeight(900, 4, 10)).toBe(Math.ceil(217.5 * (4 / 3)))
})

test('the row height is the tiles only — the gap has exactly one owner', () => {
  // Single column isolates it: no inter-column gaps to change the tile width,
  // so the row height must be the bare cover height whatever the gap is.
  //
  // The gap used to be added here as well as being passed to the virtualizer
  // and set as `padding-bottom` on `.game-library-row` — three counts of one
  // gap. Rows are measured with `measureElement`, so measured and estimated
  // rows then disagreed by a whole gap and getTotalSize() drifted as rows came
  // into view, which is the dead space reported under the last row. The
  // virtualizer's own `gap` option is the single owner now, and it adds nothing
  // after the final row.
  expect(estimateGridRowHeight(300, 1, 12)).toBe(Math.ceil(300 * (4 / 3)))
  expect(estimateGridRowHeight(300, 1, 0)).toBe(Math.ceil(300 * (4 / 3)))
})

test('the row CSS does not re-add the gap it no longer owns', () => {
  const css = readFileSync(join(HERE, 'GameGrid.css'), 'utf8')
  const row = css.slice(css.indexOf('.game-library-row {'))
  expect(row.slice(0, row.indexOf('}'))).not.toMatch(/padding-bottom/)
})

test('library grid uses auto-fill so a lone tile stays tile-sized', () => {
  const css = readFileSync(join(HERE, 'GameGrid.css'), 'utf8')
  const start = css.indexOf(
    '.game-library-container[data-library-grid]:not([data-library-virtual]):not(.catalog-grid-sections) {',
  )
  expect(start).toBeGreaterThanOrEqual(0)
  const block = css.slice(start, css.indexOf('}', start))
  expect(block).toMatch(/repeat\(\s*auto-fill/)
  expect(block).not.toMatch(/auto-fit/)
})

test('findScrollParent finds the scrolling ancestor, not the window', () => {
  // The member shell locks the page and scrolls `.od-shell__main` instead, so a
  // window virtualizer never advances and everything past the first screenful
  // renders as empty space. jsdom has no layout, so this exercises the
  // computed-style walk rather than real scrolling.
  const scroller = document.createElement('div')
  scroller.style.overflowY = 'auto'
  const inner = document.createElement('div')
  const grid = document.createElement('div')
  inner.appendChild(grid)
  scroller.appendChild(inner)
  document.body.appendChild(scroller)

  expect(findScrollParent(grid)).toBe(scroller)

  const loose = document.createElement('div')
  document.body.appendChild(loose)
  expect(findScrollParent(loose)).toBe(null)

  document.body.removeChild(scroller)
  document.body.removeChild(loose)
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

  // The virtualizer should mount at least the first row's cards.
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

test('hovered tiles grow from the centre, not an edge', () => {
  const css = readFileSync(join(HERE, 'GameGrid.css'), 'utf8')
  expect(css).toMatch(/transform-origin:\s*center center/)
  expect(css).not.toMatch(/transform-origin:\s*center top/)
  expect(css).not.toMatch(/transform-origin:\s*left top/)
  expect(css).not.toMatch(/transform-origin:\s*right top/)
  expect(css).not.toMatch(/transform-origin:\s*left center/)
  expect(css).not.toMatch(/transform-origin:\s*right center/)
  // Padding the virtual container would not move absolute rows and would
  // throw getTotalSize off; bleed lives on the shell instead.
  const virtual = css.slice(css.indexOf('.game-library-container[data-library-virtual] {'))
  expect(virtual.slice(0, virtual.indexOf('}'))).not.toMatch(/padding-block-start/)
})

test('Play control on tiles uses --od-tile-* size tokens', () => {
  const css = readFileSync(join(HERE, '..', 'chrome', 'glass.css'), 'utf8')
  const start = css.indexOf('.game-card .od-tile-play {')
  expect(start).toBeGreaterThanOrEqual(0)
  const block = css.slice(start, css.indexOf('}', start))
  expect(block).toMatch(/var\(--od-tile-btn/)
  expect(block).not.toMatch(/min-width:\s*2\.5rem/)
})

test('rows layout puts one title on each virtual row', () => {
  render(<GameGrid games={makeGames(8)} layout="rows" showPlayStatus={false} isAdmin={false} />)
  const root = document.querySelector('[data-library-grid]')
  expect(root).toHaveAttribute('data-layout', 'rows')
  document.querySelectorAll('.game-library-row').forEach((row) => {
    expect(row.querySelectorAll('.game-card').length).toBe(1)
  })
  expect(screen.getByText('Game 1', { selector: '.game-card__row-title' })).toBeInTheDocument()
})

test('rows CSS sizes covers from the tile slider, not a fixed 4.75rem', () => {
  const css = readFileSync(join(HERE, 'GameGrid.css'), 'utf8')
  expect(css).toMatch(/--od-row-h:\s*clamp\(56px/)
  expect(css).not.toMatch(/\[data-layout='rows'\][^{]*\{[^}]*height:\s*4\.75rem/)
})

test('grid layout renders genre shelves instead of the wrap virtualizer', () => {
  const games = makeGames(4).map((game, index) => ({
    ...game,
    genres: index < 2 ? ['Action'] : ['RPG'],
  }))
  render(<GameGrid games={games} layout="grid" showPlayStatus={false} isAdmin={false} />)
  const root = document.querySelector('.catalog-grid-sections')
  expect(root).toHaveAttribute('data-layout', 'grid')
  expect(root).toHaveAttribute('data-library-shelves')
  // Must not carry data-library-grid — shell hover-pad pullback clips titles.
  expect(root).not.toHaveAttribute('data-library-grid')
  expect(root.style.getPropertyValue('--od-tile-min')).toBe('')
  expect(root.querySelectorAll('.od-shelf').length).toBe(2)
  expect(screen.getByText('Action')).toBeInTheDocument()
  expect(screen.getByText('RPG')).toBeInTheDocument()
  expect(document.querySelector('[data-library-virtual]')).toBeNull()
})

test('catalog grid CSS keeps shelves out of the shell tile pullback', () => {
  const css = readFileSync(join(HERE, 'CatalogGridSections.css'), 'utf8')
  expect(css).toMatch(/margin-inline:\s*0/)
  expect(css).toMatch(/\.catalog-grid-sections \.od-shelf__head/)
  expect(css).toMatch(/padding-inline-start:\s*var\(--od-gutter/)
})
