/** Badge chip toggles for library browse (maps to /browse_games badge params). */

export const BADGE_FILTER_CHIPS = [
  { param: 'is_vr', label: 'VR', title: 'Virtual Reality titles' },
  { param: 'has_updates', label: 'UPDATE', title: 'Updates available' },
  { param: 'freshness_behind', label: 'OUT/~', title: 'Behind store version' },
  { param: 'new_import', label: 'NEW', title: 'Newly added to library' },
  { param: 'recent_release', label: 'RELEASE', title: 'Recent release window' },
  {
    param: 'needs_translation',
    label: 'LANG',
    title: 'ROM language may not match your preferred game language',
  },
]

export const BADGE_FILTER_PARAMS = BADGE_FILTER_CHIPS.map((chip) => chip.param)

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
    <div className="gt-badge-filter-chips" role="group" aria-label={t('Badge filters')}>
      {BADGE_FILTER_CHIPS.map((chip) => {
        const active = filters[chip.param] === '1'
        return (
          <button
            key={chip.param}
            type="button"
            className={`gt-badge-filter-chip${active ? ' is-active' : ''}`}
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
