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

  async function handleChange(nextPercent) {
    const normalized = normalizeTilePercent(nextPercent)
    applyTileSizeCssVars(normalized)
    onChange?.(String(normalized))

    try {
      await savePreferences(
        preferencesFromShell(shellConfig, { tile_size: String(normalized) }),
      )
    } catch {
      // Preference persistence is best-effort; CSS vars already applied.
    }
  }

  return (
    <div className="gt-tile-size" role="group" aria-label="Library tile size">
      <span className="gt-tile-size__label" aria-hidden="true">
        {percent}%
      </span>
      <input
        type="range"
        className="gt-tile-size__slider"
        min={TILE_PERCENT_MIN}
        max={TILE_PERCENT_MAX}
        step={1}
        value={percent}
        aria-valuemin={TILE_PERCENT_MIN}
        aria-valuemax={TILE_PERCENT_MAX}
        aria-valuenow={percent}
        aria-valuetext={`${percent} percent`}
        aria-label="Library tile size percent"
        onChange={(event) => handleChange(Number(event.target.value))}
      />
    </div>
  )
}
