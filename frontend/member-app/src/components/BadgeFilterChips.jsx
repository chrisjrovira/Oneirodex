/** Badge chip toggles for library browse (maps to /browse_games badge params). */

/** Chips shown in the Library LHN panel. VR is tile badge-only — not a filter chip. */
export const BADGE_FILTER_CHIPS = [
  { param: 'has_updates', label: 'Update', title: 'Updates available' },
  { param: 'path_missing', label: 'Missing', title: 'Removed from disk' },
  { param: 'new_import', label: 'New', title: 'Newly added to library' },
  {
    param: 'needs_translation',
    label: 'Lang',
    title: 'ROM language may not match your preferred game language',
  },
]

/**
 * URL/API badge params still recognized (includes legacy deep-links).
 * freshness_behind / recent_release stay parseable for old URLs but have no chip
 * after OUT/~ / RELEASE retirement (2026-08-01).
 */
export const BADGE_FILTER_PARAMS = [
  'is_vr',
  'freshness_behind',
  'recent_release',
  ...BADGE_FILTER_CHIPS.map((chip) => chip.param),
]

/**
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, string>}
 */
export function badgeFiltersFromSearchParams(searchParams) {
  const next = {}
  for (const param of BADGE_FILTER_PARAMS) {
    const value = searchParams.get(param)
    if (value === '1' || value === 'true' || value === 'yes') {
      next[param] = '1'
    }
  }
  return next
}

/**
 * Toggle a badge filter param and apply via onApply(cleanFilters(...)).
 * @param {object} filters
 * @param {string} param
 * @param {(next: object) => void} onApply
 * @param {(filters: object) => object} cleanFilters
 */
export function toggleBadgeFilter(filters, param, onApply, cleanFilters) {
  const active = filters[param] === '1'
  const next = { ...filters }
  if (active) {
    delete next[param]
  } else {
    next[param] = '1'
  }
  onApply(cleanFilters(next))
}

export function BadgeFilterChips({
  filters,
  onApply,
  cleanFilters,
  t = (key) => key,
}) {
  return (
    <div className="od-badge-filter-chips" role="group" aria-label={t('Badge filters')}>
      {BADGE_FILTER_CHIPS.map((chip) => {
        const active = filters[chip.param] === '1'
        return (
          <button
            key={chip.param}
            type="button"
            className={`od-badge-filter-chip${active ? ' is-active' : ''}`}
            aria-pressed={active}
            title={t(chip.title)}
            onClick={() => toggleBadgeFilter(filters, chip.param, onApply, cleanFilters)}
          >
            {t(chip.label)}
          </button>
        )
      })}
    </div>
  )
}
