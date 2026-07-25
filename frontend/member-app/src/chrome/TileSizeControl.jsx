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
    <div className="gt-tile-size" role="group" aria-label="Tile size">
      {SIZES.map((size) => (
        <button
          key={size}
          type="button"
          className={`gt-tile-size__btn${value === size ? ' is-active' : ''}`}
          aria-pressed={value === size}
          onClick={() => handleSelect(size)}
        >
          {size}
        </button>
      ))}
    </div>
  )
}