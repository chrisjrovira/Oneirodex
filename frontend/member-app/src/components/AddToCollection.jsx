import { useCallback, useEffect, useRef, useState } from 'react'

import { addCollectionItem, fetchCollections } from '../api/collections'
import { showToast } from '../utils/toast'
import './AddToCollection.css'

/**
 * Put this game on a shelf, from wherever you are looking at it.
 *
 * Adding to a collection used to exist in exactly one place: open Collections,
 * open the shelf, search the library from inside it, click the result. That is
 * four navigations away from the tile you were already looking at, and it runs
 * backwards — you find the game first and decide where it goes second, not the
 * other way round. So shelves stayed empty.
 *
 * This is the same action offered at the two points where the decision is
 * actually made: on the tile's own menu in a grid, and on the game's details
 * page. It does not replace the picker inside a collection — that one is for
 * filling a shelf in bulk, which is a different job.
 *
 * The list is fetched on open rather than on mount. A grid renders sixty of
 * these; sixty requests for a list nobody asked to see is not a trade worth
 * making, and the list has to be re-read on open anyway in case a shelf was
 * created since.
 *
 * @param {object} props
 * @param {string} props.gameUuid
 * @param {string} props.gameName Used in the confirmation, so the toast says
 *   what went where rather than just "added".
 * @param {'menu'|'inline'} [props.variant] `menu` renders as rows in a tile's
 *   popup menu; `inline` as a labelled control on a page.
 * @param {() => void} [props.onAdded] Called after a successful add — the tile
 *   menu uses it to close itself.
 */
export function AddToCollection({
  gameUuid,
  gameName = '',
  variant = 'menu',
  onAdded,
}) {
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState(null)
  const [error, setError] = useState(null)
  const [busyUuid, setBusyUuid] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const load = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    setCollections(null)
    fetchCollections({ signal: controller.signal })
      .then((data) => {
        const rows = Array.isArray(data) ? data : data?.collections || []
        // System shelves (Favorites and friends) are maintained by the product,
        // not by hand — offering to add to one would be a control that either
        // fails or quietly does something else.
        setCollections(rows.filter((row) => !row.is_system && row.can_edit !== false))
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err)
      })
  }, [])

  function toggle() {
    setOpen((wasOpen) => {
      if (!wasOpen) load()
      return !wasOpen
    })
  }

  async function add(collection) {
    setBusyUuid(collection.uuid)
    try {
      await addCollectionItem(collection.uuid, gameUuid)
      showToast(
        gameName
          ? `${gameName} added to ${collection.name}`
          : `Added to ${collection.name}`,
        'success',
      )
      setOpen(false)
      onAdded?.()
    } catch (err) {
      showToast(err?.message || 'Could not add to that shelf.', 'error')
    } finally {
      setBusyUuid(null)
    }
  }

  return (
    <div className={`gt-add-collection gt-add-collection--${variant}`}>
      <button
        type="button"
        className={variant === 'menu' ? 'menu-button' : 'gt-cbtn'}
        aria-expanded={open}
        onClick={(event) => {
          // In a tile menu this click must not reach the tile underneath, which
          // would navigate to the details page mid-decision.
          event.preventDefault()
          event.stopPropagation()
          toggle()
        }}
      >
        Add to collection…
      </button>

      {open ? (
        <div className="gt-add-collection__list" role="group" aria-label="Collections">
          {error ? (
            <p className="gt-add-collection__note" role="alert">
              Could not load your shelves.
            </p>
          ) : null}

          {!error && collections === null ? (
            <p className="gt-add-collection__note">Loading shelves…</p>
          ) : null}

          {collections?.length === 0 ? (
            <p className="gt-add-collection__note">
              No shelves yet — make one from Collections.
            </p>
          ) : null}

          {collections?.map((collection) => (
            <button
              key={collection.uuid}
              type="button"
              className={variant === 'menu' ? 'menu-button' : 'gt-cbtn'}
              disabled={Boolean(busyUuid)}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void add(collection)
              }}
            >
              {busyUuid === collection.uuid ? 'Adding…' : collection.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default AddToCollection
