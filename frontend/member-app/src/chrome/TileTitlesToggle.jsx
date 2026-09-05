import { useRef } from 'react'
import { preferencesFromShell, savePreferences } from '../api/preferences'
import './TileTitlesToggle.css'

const PREF_SAVE_DEBOUNCE_MS = 320

/**
 * Show/hide the title strip under catalog covers.
 *
 * Sits beside the tile-size slider because it answers the same question — how
 * much of each tile do I want — and is gated to the same routes, since those
 * are the ones that render tiles at all.
 */
export function TileTitlesToggle({ value = true, onChange, shellConfig = {} }) {
  const saveTimerRef = useRef(0)

  function handleChange(event) {
    const next = event.target.checked
    onChange?.(next)
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      // Best-effort, exactly like the tile-size slider: the CSS var is already
      // applied, so a failed save costs the persistence and not the view.
      savePreferences(
        preferencesFromShell(shellConfig, {
          show_tile_titles: next ? 'true' : 'false',
        }),
      ).catch(() => {})
    }, PREF_SAVE_DEBOUNCE_MS)
  }

  return (
    <label className="od-tile-titles" title="Show game titles under covers">
      <input
        type="checkbox"
        className="od-tile-titles__input"
        checked={Boolean(value)}
        onChange={handleChange}
      />
      <span className="od-tile-titles__label">Titles</span>
    </label>
  )
}
