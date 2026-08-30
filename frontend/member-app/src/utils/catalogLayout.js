import { useState } from 'react'

export const CATALOG_LAYOUT_KEY = 'gt.library.layout'

export const CATALOG_LAYOUTS = [
  { id: 'tile', label: 'Tile' },
  { id: 'rows', label: 'Rows' },
  { id: 'grid', label: 'Grid' },
]

/** Resting height of one Rows-mode title. Keep in sync with GameGrid.css. */
export const CATALOG_ROW_HEIGHT = 76

export function normalizeCatalogLayout(value) {
  if (value === 'tile' || value === 'rows' || value === 'grid') return value
  return 'tile'
}

export function readCatalogLayout() {
  try {
    return normalizeCatalogLayout(window.localStorage.getItem(CATALOG_LAYOUT_KEY))
  } catch {
    return 'tile'
  }
}

export function persistCatalogLayout(value) {
  const next = normalizeCatalogLayout(value)
  try {
    window.localStorage.setItem(CATALOG_LAYOUT_KEY, next)
  } catch {
    // View preference only.
  }
  return next
}

/**
 * Grid mode: same slider, denser tracks.
 *
 * 0.58 of the Tile min, floored at 108px, so a page of covers still reads as
 * covers rather than icons, but two extra columns fit on a typical desktop.
 */
export function denseCatalogTileMin(baseMin) {
  const base = Number(baseMin)
  if (!Number.isFinite(base) || base <= 0) return 108
  return Math.max(108, Math.round(base * 0.58))
}

export function useCatalogLayout() {
  const [layout, setLayoutState] = useState(readCatalogLayout)
  function setLayout(next) {
    setLayoutState(persistCatalogLayout(next))
  }
  return [layout, setLayout]
}
