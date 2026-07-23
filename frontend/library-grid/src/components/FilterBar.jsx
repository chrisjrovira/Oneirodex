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
  ['library_platform', 'Library platform', 'All Library Platforms', 'libraryPlatforms', 'value', 'name'],
  ['igdb_platform', 'IGDB platform', 'All IGDB Platforms', 'igdbPlatforms', 'name', 'name'],
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

export function FilterBar({ filters, onApply, onClear }) {
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

  return (
    <form className="container-filtersandsort library-filters" onSubmit={submit}>
      {loadError && <p role="alert">Unable to load filter options.</p>}
      {SELECTS.map(([name, label, emptyLabel, source, valueField, textField]) => (
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
        Rating
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
        Sort by
        <select
          className="form-control"
          name="sort_by"
          value={draft.sort_by ?? 'name'}
          onChange={update}
        >
          <option value="name">Name</option>
          <option value="rating">Rating</option>
          <option value="first_release_date">Date Released</option>
          <option value="date_identified">Date Added</option>
          <option value="size">Filesize</option>
        </select>
      </label>
      <label>
        Sort order
        <select
          className="form-control"
          name="sort_order"
          value={draft.sort_order ?? 'asc'}
          onChange={update}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
      <div className="button-group">
        <button className="btn btn-primary" type="submit">Apply filters</button>
        <button className="btn btn-secondary" type="button" onClick={clear}>
          Clear filters
        </button>
      </div>
    </form>
  )
}
