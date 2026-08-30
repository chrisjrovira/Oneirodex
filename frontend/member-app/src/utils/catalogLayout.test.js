import { renderHook, act } from '@testing-library/react'
import {
  CATALOG_LAYOUT_KEY,
  denseCatalogTileMin,
  normalizeCatalogLayout,
  persistCatalogLayout,
  readCatalogLayout,
  useCatalogLayout,
} from './catalogLayout'

afterEach(() => {
  window.localStorage.removeItem(CATALOG_LAYOUT_KEY)
})

test('unknown values fall back to tile', () => {
  expect(normalizeCatalogLayout('card')).toBe('tile')
  expect(normalizeCatalogLayout('')).toBe('tile')
  expect(normalizeCatalogLayout('rows')).toBe('rows')
})

test('dense grid min is a fraction of the slider, never smaller than 108', () => {
  expect(denseCatalogTileMin(180)).toBe(Math.max(108, Math.round(180 * 0.58)))
  expect(denseCatalogTileMin(80)).toBe(108)
})

test('the hook remembers the last layout', () => {
  persistCatalogLayout('grid')
  expect(readCatalogLayout()).toBe('grid')

  const { result } = renderHook(() => useCatalogLayout())
  expect(result.current[0]).toBe('grid')
  act(() => {
    result.current[1]('rows')
  })
  expect(result.current[0]).toBe('rows')
  expect(window.localStorage.getItem(CATALOG_LAYOUT_KEY)).toBe('rows')
})
