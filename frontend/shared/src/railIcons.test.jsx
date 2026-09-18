import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { RailIcon, railIconPaths, RAIL_VIEWBOX } from './railIcons'

test('every rail destination has a glyph, including the one admin used to miss', () => {
  // `ways-to-play` existed only in the member copy before these were merged —
  // the drift that motivated the move.
  expect(railIconPaths['ways-to-play']).toBeTruthy()
  expect(Object.keys(railIconPaths).length).toBeGreaterThanOrEqual(30)
})

test('renders a padded viewBox so a 2px edge stroke is not sliced in half', () => {
  const { container } = render(<RailIcon name="activity" />)
  const svg = container.querySelector('svg')
  expect(svg).toBeTruthy()
  expect(svg.getAttribute('viewBox')).toBe(RAIL_VIEWBOX)
  expect(svg.getAttribute('data-icon')).toBe('activity')
  // currentColor throughout, so the icon-pack tokens restyle per theme.
  expect(svg.getAttribute('stroke')).toBe('currentColor')
})

test('an unknown id renders nothing rather than a dot', () => {
  const { container } = render(<RailIcon name="no-such-destination" />)
  expect(container.querySelector('svg')).toBeNull()
})

test('size drives both dimensions', () => {
  const { container } = render(<RailIcon name="activity" size={32} />)
  const svg = container.querySelector('svg')
  expect(svg.getAttribute('width')).toBe('32')
  expect(svg.getAttribute('height')).toBe('32')
})
