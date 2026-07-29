import { useRef } from 'react'
import { preferencesFromShell, savePreferences } from '../api/preferences'
import {
  clampTileVarsForNarrowViewport,
  normalizeTilePercent,
  tilePercentToCssVars,
  TILE_PERCENT_DEFAULT,
  TILE_PERCENT_MAX,
  TILE_PERCENT_MIN,
} from '../utils/tileSize'
import './TileSizeControl.css'

const PREF_SAVE_DEBOUNCE_MS = 320

export function applyTileSizeCssVars(sizeOrPercent) {
  const isNarrow =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 900px)').matches
  const vars = clampTileVarsForNarrowViewport(
    tilePercentToCssVars(sizeOrPercent),
    isNarrow,
  )
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
}

export function TileSizeControl({
  value = TILE_PERCENT_DEFAULT,
  onChange,
  shellConfig = {},
}) {
  const percent = normalizeTilePercent(value)
  const saveTimerRef = useRef(0)

  async function persist(normalized) {
    try {
      await savePreferences(
        preferencesFromShell(shellConfig, { tile_size: String(normalized) }),
      )
    } catch {
      // Preference persistence is best-effort; CSS vars already applied.
    }
  }

  function handleChange(nextPercent) {
    const normalized = normalizeTilePercent(nextPercent)
    applyTileSizeCssVars(normalized)
    onChange?.(String(normalized))

    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      // Persist a clean whole percent — the fractional value only matters
      // for the smooth in-flight drag feel, not for the saved preference.
      void persist(Math.round(normalized))
    }, PREF_SAVE_DEBOUNCE_MS)
  }

  const displayPercent = Math.round(percent)

  return (
    <div className="gt-tile-size" role="group" aria-label="Library tile size">
      <span className="gt-tile-size__label" aria-hidden="true">
        {displayPercent}%
      </span>
      <input
        type="range"
        className="gt-tile-size__slider"
        min={TILE_PERCENT_MIN}
        max={TILE_PERCENT_MAX}
        step="any"
        value={percent}
        aria-valuemin={TILE_PERCENT_MIN}
        aria-valuemax={TILE_PERCENT_MAX}
        aria-valuenow={displayPercent}
        aria-valuetext={`${displayPercent} percent`}
        aria-label="Library tile size percent"
        onChange={(event) => handleChange(Number(event.target.value))}
      />
    </div>
  )
}
