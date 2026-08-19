import { useEffect, useRef, useState } from 'react'
import { fetchFilterOptions } from '../api/filters'
import { BADGE_FILTER_CHIPS, toggleBadgeFilter } from './BadgeFilterChips'
import {
  ITEM_KIND_FILTER_CHIPS,
  parseItemKindFilter,
  toggleItemKindFilter,
} from './ItemKindFilterChips'

const EMPTY_OPTIONS = {
  libraries: [],
  libraryPlatforms: [],
  igdbPlatforms: [],
  genres: [],
  themes: [],
  gameModes: [],
  playerPerspectives: [],
}

const SELECTS = [
  ['library_uuid', 'Library', 'All Libraries', 'libraries', 'uuid', 'name'],
  ['library_platform', 'System / console', 'All systems', 'libraryPlatforms', 'value', 'name'],
  ['igdb_platform', 'Catalog platform', 'All catalog platforms', 'igdbPlatforms', 'name', 'name'],
  ['genre', 'Genre', 'All Genres', 'genres', 'name', 'name'],
  ['theme', 'Theme', 'All Themes', 'themes', 'name', 'name'],
  ['game_mode', 'Game mode', 'All Game Modes', 'gameModes', 'name', 'name'],
  ['player_perspective', 'Player perspective', 'All Perspectives', 'playerPerspectives', 'name', 'name'],
]

/** localStorage: '1' = LHN expanded (default), '0' = collapsed rail. */
export const FILTERS_VISIBLE_KEY = 'gt.library.filtersVisible'
/** Debounce for type-to-search title filter (ms). */
export const LIBRARY_SEARCH_DEBOUNCE_MS = 300

export function readFiltersVisible() {
  try {
    const raw = window.localStorage?.getItem(FILTERS_VISIBLE_KEY)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    /* ignore */
  }
  return true
}

export function writeFiltersVisible(visible) {
  try {
    window.localStorage?.setItem(FILTERS_VISIBLE_KEY, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => {
      if (value === '' || value === undefined || value === null) {
        return false
      }
      if (key === 'rating' && (value === 0 || value === '0')) {
        return false
      }
      if (key === 'name' && typeof value === 'string' && !value.trim()) {
        return false
      }
      return true
    }),
  )
}

function CollapseChevron({ collapsed }) {
  return (
    <svg
      className="library-filters-collapse__icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {collapsed ? (
        <path
          fill="currentColor"
          d="M5.47 2.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L9.44 8 5.47 4.03a.75.75 0 0 1 0-1.06z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M10.53 2.97a.75.75 0 0 0-1.06 0l-4.5 4.5a.75.75 0 0 0 0 1.06l4.5 4.5a.75.75 0 1 0 1.06-1.06L6.56 8l3.97-3.97a.75.75 0 0 0 0-1.06z"
        />
      )}
    </svg>
  )
}

/**
 * Slim arrow that collapses/expands the Library LHN so the game grid reflows.
 * Rendered by LibraryApp (layout owns width); kept next to FilterBar for a11y labels.
 */
export function LibraryFiltersCollapseToggle({
  collapsed,
  onToggle,
  controlsId,
  t = (key) => key,
}) {
  return (
    <button
      type="button"
      className="library-filters-collapse"
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      title={collapsed ? t('Show filters') : t('Hide filters')}
      onClick={onToggle}
    >
      <CollapseChevron collapsed={collapsed} />
      <span className="visually-hidden">
        {collapsed ? t('Show filters') : t('Hide filters')}
      </span>
    </button>
  )
}

