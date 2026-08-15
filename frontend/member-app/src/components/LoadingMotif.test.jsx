import { render, screen } from '@testing-library/react'
import {
  LOADING_MOTIF_IDS,
  LoadingMotif,
  normalizeLoadingMotifId,
  pickLoadingMotifId,
} from './LoadingMotif'

/**
 * Motifs are consoles and controllers now (GT-B23) — the abstract ids this file
 * used to assert (ring/orbit/pulse/blocks/scan/arcade) are retired. The
 * behaviours under test are unchanged; only the vocabulary moved.
 */

test('renders locked motif id', () => {
  render(<LoadingMotif motifId="cart" title="Scanning" />)
  expect(screen.getByRole('img', { name: 'Scanning' })).toHaveAttribute('data-motif', 'cart')
})

test('falls back to a real motif for unknown ids', () => {
  // The old default was 'ring', which no longer exists in the markup map — that
  // would render an empty span rather than a fallback glyph.
  render(<LoadingMotif motifId="not-a-real-motif" />)
  const id = screen.getByRole('img').getAttribute('data-motif')
  expect(LOADING_MOTIF_IDS).toContain(id)
})

test('normalizeLoadingMotifId accepts catalogue ids only', () => {
  expect(normalizeLoadingMotifId('disc')).toBe('disc')
  expect(normalizeLoadingMotifId('NOPE')).toBe(null)
})

test('arcade resolves to the system, not the retired abstract motif', () => {
  // The one id that exists in both vocabularies. The system wins on purpose:
  // a cabinet is closer to what "arcade" meant than a d-pad would be.
  expect(normalizeLoadingMotifId('arcade')).toBe('arcade')
})

test('retired ids map forward instead of returning null', () => {
  // A member who picked one of the old motifs keeps a working choice; returning
  // null would silently drop everyone back to the default.
  expect(normalizeLoadingMotifId('ring')).toBe('disc')
  expect(normalizeLoadingMotifId('blocks')).toBe('cart')
})

test('pickLoadingMotifId respects lock mode', () => {
  expect(
    pickLoadingMotifId({ loading_icon_mode: 'lock', resolved_id: 'crt' }, null),
  ).toBe('crt')
})

test('pickLoadingMotifId reuses session pick when rotating', () => {
  expect(
    pickLoadingMotifId({ loading_icon_mode: 'rotate', resolved_id: null }, 'stick'),
  ).toBe('stick')
})

test('every catalogue id renders a glyph', () => {
  // Guards the failure that motivated the fallback fix: an id in the catalogue
  // with no entry in MARKUP renders an empty span, which looks like nothing is
  // loading at all.
  for (const id of LOADING_MOTIF_IDS) {
    const { container, unmount } = render(<LoadingMotif motifId={id} />)
    expect(container.querySelector('svg')).not.toBeNull()
    unmount()
  }
})
