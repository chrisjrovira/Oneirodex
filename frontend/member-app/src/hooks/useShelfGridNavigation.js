import { useEffect } from 'react'

/**
 * Two-dimensional keyboard and controller navigation over a stack of shelves.
 *
 * Catalog Grid and Discover are both a vertical stack of horizontally
 * scrolling shelves, and that shape is the one that strands a focus ring. Every
 * tile was its own tab stop, so reaching the third shelf meant tabbing through
 * every tile on the first two; and nothing defined what Down means when the
 * shelf below is shorter than the column you are in, so focus either vanished
 * or stopped moving while the page visibly continued. That dead-end is the most
 * common complaint against 10-foot library UIs, and it is a navigation model
 * problem rather than a styling one.
 *
 * The model is the standard grid one:
 *
 *   - **One tab stop for the whole stack** (roving tabindex). Tab reaches the
 *     grid; Tab again leaves it. Where you were is where you return.
 *   - **Left/Right** move along a shelf, **Up/Down** between shelves.
 *   - **Home/End** go to the ends of the current shelf, and with Ctrl to the
 *     first and last cell of the whole stack.
 *   - **Arrows never change selection.** Moving and choosing are separate acts;
 *     Enter opens (the cell is a link, so the browser does this) and Space
 *     toggles selection where selection exists.
 *   - **The column is remembered.** Moving down into a short shelf clamps to
 *     its last cell, but the column you *asked* for is kept, so continuing down
 *     into a longer shelf returns you to it rather than leaving you pinned to
 *     the ragged edge.
 *
 * Nothing here owns focus styling: cells are links and buttons that already
 * have `:focus-visible`.
 */

const SHELF = '.od-shelf'
const CELL = '.od-shelf__item'

/** The thing that actually takes focus inside a cell. */
function targetIn(cell) {
  if (!cell) return null
  // `.od-shelf__more` ("See all") is a link that *is* the cell.
  if (cell.matches('a[href], button')) return cell
  return (
    cell.querySelector('.game-card__cover-link') ||
    cell.querySelector('a[href], button:not([disabled])') ||
    null
  )
}

function readGrid(root) {
  return (
    Array.from(root.querySelectorAll(SHELF))
      .map((shelf) => Array.from(shelf.querySelectorAll(CELL)).map(targetIn).filter(Boolean))
      // A shelf still loading has a placeholder and no cells. Dropping it here
      // rather than skipping it during a move means Down never lands on a row
      // with nowhere to go, and the shelf simply joins the model when it fills.
      .filter((row) => row.length > 0)
  )
}

function locate(grid, element) {
  for (let r = 0; r < grid.length; r += 1) {
    const c = grid[r].indexOf(element)
    if (c !== -1) return { row: r, col: c }
  }
  return null
}

export function useShelfGridNavigation(rootRef, { enabled = true } = {}) {
  useEffect(() => {
    const root = rootRef?.current
    if (!root || !enabled) return undefined

    // Where the caret is, and which column the user last *asked* for. The two
    // differ whenever a short shelf has clamped the move.
    const at = { row: 0, col: 0 }
    let wantedCol = 0
    let frame = 0
    // Set while this hook is moving focus itself. `focusin` fires for our own
    // `element.focus()` exactly as it does for a click, and without this guard
    // the handler below would sync `wantedCol` to the column the move just
    // *clamped* to — destroying the memory on the very move that needs it.
    let moving = false

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /** Exactly one cell in the stack is tabbable. */
    function applyRoving() {
      const grid = readGrid(root)
      if (!grid.length) return
      at.row = Math.min(at.row, grid.length - 1)
      at.col = Math.min(at.col, grid[at.row].length - 1)
      grid.forEach((row, r) => {
        row.forEach((element, c) => {
          element.tabIndex = r === at.row && c === at.col ? 0 : -1
        })
      })
    }

    /** Coalesced, because shelves fill in tile by tile as their fetches land. */
    function scheduleRoving() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        applyRoving()
      })
    }

    function moveTo(grid, row, col) {
      const clampedRow = Math.max(0, Math.min(row, grid.length - 1))
      const shelf = grid[clampedRow]
      const clampedCol = Math.max(0, Math.min(col, shelf.length - 1))
      const element = shelf[clampedCol]
      if (!element) return
      at.row = clampedRow
      at.col = clampedCol
      applyRoving()
      moving = true
      // `preventScroll` then an explicit scroll: the browser's own focus scroll
      // centres the element, which yanks a shelf sideways for a one-tile move.
      // `nearest` moves the minimum needed to reveal it.
      element.focus({ preventScroll: true })
      element.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
      moving = false
    }

    function onKeyDown(event) {
      if (event.altKey || event.metaKey) return
      const grid = readGrid(root)
      if (!grid.length) return

      const here = locate(grid, document.activeElement)
      if (!here) return
      at.row = here.row
      at.col = here.col

      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          wantedCol = at.col + 1
          moveTo(grid, at.row, at.col + 1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          wantedCol = Math.max(0, at.col - 1)
          moveTo(grid, at.row, at.col - 1)
          break
        case 'ArrowDown':
          event.preventDefault()
          // The remembered column, not the clamped one — see the header note.
          moveTo(grid, at.row + 1, wantedCol)
          break
        case 'ArrowUp':
          event.preventDefault()
          moveTo(grid, at.row - 1, wantedCol)
          break
        case 'Home':
          event.preventDefault()
          wantedCol = 0
          moveTo(grid, event.ctrlKey ? 0 : at.row, 0)
          break
        case 'End': {
          event.preventDefault()
          const row = event.ctrlKey ? grid.length - 1 : at.row
          wantedCol = grid[row].length - 1
          moveTo(grid, row, wantedCol)
          break
        }
        default:
          // Enter, Space and everything else belong to the cell. A tile's own
          // link handles Enter and its select control handles Space;
          // intercepting either here would be this hook deciding what a cell
          // does, which is not its job.
          break
      }
    }

    /** Clicking or tabbing into a cell makes that cell the caret. */
    function onFocusIn(event) {
      if (moving) return
      const grid = readGrid(root)
      const here = locate(grid, event.target)
      if (!here) return
      at.row = here.row
      at.col = here.col
      wantedCol = here.col
      applyRoving()
    }

    applyRoving()
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('focusin', onFocusIn)

    // Shelves fetch their own covers, so the grid's shape changes after mount
    // and keeps changing as the member scrolls. Without this the roving
    // tabindex describes the stack as it was at mount and every later tile is
    // an untabbable dead cell.
    const observer = new MutationObserver(scheduleRoving)
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('focusin', onFocusIn)
    }
  }, [rootRef, enabled])
}

export default useShelfGridNavigation
