import { useState } from 'react'

export const CATALOG_LAYOUT_KEY = 'od.library.layout'

export const CATALOG_LAYOUTS = [
  { id: 'tile', label: 'Tile' },
  { id: 'rows', label: 'Rows' },
  { id: 'grid', label: 'Grid' },
]

/** Fallback Rows height when tile min is unknown. Equals catalogRowHeightPx(180). */
export const CATALOG_ROW_HEIGHT = 76

/** Rows cover height tracks the tile slider (keep in sync with GameGrid.css). */
export const CATALOG_ROW_MIN_PX = 56
export const CATALOG_ROW_MAX_PX = 144
export const CATALOG_ROW_SCALE = 0.42

export function catalogRowHeightPx(tileMin) {
  const base = Number(tileMin)
  if (!Number.isFinite(base) || base <= 0) return CATALOG_ROW_HEIGHT
  return Math.round(
    Math.min(
      CATALOG_ROW_MAX_PX,
      Math.max(CATALOG_ROW_MIN_PX, base * CATALOG_ROW_SCALE),
    ),
  )
}

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

export function useCatalogLayout() {
  const [layout, setLayoutState] = useState(readCatalogLayout)
  function setLayout(next) {
    setLayoutState(persistCatalogLayout(next))
  }
  return [layout, setLayout]
}