export function FilterBar({
  filters,
  onApply,
  onClear,
  onLiveSearch,
  t = (key) => key,
  // UIR-2: the two-bar chrome promotes Kind to a segmented control in the
  // context bar. Rendering it here as well would give one filter two controls,
  // so the panel yields ownership rather than duplicating it.
  hideKind = false,
  // Supplied by the popover host. The panel owns its own dismiss control so the
  // popover does not have to draw a head row around it — see Popover's
  // `chromeless` prop. Absent in the rail layout, where the panel is not a
  // popover and there is nothing to close.
  onDone = null,
}) {
  const [draft, setDraft] = useState(filters)
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [loadError, setLoadError] = useState(false)
  const searchTimerRef = useRef(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    setDraft(filters)
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    fetchFilterOptions({ signal: controller.signal })
      .then(setOptions)
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadError(true)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(
    () => () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    },
    [],
  )

  const update = (event) => {
    setDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const applyLiveName = (nameValue) => {
    const next = cleanFilters({
      ...draftRef.current,
      name: typeof nameValue === 'string' ? nameValue.trim() : nameValue,
    })
    if (onLiveSearch) {
      onLiveSearch(next)
    } else {
      onApply(next)
    }
  }

  const onSearchChange = (event) => {
    const value = event.target.value
    setDraft((current) => ({
      ...current,
      name: value,
    }))
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    searchTimerRef.current = setTimeout(() => {
      applyLiveName(value)
    }, LIBRARY_SEARCH_DEBOUNCE_MS)
  }

  const submit = (event) => {
    event.preventDefault()
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    onApply(cleanFilters(draft))
  }

  const clear = () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    setDraft({})
    onClear()
  }

  const applyBadgeToggle = (next) => {
    setDraft(next)
    onApply(next)
  }

  const selects = SELECTS.map(([name, label, emptyLabel, source, valueField, textField]) => [
    name,
    t(label),
    t(emptyLabel),
    source,
    valueField,
    textField,
  ])

  return (
    <form className="container-filtersandsort library-filters" onSubmit={submit}>
      <div className="library-filters__toolbar">
        <label className="library-filters__search">
          <span className="visually-hidden">{t('Search library')}</span>
          <input
            type="search"
            className="form-control library-filters__search-input"
            name="name"
            value={draft.name ?? ''}
            placeholder={t('Search by title')}
            aria-label={t('Search library by title')}
            autoComplete="off"
            onChange={onSearchChange}
          />
        </label>
      </div>

      <div id="library-filters-body" className="library-filters__body">
        {loadError && <p role="alert">{t('Unable to load filter options.')}</p>}
        {selects.map(([name, label, emptyLabel, source, valueField, textField]) => (
          <label key={name}>
            {label}
            <select
              className="form-control"
              name={name}
              value={draft[name] ?? ''}
              onChange={update}
            >
              <option value="">{emptyLabel}</option>
              {options[source].map((option) => (
                <option
                  key={option.id ?? option[valueField]}
                  value={option[valueField]}
                >
                  {option[textField]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          {t('Companion')}
          <select
            className="form-control"
            name="installed_only"
            value={draft.installed_only ?? ''}
            onChange={update}
          >
            <option value="">{t('All games')}</option>
            <option value="1">{t('Companion installed')}</option>
          </select>
        </label>
        <label>
          {t('Rating')}
          <input
            type="range"
            className="form-control-range rating-slider"
            name="rating"
            min="0"
            max="100"
            value={draft.rating ?? '0'}
            onChange={update}
          />
          <span>{draft.rating ?? '0'}</span>
        </label>
        <label>
          {t('Sort by')}
          <select
            className="form-control"
            name="sort_by"
            value={draft.sort_by ?? 'name'}
            onChange={update}
          >
            <option value="name">{t('Name')}</option>
            <option value="rating">{t('Rating')}</option>
            <option value="first_release_date">{t('Date Released')}</option>
            <option value="date_identified">{t('Date Added')}</option>
            <option value="size">{t('Filesize')}</option>
          </select>
        </label>
        <label>
          {t('Sort order')}
          <select
            className="form-control"
            name="sort_order"
            value={draft.sort_order ?? 'asc'}
            onChange={update}
          >
            <option value="asc">{t('Ascending')}</option>
            <option value="desc">{t('Descending')}</option>
          </select>
        </label>

        {hideKind ? null : (
        <fieldset className="library-filters__signals">
          <legend>{t('Kind')}</legend>
          <div className="gt-badge-filter-chips" role="group" aria-label={t('Kind filters')}>
            {ITEM_KIND_FILTER_CHIPS.map((chip) => {
              const active = parseItemKindFilter(
                filters.item_kind ?? draft.item_kind,
              ).includes(chip.kind)
              return (
                <button
                  key={chip.kind}
                  type="button"
                  className={`gt-badge-filter-chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  title={t(chip.title)}
                  onClick={() =>
                    toggleItemKindFilter(filters, chip.kind, applyBadgeToggle, cleanFilters)
                  }
                >
                  {t(chip.label)}
                </button>
              )
            })}
          </div>
        </fieldset>
        )}
        <fieldset className="library-filters__signals">
          <legend>{t('Signals')}</legend>
          <div className="gt-badge-filter-chips" role="group" aria-label={t('Badge filters')}>
            {BADGE_FILTER_CHIPS.map((chip) => {
              const active = (filters[chip.param] ?? draft[chip.param]) === '1'
              return (
                <button
                  key={chip.param}
                  type="button"
                  className={`gt-badge-filter-chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  title={t(chip.title)}
                  onClick={() =>
                    toggleBadgeFilter(filters, chip.param, applyBadgeToggle, cleanFilters)
                  }
                >
                  {t(chip.label)}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="button-group">
          <button className="gt-btn gt-btn--primary" type="submit">{t('Apply')}</button>
          <button className="gt-btn gt-btn--secondary" type="button" onClick={clear}>
            {t('Clear')}
          </button>
          {onDone ? (
            <button
              className="gt-btn gt-btn--secondary library-filters__done"
              type="button"
              onClick={onDone}
            >
              {t('Done')}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
