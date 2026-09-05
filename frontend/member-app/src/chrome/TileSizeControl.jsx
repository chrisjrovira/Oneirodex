import { useEffect, useRef } from 'react'
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

/** Shorter than the save debounce: the transition should return as soon as the
 *  drag stops, not wait for the round-trip that persists it. */
const TILE_RESIZE_SETTLE_MS = 120

export function applyTileSizeCssVars(sizeOrPercent, showTitles) {
  // Omitted means "leave the title preference alone". The slider calls this on
  // every drag with only a size; defaulting to `true` there would turn the
  // strip back on for anyone who had switched it off, which is the same
  // partial-update clobbering `preferencesFromShell` has to guard against.
  const titlesOn =
    showTitles === undefined
      ? document.documentElement.dataset.odTileTitles !== 'off'
      : Boolean(showTitles)
  const isNarrow =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 900px)').matches
  const vars = clampTileVarsForNarrowViewport(
    tilePercentToCssVars(sizeOrPercent, titlesOn),
    isNarrow,
  )
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
  // A zero-height box is not reliably announced, so titles-off needs the real
  // visually-hidden treatment rather than just `--od-tile-title-h: 0px`. CSS
  // cannot branch on a variable's value; it can branch on this.
  document.documentElement.dataset.odTileTitles = titlesOn ? 'on' : 'off'
}

export function TileSizeControl({
  value = TILE_PERCENT_DEFAULT,
  onChange,
  shellConfig = {},
}) {
  const percent = normalizeTilePercent(value)
  const saveTimerRef = useRef(0)
  const resizeTimerRef = useRef(0)
  const pendingSaveRef = useRef(null)

  async function persist(normalized) {
    try {
      await savePreferences(
        preferencesFromShell(shellConfig, { tile_size: String(normalized) }),
      )
    } catch {
      // Preference persistence is best-effort; CSS vars already applied.
    }
  }

  // Kept current so the unmount cleanup below uses the latest `shellConfig`
  // rather than whatever the first render closed over.
  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  })

  useEffect(() => () => {
    // Both timers outlive the component, and both do damage unattended.
    //
    // `is-tile-resizing` lives on <html>, not on anything React unmounts, so
    // clearing the timer without removing the class would leave the library
    // permanently without its tile-size transition. Remove it here.
    window.clearTimeout(resizeTimerRef.current)
    document.documentElement.classList.remove('is-tile-resizing')

    // The save is debounced, so unmounting mid-drag (navigating away straight
    // after moving the slider) still owes one. Dropping it loses the change the
    // user just made; flushing is safe because `persist` never sets state.
    window.clearTimeout(saveTimerRef.current)
    if (pendingSaveRef.current !== null) {
      void persistRef.current(pendingSaveRef.current)
      pendingSaveRef.current = null
    }
  }, [])

  function handleChange(nextPercent) {
    const normalized = normalizeTilePercent(nextPercent)

    // Suppress the tile-size transition while the slider is moving (W27-B2).
    //
    // `html` transitions --od-tile-min over 0.22s, which is right for a
    // discrete change (restoring a saved preference) and wrong during a drag:
    // the rendered size chases the slider a fifth of a second behind, and every
    // grid reflow threshold is crossed mid-animation. Two things animating the
    // same value — the transition and the user's finger — is what reads as the
    // tiles jumping rather than tracking.
    //
    // The class is cleared shortly after input stops, so the transition is back
    // in place before any programmatic change needs it.
    document.documentElement.classList.add('is-tile-resizing')
    window.clearTimeout(resizeTimerRef.current)
    resizeTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('is-tile-resizing')
    }, TILE_RESIZE_SETTLE_MS)

    applyTileSizeCssVars(normalized)
    onChange?.(String(normalized))

    // Persist a clean whole percent — the fractional value only matters
    // for the smooth in-flight drag feel, not for the saved preference.
    pendingSaveRef.current = Math.round(normalized)
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      const owed = pendingSaveRef.current
      pendingSaveRef.current = null
      void persist(owed)
    }, PREF_SAVE_DEBOUNCE_MS)
  }

  const displayPercent = Math.round(percent)

  return (
    <div className="od-tile-size" role="group" aria-label="Game Catalog tile size">
      {/* The resting affordance. The slider collapses to nothing until you are
          on it, so without this the control would be an invisible gap in the
          bar — you cannot hover what you cannot see. Drawn in CSS as a 2x2 dot
          grid rather than shipped as an icon: it is four dots. */}
      <span className="od-tile-size__grip" aria-hidden="true" />
      <span className="od-tile-size__label" aria-hidden="true">
        {displayPercent}%
      </span>
      <input
        type="range"
        className="od-tile-size__slider"
        min={TILE_PERCENT_MIN}
        max={TILE_PERCENT_MAX}
        step="any"
        value={percent}
        aria-valuemin={TILE_PERCENT_MIN}
        aria-valuemax={TILE_PERCENT_MAX}
        aria-valuenow={displayPercent}
        aria-valuetext={`${displayPercent} percent`}
        aria-label="Game Catalog tile size percent"
        onChange={(event) => handleChange(Number(event.target.value))}
      />
    </div>
  )
}
