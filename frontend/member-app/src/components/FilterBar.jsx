import { useEffect, useState } from 'react'
import { fetchFilterOptions } from '../api/filters'

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

export function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => {
      if (value === '' || value === undefined || value === null) {
        return false
      }
      if (key === 'rating' && (value === 0 || value === '0')) {
        return false
      }
      return true
    }),
  )
}

export function FilterBar({ filters, onApply, onClear, t = (key) => key }) {
  const [draft, setDraft] = useState(filters)
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [loadError, setLoadError] = useState(false)

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

  const update = (event) => {
    setDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const submit = (event) => {
    event.preventDefault()
    onApply(cleanFilters(draft))
  }

  const clear = () => {
    setDraft({})
    onClear()
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
      <div className="button-group">
        <button className="btn btn-primary" type="submit">{t('Apply')}</button>
        <button className="btn btn-secondary" type="button" onClick={clear}>
          {t('Clear')}
        </button>
      </div>
    </form>
  )
}
