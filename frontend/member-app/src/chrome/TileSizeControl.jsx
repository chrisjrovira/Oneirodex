import { preferencesFromShell, savePreferences } from '../api/preferences'
import { tileSizeToCssVars } from '../utils/tileSize'
import './TileSizeControl.css'

const SIZES = ['S', 'M', 'L', 'XL']

export function applyTileSizeCssVars(size) {
  const vars = tileSizeToCssVars(size)
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
}

export function TileSizeControl({
  value = 'M',
  onChange,
  shellConfig = {},
}) {
  const index = Math.max(0, SIZES.indexOf(value))

  async function handleSelect(size) {
    if (size === value) {
      return
    }

    applyTileSizeCssVars(size)
    onChange?.(size)

    try {
      await savePreferences(
        preferencesFromShell(shellConfig, { tile_size: size }),
      )
    } catch {
      // Preference persistence is best-effort; CSS vars already applied.
    }
  }

  return (
    <div className="gt-tile-size" role="group" aria-label="Library tile size">
      <span className="gt-tile-size__label" aria-hidden="true">
        {SIZES[index]}
      </span>
      <input
        type="range"
        className="gt-tile-size__slider"
        min={0}
        max={SIZES.length - 1}
        step={1}
        value={index}
        aria-valuetext={SIZES[index]}
        aria-label="Library tile size"
        onChange={(event) => handleSelect(SIZES[Number(event.target.value)])}
      />
    </div>
  )
}
