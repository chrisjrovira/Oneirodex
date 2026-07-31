import { render, screen } from '@testing-library/react'
import { LoadingMotif, normalizeLoadingMotifId, pickLoadingMotifId } from './LoadingMotif'

test('renders locked motif id', () => {
  render(<LoadingMotif motifId="blocks" title="Scanning" />)
  const icon = screen.getByRole('img', { name: 'Scanning' })
  expect(icon).toHaveAttribute('data-motif', 'blocks')
})

test('falls back to ring for unknown ids', () => {
  render(<LoadingMotif motifId="not-a-real-motif" />)
  expect(screen.getByRole('img')).toHaveAttribute('data-motif', 'ring')
})

test('normalizeLoadingMotifId accepts catalogue ids only', () => {
  expect(normalizeLoadingMotifId('orbit')).toBe('orbit')
  expect(normalizeLoadingMotifId('NOPE')).toBe(null)
})

test('pickLoadingMotifId respects lock mode', () => {
  expect(
    pickLoadingMotifId({ loading_icon_mode: 'lock', resolved_id: 'scan' }, null),
  ).toBe('scan')
})

test('pickLoadingMotifId reuses session pick when rotating', () => {
  expect(
    pickLoadingMotifId({ loading_icon_mode: 'rotate', resolved_id: null }, 'arcade'),
  ).toBe('arcade')
})
