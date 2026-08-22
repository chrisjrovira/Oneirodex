import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { DiscoverShelf, formatEventEnds } from './DiscoverShelf'

function section(overrides = {}) {
  return {
    identifier: 'latest_games',
    title: 'Latest Games',
    layout: 'shelf',
    games: [
      { uuid: 'a', name: 'Alpha', cover_url: '/a.jpg', genres: [] },
      { uuid: 'b', name: 'Beta', cover_url: '/b.jpg', genres: [] },
    ],
    ...overrides,
  }
}

function renderShelf(props = {}) {
  return render(
    <MemoryRouter>
      <DiscoverShelf section={section()} {...props} />
    </MemoryRouter>,
  )
}

test('renders one horizontal track, not a wrapping grid', () => {
  // Discover used to render the library grid, which wraps and virtualises
  // vertically — so eight games became two or three stacked rows under one
  // heading, and the tile-size slider changed the number of lines rather than
  // the size of the tiles.
  const { container } = renderShelf()

  expect(screen.getByRole('heading', { name: 'Latest Games' })).toBeInTheDocument()
  expect(container.querySelectorAll('.gt-shelf__track')).toHaveLength(1)
  expect(container.querySelectorAll('.gt-shelf__cell')).toHaveLength(2)
  expect(container.querySelector('[data-library-virtual]')).toBeNull()
})

test('the pin control reports its state and reaches the section', async () => {
  // "Pinning does nothing and has no indicator" — there was no pin at all.
  const user = userEvent.setup()
  const onTogglePin = vi.fn()
  const { container, rerender } = renderShelf({ onTogglePin })

  const pin = screen.getByRole('button', { name: 'Pin Latest Games to the top of Discover' })
  expect(pin).toHaveAttribute('aria-pressed', 'false')
  expect(container.querySelector('[data-pinned]')).toBeNull()

  await user.click(pin)
  expect(onTogglePin).toHaveBeenCalledWith('latest_games')

  rerender(
    <MemoryRouter>
      <DiscoverShelf section={section()} onTogglePin={onTogglePin} pinned />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Unpin Latest Games' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Two indicators on purpose: the button says it to the person using it, the
  // section attribute and the chip say it from across the page.
  expect(container.querySelector('[data-pinned="true"]')).not.toBeNull()
  expect(screen.getByText('Pinned')).toBeInTheDocument()
})

test('edge buttons exist and stay hidden until there is somewhere to scroll', () => {
  const { container } = renderShelf()
  // Queried from the DOM, not by role: `hidden` takes them out of the
  // accessibility tree, which is the point of using it rather than CSS.
  const edges = container.querySelectorAll('.gt-shelf__edge')
  expect(edges).toHaveLength(2)
  // jsdom reports zero-size boxes, so nothing overflows and both are hidden —
  // the correct resting state, and what this pins.
  edges.forEach((edge) => expect(edge).toHaveAttribute('hidden'))
  expect(edges[0]).toHaveAttribute('aria-label', 'Scroll Latest Games left')
  expect(edges[1]).toHaveAttribute('aria-label', 'Scroll Latest Games right')
})

test('an empty shelf renders nothing at all', () => {
  const { container } = render(
    <MemoryRouter>
      <DiscoverShelf section={section({ games: [] })} />
    </MemoryRouter>,
  )
  expect(container.firstChild).toBeNull()
})

test('formatEventEnds omits anything it cannot state honestly', () => {
  expect(formatEventEnds(null)).toBe('')
  expect(formatEventEnds('not a date')).toBe('')
  expect(formatEventEnds(new Date(Date.now() - 1000).toISOString())).toBe('')
  expect(formatEventEnds(new Date(Date.now() + 3 * 86_400_000).toISOString())).toMatch(
    /ends in 3 days/,
  )
})
