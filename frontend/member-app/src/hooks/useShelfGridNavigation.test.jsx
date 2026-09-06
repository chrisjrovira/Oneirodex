import { useRef } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useShelfGridNavigation } from './useShelfGridNavigation'

beforeAll(() => {
  // jsdom has no layout, so scrollIntoView is not implemented on the prototype.
  // The hook calls it on every move; without this every move throws.
  Element.prototype.scrollIntoView = () => {}
})

/** A shelf stack with the shape the real Grid produces: ragged row lengths. */
function Stack({ shelves }) {
  const rootRef = useRef(null)
  useShelfGridNavigation(rootRef)
  return (
    <div ref={rootRef}>
      {shelves.map((count, row) => (
        <div className="od-shelf" key={`shelf-${row}`}>
          <div className="od-shelf__track" role="list">
            {Array.from({ length: count }, (_, col) => (
              <div className="od-shelf__item" role="listitem" key={`cell-${col}`}>
                <a className="game-card__cover-link" href={`/g/${row}-${col}`}>
                  {`r${row}c${col}`}
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function press(key, options = {}) {
  fireEvent.keyDown(document.activeElement, { key, ...options })
}

describe('useShelfGridNavigation', () => {
  it('makes the whole stack one tab stop', () => {
    const { container } = render(<Stack shelves={[3, 3]} />)
    const links = container.querySelectorAll('.game-card__cover-link')
    const tabbable = Array.from(links).filter((link) => link.tabIndex === 0)
    expect(links).toHaveLength(6)
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toHaveTextContent('r0c0')
  })

  it('moves along a shelf and between shelves', () => {
    const { container } = render(<Stack shelves={[3, 3]} />)
    container.querySelector('.game-card__cover-link').focus()

    press('ArrowRight')
    expect(document.activeElement).toHaveTextContent('r0c1')
    press('ArrowDown')
    expect(document.activeElement).toHaveTextContent('r1c1')
    press('ArrowLeft')
    expect(document.activeElement).toHaveTextContent('r1c0')
    press('ArrowUp')
    expect(document.activeElement).toHaveTextContent('r0c0')
  })

  it('does not dead-end at the edges', () => {
    const { container } = render(<Stack shelves={[2, 2]} />)
    container.querySelector('.game-card__cover-link').focus()

    // Up from the first shelf and Left from the first cell must hold position,
    // never blank the focus — losing the ring is the failure this hook exists
    // to prevent.
    press('ArrowUp')
    expect(document.activeElement).toHaveTextContent('r0c0')
    press('ArrowLeft')
    expect(document.activeElement).toHaveTextContent('r0c0')

    press('End')
    press('ArrowRight')
    expect(document.activeElement).toHaveTextContent('r0c1')
    press('ArrowDown')
    press('ArrowDown')
    expect(document.activeElement).toHaveTextContent('r1c1')
  })

  it('clamps into a short shelf but remembers the column', () => {
    const { container } = render(<Stack shelves={[4, 1, 4]} />)
    container.querySelector('.game-card__cover-link').focus()

    press('ArrowRight')
    press('ArrowRight')
    press('ArrowRight')
    expect(document.activeElement).toHaveTextContent('r0c3')

    // Shelf 1 has a single cell, so the move clamps...
    press('ArrowDown')
    expect(document.activeElement).toHaveTextContent('r1c0')

    // ...but the column asked for is not forgotten: shelf 2 is wide again.
    press('ArrowDown')
    expect(document.activeElement).toHaveTextContent('r2c3')
  })

  it('Home and End work per shelf, and Ctrl spans the stack', () => {
    const { container } = render(<Stack shelves={[3, 3]} />)
    container.querySelector('.game-card__cover-link').focus()

    press('End')
    expect(document.activeElement).toHaveTextContent('r0c2')
    press('Home')
    expect(document.activeElement).toHaveTextContent('r0c0')
    press('End', { ctrlKey: true })
    expect(document.activeElement).toHaveTextContent('r1c2')
    press('Home', { ctrlKey: true })
    expect(document.activeElement).toHaveTextContent('r0c0')
  })

  it('leaves Enter and Space to the cell', () => {
    const { container } = render(<Stack shelves={[2]} />)
    container.querySelector('.game-card__cover-link').focus()

    const enter = fireEvent.keyDown(document.activeElement, { key: 'Enter' })
    const space = fireEvent.keyDown(document.activeElement, { key: ' ' })
    // fireEvent returns false when a handler called preventDefault.
    expect(enter).toBe(true)
    expect(space).toBe(true)
    expect(document.activeElement).toHaveTextContent('r0c0')
  })

  it('takes over the roving stop when a cell is focused directly', () => {
    const { container } = render(<Stack shelves={[3, 3]} />)
    const links = container.querySelectorAll('.game-card__cover-link')

    fireEvent.focusIn(links[4], { target: links[4] })
    links[4].focus()
    expect(links[4].tabIndex).toBe(0)
    expect(links[0].tabIndex).toBe(-1)
  })
})
