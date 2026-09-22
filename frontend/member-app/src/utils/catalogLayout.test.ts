import { renderHook, act } from '@testing-library/react'
import {
  CATALOG_LAYOUT_KEY,
  CATALOG_ROW_HEIGHT,
  CATALOG_ROW_MAX_PX,
  CATALOG_ROW_MIN_PX,
  catalogRowHeightPx,
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

test('row height follows the tile slider between a floor and a ceiling', () => {
  expect(catalogRowHeightPx(180)).toBe(CATALOG_ROW_HEIGHT)
  expect(catalogRowHeightPx(80)).toBe(CATALOG_ROW_MIN_PX)
  expect(catalogRowHeightPx(400)).toBe(CATALOG_ROW_MAX_PX)
  expect(catalogRowHeightPx(260)).toBeGreaterThan(catalogRowHeightPx(180))
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
